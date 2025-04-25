// popup.js - Đặt file này trong thư mục gốc của extension
document.addEventListener('DOMContentLoaded', function() {
  // Khởi tạo nút restart
  const restartButton = document.getElementById('restart');
  if (restartButton) {
    restartButton.addEventListener('click', () => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "restart"});
      });
    });
  }

  // Lấy cài đặt ngôn ngữ từ storage
  chrome.storage.sync.get('targetLanguage', function(data) {
    const targetLanguageSelect = document.getElementById('targetLanguage');
    if (targetLanguageSelect && data.targetLanguage) {
      targetLanguageSelect.value = data.targetLanguage;
    }
  });
  
  // Xử lý sự kiện khi nhấn nút Lưu
  const saveButton = document.getElementById('saveButton');
  if (saveButton) {
    saveButton.addEventListener('click', function() {
      const targetLanguageSelect = document.getElementById('targetLanguage');
      if (!targetLanguageSelect) return;
      
      const targetLanguage = targetLanguageSelect.value;
      console.log('Ngôn ngữ đã chọn:', targetLanguage);
      
      // Lưu cài đặt vào storage
      chrome.storage.sync.set({
        targetLanguage: targetLanguage
      }, function() {
        // Hiển thị thông báo đã lưu
        const statusMessage = document.getElementById('statusMessage');
        if (statusMessage) {
          statusMessage.textContent = 'Đã lưu cài đặt!';
          
          // Thông báo cho content script về thay đổi ngôn ngữ
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs && tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: "languageChanged",
                language: targetLanguage
              });
            }
          });
          
          // Ẩn thông báo sau 2 giây
          setTimeout(function() {
            statusMessage.textContent = '';
          }, 2000);
        }
      });
    });
  }
});