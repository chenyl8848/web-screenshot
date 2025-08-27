// background.js
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    console.log(message, sender, sendResponse, 'download1111111111')
    if (message.action === 'download') {
        console.log(message, sender, sendResponse, 'download22222222222')
        try {
            // 直接使用从内容脚本接收的 base64 数据
            chrome.downloads.download({
                // url: `data:image/${message.format};base64,${message.data}`,
                url: `${message.data}`,
                filename: `screenshot-${new Date().getTime()}.${message.format}`
            }, (downloadId) => {
                console.log(downloadId, 'downloadId', chrome.runtime.lastError);
                if (chrome.runtime.lastError) {
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    sendResponse({ success: true, downloadId: downloadId });
                }
            });

            // 异步响应标识
            return true;
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }
});