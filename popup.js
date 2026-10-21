// popup.js
document.addEventListener('DOMContentLoaded', () => {
    // 格式选择按钮
    const formatBtns = document.querySelectorAll('.format-btn');
    formatBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            formatBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // 捕获选中元素
    document.getElementById('captureSelected').addEventListener('click', () => {
        sendCaptureCommand('select');
    });

    // 捕获全页面
    document.getElementById('captureFullPage').addEventListener('click', () => {
        sendCaptureCommand('fullPage');
    });

    // 确保 <all_urls> host 权限
    // Chrome 安装时已自动授予，会直接 resolve；Firefox 默认视为可选权限，需要从用户手势里申请。
    // 必须在点击事件（用户手势）中调用。
    const ensureHostPermissions = () => new Promise((resolve) => {
        chrome.permissions.contains({ origins: ['<all_urls>'] }, (has) => {
            if (has) {
                resolve(true);
                return;
            }
            chrome.permissions.request({ origins: ['<all_urls>'] }, (granted) => {
                resolve(granted);
            });
        });
    });

    // 发送截图指令：响应到达后关闭弹窗（避免提前关窗导致消息端口断开）
    function sendCaptureCommand(type) {
        const format = document.querySelector('.format-btn.active').getAttribute('data-format');

        // 无论是否授权都继续截图：未授权时跨域图片会降级为空白，但截图不会失败
        ensureHostPermissions().then(() => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tabId = tabs[0]?.id;
                if (tabId == null) return;

                const action = type === 'select' ? 'enterSelectMode' : 'captureFullPage';
                chrome.tabs.sendMessage(tabId, { action, format }, () => {
                    if (chrome.runtime.lastError) {
                        // 内容脚本未注入等场景（如 chrome:// 页面），忽略并直接关窗
                    }
                    window.close();
                });
            });
        });
    }
});
