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

    // 发送截图指令：响应到达后关闭弹窗（避免提前关窗导致消息端口断开）
    function sendCaptureCommand(type) {
        const format = document.querySelector('.format-btn.active').getAttribute('data-format');

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
    }
});
