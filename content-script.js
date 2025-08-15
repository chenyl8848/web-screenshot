// content-script.js
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    console.log(message, sender, sendResponse, 'capture');
    if (message.action === 'captureFullPage') {
        try {
            const restoreScrollbars = handleScrollbars();

            // const el = message.target === 'body' ? document.body : document.querySelector('.' + message.target);
            const el = document.body;
            // const el = document.getElementById('container');
            console.log(el, 'el');
            if (!el) {
                sendResponse({ success: false, error: '未找到目标元素' });
                alert('未找到目标元素');
                return;
            }

            // 使用 snapdom 捕获元素
            const result = await snapdom(el, {
                scale: 2,
                backgroundColor: '#fff',
                // images: { embed: true, useCORS: true },
                // useProxy: 'https://corsproxy.io/?url='
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
                // 发送 base64 数据到后台脚本
                chrome.runtime.sendMessage({
                    action: 'download',
                    data: event.target.result,
                    format: message.format
                }, (downloadResponse) => {
                    if (chrome.runtime.lastError) {
                        console.log(chrome.runtime.lastError)
                        sendResponse({ success: false, error: '下载失败' });
                    } else {
                        sendResponse({ success: true });
                    }
                });
            };
            // 读取 Blob 并转换为 data URL
            reader.readAsDataURL(blob);

            restoreScrollbars();

            // 异步响应标识
            return true;
        } catch (error) {
            sendResponse({ success: false, error: error.message });
            console.error('截图失败:', error);
            alert('截图失败: ' + error.message);
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

// 在 content-script.js 中添加隐藏/恢复滚动条的函数
const handleScrollbars = () => {
    // 保存原始样式（用于恢复）
    const originalHtmlStyle = {
        overflow: document.documentElement.style.overflow,
        paddingRight: document.documentElement.style.paddingRight
    };
    const originalBodyStyle = {
        overflow: document.body.style.overflow,
        paddingRight: document.body.style.paddingRight
    };

    // 检测是否存在垂直滚动条
    const hasVerticalScrollbar = document.body.scrollHeight > window.innerHeight;

    // 隐藏滚动条的方法：
    // 1. 使用 overflow: hidden 隐藏
    // 2. 添加与滚动条宽度相等的 padding 避免页面内容偏移
    if (hasVerticalScrollbar) {
        // 计算滚动条宽度（视口宽度 - 内容宽度）
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

        // 应用样式（html 和 body 都处理，确保兼容性）
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        // 添加右侧 padding 抵消滚动条消失导致的布局偏移
        document.documentElement.style.paddingRight = `${scrollbarWidth}px`;
        document.body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
        // 无滚动条时仅隐藏（防止截图时出现空白滚动条区域）
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
    }

    // 处理自定义滚动条（添加全局样式隐藏）
    const style = document.createElement('style');
    style.id = 'snapdom-hide-scrollbars';
    style.textContent = `
    /* 隐藏所有自定义滚动条 */
    ::-webkit-scrollbar {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
    }
    /* 针对可能的滚动条容器 */
    * {
      scrollbar-width: none !important; /* Firefox */
      -ms-overflow-style: none !important; /* IE/Edge */
    }
  `;
    document.head.appendChild(style);

    // 返回恢复滚动条的函数
    return () => {
        // 恢复原始样式
        document.documentElement.style.overflow = originalHtmlStyle.overflow;
        document.documentElement.style.paddingRight = originalHtmlStyle.paddingRight;
        document.body.style.overflow = originalBodyStyle.overflow;
        document.body.style.paddingRight = originalBodyStyle.paddingRight;

        document.getElementById('snapdom-hide-scrollbars')?.remove();
    };
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
            backgroundColor: '#fff',
            // images: { embed: true, useCORS: true },
            // useProxy: 'https://corsproxy.io/?url=' //Example: 'https://corsproxy.io/?url=' or 'https://api.allorigins.win/raw?url='
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
            // 发送 base64 数据到后台脚本
            chrome.runtime.sendMessage({
                action: 'download',
                data: event.target.result,
                format: message.format
            }, (downloadResponse) => {
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