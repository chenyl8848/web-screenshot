// background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'download') {
        chrome.downloads.download({
            url: message.data,
            filename: `screenshot-${new Date().getTime()}.${message.format}`
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ success: true, downloadId });
            }
        });
        // 保持通道，异步 sendResponse
        return true;
    }

    if (message.action === 'fetchImage') {
        // 后台通过 host_permissions 跨域拉取图片，绕过页面的 CORS 限制
        fetch(message.url)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.blob();
            })
            .then(blob => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const data = reader.result;
                    if (typeof data !== 'string' || !data.startsWith('data:image/')) {
                        reject(new Error('Invalid image data URL'));
                    } else {
                        resolve(data);
                    }
                };
                reader.onerror = () => reject(new Error('FileReader error'));
                reader.readAsDataURL(blob);
            }))
            .then(data => sendResponse({ success: true, data }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        // 保持通道，异步 sendResponse
        return true;
    }
});
