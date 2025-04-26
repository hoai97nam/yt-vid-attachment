// popup.js - Đặt file này trong thư mục gốc của extension
document.addEventListener('DOMContentLoaded', function() {
  // Khởi tạo nút restart nếu có
  const restartButton = document.getElementById('restart');
  if (restartButton) {
    restartButton.addEventListener('click', () => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "restart"});
      });
    });
  }

  // Lấy cài đặt ngôn ngữ từ storage
  chrome.storage.sync.get(['targetLanguage', 'sourceLanguage'], function(data) {
    const targetLanguageSelect = document.getElementById('targetLanguage');
    if (targetLanguageSelect && data.targetLanguage) {
      targetLanguageSelect.value = data.targetLanguage;
    }
    
    const sourceLanguageSelect = document.getElementById('sourceLanguage');
    if (sourceLanguageSelect && data.sourceLanguage) {
      sourceLanguageSelect.value = data.sourceLanguage;
    }
  });
  
  // Xử lý sự kiện khi nhấn nút Lưu
  const saveButton = document.getElementById('saveButton');
  if (saveButton) {
    saveButton.addEventListener('click', function() {
      const targetLanguageSelect = document.getElementById('targetLanguage');
      const sourceLanguageSelect = document.getElementById('sourceLanguage');
      
      if (!targetLanguageSelect || !sourceLanguageSelect) return;
      
      const targetLanguage = targetLanguageSelect.value;
      const sourceLanguage = sourceLanguageSelect.value;
      
      console.log('Ngôn ngữ đích:', targetLanguage);
      console.log('Ngôn ngữ gửi đi:', sourceLanguage);
      
      // Lưu cài đặt vào storage
      chrome.storage.sync.set({
        targetLanguage: targetLanguage,
        sourceLanguage: sourceLanguage
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
                targetLanguage: targetLanguage,
                sourceLanguage: sourceLanguage
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