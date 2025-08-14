// popup.js
// document.getElementById('captureSelected').addEventListener('click', () => {
//     console.log('captureSelected')
//     chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//         chrome.tabs.sendMessage(tabs[0].id, {
//             action: 'capture',
//             target: 'selected', // 后续实现选中元素逻辑
//             format: document.getElementById('format').value
//         });
//     });
// });

// 移除不必要的回调，避免等待未返回的响应
document.getElementById('captureFullPage').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
            action: 'capture',
            target: 'body',
            format: document.getElementById('format').value
        });
    });
});

// popup.js 中给「捕获选中元素」按钮添加点击事件
document.getElementById('captureSelected').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'enterSelectMode', // 发送进入选择模式的指令
      format: document.getElementById('format').value
    }, (response) => {
      if (response?.success) {
        // 关闭弹窗（可选，提升体验）
        window.close();
      }
    });
  });
});