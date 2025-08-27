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
// document.getElementById('captureSelected').addEventListener('click', () => {
//   console.log('captureSelected')
//   chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//     chrome.tabs.sendMessage(tabs[0].id, {
//       action: 'enterSelectMode', // 发送进入选择模式的指令
//       format: document.getElementById('format').value
//     }, (response) => {
//       if (response?.success) {
//         // 关闭弹窗（可选，提升体验）
//         window.close();
//       }
//     });
//   });
// });

// 捕获全页面
// document.getElementById('captureFullPage').addEventListener('click', () => {
//   console.log('captureFullPage')
//   chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//     chrome.tabs.sendMessage(tabs[0].id, {
//       action: 'captureFullPage',
//       target: 'body',
//       format: document.getElementById('format').value
//     });
//   });
// });

// popup.js 交互逻辑
document.addEventListener('DOMContentLoaded', () => {
  // 1. 格式选择按钮交互
  const formatBtns = document.querySelectorAll('.format-btn');
  formatBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // 移除其他按钮的 active 类
      formatBtns.forEach(b => b.classList.remove('active'));
      // 给当前点击的按钮添加 active 类
      btn.classList.add('active');
      // 保存用户选择的格式到 localStorage
      const selectedFormat = btn.getAttribute('data-format');
      saveSelectedFormat(selectedFormat);
    });
  });

  // 2. 捕获选中元素按钮
  document.getElementById('captureSelected').addEventListener('click', () => {
    sendCaptureCommand('select');
  });

  // 3. 捕获全页面按钮
  document.getElementById('captureFullPage').addEventListener('click', () => {
    sendCaptureCommand('fullPage');
  });

  // 辅助函数：保存格式选择
  function saveSelectedFormat(format) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: (f) => localStorage.setItem('snapdom_format', f),
        args: [format]
      });
    });
  }

  // 辅助函数：发送截图指令
  function sendCaptureCommand(type) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const format = document.querySelector('.format-btn.active').getAttribute('data-format');

      if (type === 'select') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'enterSelectMode', // 发送进入选择模式的指令
            format: format
          }, (response) => {
            if (response?.success) {
              // 关闭弹窗（可选，提升体验）
              window.close();
            }
          });
        });
      } else if (type === 'fullPage') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'captureFullPage',
            // target: 'body',
            format: format
          });
        });
      }

      // 点击后关闭弹窗（提升体验）
      setTimeout(() => window.close(), 300);
    });
  }
});