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


// 捕获选中元素
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

// 捕获全页面
document.getElementById('captureFullPage').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'captureFullPage',
      target: 'body',
      format: document.getElementById('format').value
    });
  });
});