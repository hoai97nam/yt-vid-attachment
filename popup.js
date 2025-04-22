// popup.js - Đặt file này trong thư mục gốc của extension
document.getElementById('restart').addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {action: "restart"});
  });
});