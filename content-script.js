// content-script.js
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    console.log(message, sender, sendResponse, 'capture');
    if (message.action === 'capture') {
        try {
            const el = message.target === 'body' ? document.body : document.querySelector('.' + message.target);
            console.log(el, 'el');
            if (!el) {
                sendResponse({ success: false, error: '未找到目标元素' });
                return;
            }

            // 使用 snapdom 捕获元素
            const result = await snapdom(el, {
                scale: 2,
                backgroundColor: '#fff'
            });

            // 处理不同格式
            let blob;
            switch (message.format) {
                case 'png':
                    blob = await result.toBlob({ type: 'png' });
                    break;
                case 'jpg':
                    blob = await result.toBlob({ type: 'jpg', quality: 0.9 });
                    break;
                case 'svg':
                    blob = await result.toBlob({ type: 'svg' });
                    break;
                default:
                    sendResponse({ success: false, error: '不支持的格式' });
                    return;
            }

            // 关键：在内容脚本中将 Blob 转换为 base64
            console.log(blob, 'blog');
            const reader = new FileReader();
            reader.onload = function (event) {
                // 提取 base64 数据（去除前缀）
                const base64Data = event.target.result.split(',')[1];
                console.log(event.target.result, base64Data, 'base64Data')

                // 发送 base64 数据到后台脚本
                chrome.runtime.sendMessage({
                    action: 'download',
                    // data: base64Data,
                    data: event.target.result,
                    format: message.format
                }, (downloadResponse) => {
                    console.log(downloadResponse, 'downloadResponse')
                    if (chrome.runtime.lastError) {
                        sendResponse({ success: false, error: '下载失败' });
                    } else {
                        sendResponse({ success: true });
                    }
                });
            };
            // 读取 Blob 并转换为 data URL
            reader.readAsDataURL(blob);

            // 异步响应标识
            return true;
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    } else if (message.action === 'enterSelectMode') {
        enterSelectMode(message, sender, sendResponse);
        sendResponse({ success: true });
        return true;
    }
});

// content-script.js 开头添加
// 注入选择模式的样式
// 修改 content-script.js 中的 injectSelectStyle 函数
const injectSelectStyle = () => {
    // 先移除旧样式（避免重复注入）
    const oldStyle = document.getElementById('snapdom-select-style');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'snapdom-select-style';
    // 使用 !important 提升优先级，确保覆盖元素原有样式
    style.textContent = `
    /* 悬停元素高亮样式 - 提升优先级 */
    .snapdom-hover {
      outline: 2px solid #4285f4 !important;
      box-shadow: 0 0 0 4px rgba(66, 133, 244, 0.3) !important;
      transition: all 0.1s ease !important;
      /* 确保 z-index 足够高（如果元素被其他元素覆盖） */
      z-index: 999998 !important;
      position: relative !important; /* 确保 z-index 生效 */
    }
    /* 选择遮罩 */
    #snapdom-select-mask {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 999999;
      pointer-events: auto;
      background: transparent;
    }
  `;
    document.head.appendChild(style);
};

// content-script.js 中添加选择模式处理函数
let selectedElement = null;
let isSelecting = false;

// 进入选择模式
const enterSelectMode = (message, sender, sendResponse) => {
    console.log(message, sender, sendResponse, 'enterSelectMode');
    isSelecting = true;
    selectedElement = null;

    // 强制注入样式并验证
    injectSelectStyle();
    const styleElement = document.getElementById('snapdom-select-style');
    if (!styleElement) {
        console.error('样式注入失败');
        alert('选择模式启动失败，请重试');
        return;
    }

    // 创建遮罩
    const mask = document.createElement('div');
    mask.id = 'snapdom-select-mask';
    document.body.appendChild(mask);

    // 绑定事件（使用捕获阶段确保优先执行）
    document.addEventListener('mousemove', handleMouseMove, true);
    // mask.addEventListener('click', handleElementSelect, true);
    mask.addEventListener('click', (event) => handleElementSelect(event, message, sender, sendResponse), true);
    document.addEventListener('keydown', handleEscKey, true);

    alert('已进入元素选择模式，请点击要截图的元素（按ESC取消）');
};

// 鼠标移动时高亮元素
const handleMouseMove = (e) => {
    if (!isSelecting) return;

    // 移除上一个高亮元素的样式
    const prevHover = document.querySelector('.snapdom-hover');
    if (prevHover) prevHover.classList.remove('snapdom-hover');

    // 关键：获取鼠标位置的元素（排除遮罩）
    const mask = document.getElementById('snapdom-select-mask');
    if (!mask) return; // 安全检查

    // 临时禁用遮罩的指针事件，才能正确获取下方元素
    mask.style.pointerEvents = 'none';
    // 获取鼠标下方的元素
    const hoveredElement = document.elementFromPoint(e.clientX, e.clientY);
    // 恢复遮罩的指针事件
    mask.style.pointerEvents = 'auto';

    // 确保元素存在且不是遮罩本身
    if (hoveredElement && hoveredElement !== mask) {
        hoveredElement.classList.add('snapdom-hover');
    }
};

// 点击选择元素
const handleElementSelect = (e, message, sender, sendResponse) => {
    console.log('handleElementSelect', e, message, sender, sendResponse);
    if (!isSelecting) return;

    // 阻止事件冒泡，避免触发页面原有点击事件
    e.stopPropagation();
    e.preventDefault();

    // 获取当前高亮的元素（而非直接获取鼠标位置元素）
    selectedElement = document.querySelector('.snapdom-hover');
    console.log('selectedElement', selectedElement);

    // 退出选择模式
    exitSelectMode();

    if (selectedElement) {
        // 对选中的元素截图
        captureElement(selectedElement, message, sender, sendResponse);
    } else {
        alert('未选中任何元素，请重试');
    }
};

// 按 ESC 退出选择模式
const handleEscKey = (e) => {
    console.log('handleEscKey', e);
    if (e.key === 'Escape' && isSelecting) {
        exitSelectMode();
        alert('已取消选择');
    }
};

// 退出选择模式
const exitSelectMode = () => {
    console.log('exitSelectMode');
    isSelecting = false;

    // 移除所有高亮样式
    document.querySelectorAll('.snapdom-hover').forEach(el => {
        el.classList.remove('snapdom-hover');
    });

    // 移除事件监听
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('keydown', handleEscKey);

    // 移除遮罩层和样式
    const mask = document.getElementById('snapdom-select-mask');
    if (mask) mask.remove();

    const style = document.getElementById('snapdom-select-style');
    if (style) style.remove();
};

// 对指定元素进行截图
const captureElement = async (el, message, sender, sendResponse) => {
    console.log('captureElement', el, message, sender, sendResponse);
    try {
        // 获取当前选择的格式（从 popup 传递，这里简化处理）
        const format = message.format; // 实际应从消息中获取用户选择的格式

        const result = await snapdom(el, {
            scale: 2,
            backgroundColor: '#fff'
        });

        let blob;
        switch (format) {
            case 'png':
                blob = await result.toBlob({ type: 'png' });
                break;
            case 'jpg':
                blob = await result.toBlob({ type: 'jpg', quality: 0.9 });
                break;
            case 'svg':
                blob = await result.toBlob({ type: 'svg' });
                break;
        }

        // 关键：在内容脚本中将 Blob 转换为 base64
        console.log(blob, 'blog');
        const reader = new FileReader();
        reader.onload = function (event) {
            // 提取 base64 数据（去除前缀）
            const base64Data = event.target.result.split(',')[1];
            console.log(event.target.result, base64Data, 'base64Data')

            // 发送 base64 数据到后台脚本
            chrome.runtime.sendMessage({
                action: 'download',
                // data: base64Data,
                data: event.target.result,
                // format: message.format
                format: 'png'
            }, (downloadResponse) => {
                console.log(downloadResponse, 'downloadResponse')
                if (chrome.runtime.lastError) {
                    sendResponse({ success: false, error: '下载失败' });
                } else {
                    sendResponse({ success: true });
                }
            });
        };
        // 读取 Blob 并转换为 data URL
        reader.readAsDataURL(blob);

        // 异步响应标识
        return true;

    } catch (error) {
        console.error('截图失败:', error);
        alert('截图失败: ' + error.message);
    }
};