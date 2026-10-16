// content-script.js
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'captureFullPage') {
        // 全页截图：异步完成后再 sendResponse
        captureFullPage(message.format, sendResponse);
        return true; // 保持消息通道
    }

    if (message.action === 'enterSelectMode') {
        // 进入选择模式：立即响应关闭弹窗；后续选中截图不再占用该 sendResponse
        enterSelectMode(message.format);
        sendResponse({ success: true });
    }
});

// 截图并下载（全页 / 选中元素共用）
const captureAndDownload = async (el, format) => {
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
        default:
            throw new Error('不支持的格式');
    }

    // Blob → base64 data URL
    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });

    // 交给后台下载
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'download', data: dataUrl, format }, (res) => {
            resolve(chrome.runtime.lastError ? { success: false, error: chrome.runtime.lastError.message } : res);
        });
    });
};

// 捕获全页面
const captureFullPage = async (format, sendResponse) => {
    let restoreScrollbars = null;
    let restoreSize = null;
    try {
        restoreScrollbars = handleScrollbars();   // 隐藏滚动条
        restoreSize = expandPageToFullSize();     // 撑开到完整内容尺寸

        if (!document.body) {
            throw new Error('未找到目标元素');
        }

        const res = await captureAndDownload(document.body, format);
        if (res?.success) {
            showPageNotification('截图成功，已开始下载！', 'success');
            sendResponse({ success: true });
        } else {
            showPageNotification('下载失败！', 'error');
            sendResponse({ success: false, error: res?.error || '下载失败' });
        }
    } catch (error) {
        console.error('截图失败:', error);
        showPageNotification('截图失败！', 'error');
        sendResponse({ success: false, error: error.message });
    } finally {
        // 无论成功失败都恢复滚动条与页面尺寸
        restoreSize?.();
        restoreScrollbars?.();
    }
};

// 注入选择模式的样式
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

// 隐藏/恢复滚动条
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

// 将 html/body 撑开到完整内容尺寸，保证全页截图能截到全部（否则只截可视区）
const expandPageToFullSize = () => {
    const docEl = document.documentElement;
    const body = document.body;

    const original = {
        htmlHeight: docEl.style.height,
        htmlWidth: docEl.style.width,
        bodyHeight: body.style.height,
        bodyWidth: body.style.width
    };

    const fullHeight = Math.max(body.scrollHeight, docEl.scrollHeight);
    const fullWidth = Math.max(body.scrollWidth, docEl.scrollWidth);

    docEl.style.height = fullHeight + 'px';
    docEl.style.width = fullWidth + 'px';
    body.style.height = fullHeight + 'px';
    body.style.width = fullWidth + 'px';

    return () => {
        docEl.style.height = original.htmlHeight;
        docEl.style.width = original.htmlWidth;
        body.style.height = original.bodyHeight;
        body.style.width = original.bodyWidth;
    };
};

// 是否处于选择模式
let isSelecting = false;

// 进入选择模式
const enterSelectMode = (format) => {
    isSelecting = true;

    // 强制注入样式并验证
    injectSelectStyle();
    const styleElement = document.getElementById('snapdom-select-style');
    if (!styleElement) {
        console.error('样式注入失败');
        showPageNotification('选择模式启动失败，请重试！', 'error');
        return;
    }

    showPageNotification('已进入元素选择模式，请移动鼠标选择目标元素（按ESC取消）', 'info');

    // 创建遮罩
    const mask = document.createElement('div');
    mask.id = 'snapdom-select-mask';
    document.body.appendChild(mask);

    // 绑定事件（使用捕获阶段确保优先执行）
    document.addEventListener('mousemove', handleMouseMove, true);
    mask.addEventListener('click', (event) => handleElementSelect(event, format), true);
    document.addEventListener('keydown', handleEscKey, true);
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
const handleElementSelect = (e, format) => {
    if (!isSelecting) return;

    // 阻止事件冒泡，避免触发页面原有点击事件
    e.stopPropagation();
    e.preventDefault();

    // 获取当前高亮的元素（而非直接获取鼠标位置元素）
    const selected = document.querySelector('.snapdom-hover');

    // 退出选择模式
    exitSelectMode();

    if (selected) {
        // 对选中的元素截图
        captureElement(selected, format);
    } else {
        showPageNotification('未选中任何元素，请重试！', 'error');
    }
};

// 按 ESC 退出选择模式
const handleEscKey = (e) => {
    if (e.key === 'Escape' && isSelecting) {
        exitSelectMode();
        showPageNotification('已取消选择！', 'success');
    }
};

// 退出选择模式
const exitSelectMode = () => {
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
const captureElement = async (el, format) => {
    try {
        const res = await captureAndDownload(el, format);
        if (res?.success) {
            showPageNotification('截图成功，已开始下载！', 'success');
        } else {
            showPageNotification('下载失败！', 'error');
        }
    } catch (error) {
        console.error('截图失败:', error);
        showPageNotification('截图失败！', 'error');
    }
};

// 注入带图标的浮动通知样式
const injectNotificationStyle = () => {
    if (document.getElementById('snapdom-notification-style')) return;

    const style = document.createElement('style');
    style.id = 'snapdom-notification-style';
    style.textContent = `
    /* 浮动通知容器：包含图标和文本 */
    .snapdom-notification {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 20px;
      padding-left: 48px; /* 给图标预留空间 */
      border-radius: 8px;
      font-size: 14px;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      z-index: 9999999; /* 最顶层，不被遮挡 */
      opacity: 0;
      transition: opacity 0.3s ease, transform 0.3s ease;
      transform: translateX(-50%) translateY(-20px);
      pointer-events: none; /* 不拦截鼠标操作 */
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); /* 阴影增强层次感 */
    }

    /* 通知图标容器：固定位置 */
    .snapdom-notification .notify-icon {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      width: 20px;
      height: 20px;
    }

    /* 成功状态：绿色背景 + 对勾图标 */
    .snapdom-notification.success {
      background-color: #28a745;
    }
    .snapdom-notification.success .notify-icon path {
      fill: #fff;
    }

    /* 错误状态：红色背景 + 叉号图标 */
    .snapdom-notification.error {
      background-color: #dc3545;
    }
    .snapdom-notification.error .notify-icon path {
      fill: #fff;
    }

    /* 信息状态：蓝色背景 + 信息图标 */
    .snapdom-notification.info {
      background-color: #007bff;
    }
    .snapdom-notification.info .notify-icon path {
      fill: #fff;
    }

    /* 显示通知的动画 */
    .snapdom-notification.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  `;
    document.head.appendChild(style);
};

// 显示带图标的页面浮动通知
// 参数：message（文本）、type（success/error/info）、duration（显示时长ms）
const showPageNotification = (message, type = 'info', duration = 3000) => {
    // 1. 注入样式
    injectNotificationStyle();

    // 2. 移除旧通知（避免叠加）
    const oldNotify = document.querySelector('.snapdom-notification');
    if (oldNotify) oldNotify.remove();

    // 3. 根据类型选择 SVG 图标
    let iconSvg = '';
    switch (type) {
        case 'success':
            // 对勾图标（SVG 内联）
            iconSvg = `
        <svg class="notify-icon" viewBox="0 0 24 24">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
        </svg>
      `;
            break;
        case 'error':
            // 叉号图标（SVG 内联）
            iconSvg = `
        <svg class="notify-icon" viewBox="0 0 24 24">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
        </svg>
      `;
            break;
        case 'info':
            // 信息图标（SVG 内联）
            iconSvg = `
        <svg class="notify-icon" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
        </svg>
      `;
            break;
    }

    // 4. 创建通知元素（包含图标和文本）
    const notify = document.createElement('div');
    notify.className = `snapdom-notification ${type}`;
    notify.innerHTML = `${iconSvg}<span class="notify-text">${message}</span>`; // 图标+文本
    document.body.appendChild(notify);

    // 5. 显示通知（延迟10ms触发过渡动画）
    setTimeout(() => notify.classList.add('show'), 10);

    // 6. 自动隐藏（动画结束后移除元素）
    setTimeout(() => {
        notify.classList.remove('show');
        setTimeout(() => notify.remove(), 300); // 等待淡出动画完成
    }, duration);
};
