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

  // Lấy cài đặt ngôn ngữ và trạng thái dùng thử từ storage
  chrome.storage.sync.get(['targetLanguage', 'sourceLanguage', 'trialRequestCount', 'isUpgraded'], function(data) {
    const targetLanguageSelect = document.getElementById('targetLanguage');
    if (targetLanguageSelect && data.targetLanguage) {
      targetLanguageSelect.value = data.targetLanguage;
    }
    
    const sourceLanguageSelect = document.getElementById('sourceLanguage');
    if (sourceLanguageSelect && data.sourceLanguage) {
      sourceLanguageSelect.value = data.sourceLanguage;
    }

    // Hiển thị trạng thái dùng thử
    const trialInfo = document.getElementById('trial-info');
    const codeInputContainer = document.getElementById('codeInputContainer');
    const isUpgraded = !!data.isUpgraded;
    const trialRequestCount = data.trialRequestCount || 0;

    if (!isUpgraded) {
      const left = 5 - trialRequestCount;
      trialInfo.innerText = `Số lượt dùng thử còn lại: ${left}`;
      if (left <= 0) {
        codeInputContainer.style.display = 'block';
      }
    } else {
      trialInfo.innerText = 'Phiên bản đầy đủ đã được mở khóa!';
      codeInputContainer.style.display = 'none';
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

  // Xử lý sự kiện khi nhấn nút Xác nhận code
  const submitCodeButton = document.getElementById('submitCode');
  if (submitCodeButton) {
    submitCodeButton.addEventListener('click', function() {
      const upgradeCode = document.getElementById('upgradeCode').value.trim();
      const codeStatus = document.getElementById('codeStatus');
      if (!upgradeCode) {
        codeStatus.innerText = 'Vui lòng nhập code!';
        return;
      }

      // Gửi code đến background để xác thực
      chrome.runtime.sendMessage(
        { action: 'validateCode', code: upgradeCode },
        response => {
          if (response.status === 'success') {
            codeStatus.innerText = response.message;
            document.getElementById('trial-info').innerText = 'Phiên bản đầy đủ đã được mở khóa!';
            document.getElementById('codeInputContainer').style.display = 'none';
          } else {
            codeStatus.innerText = response.message;
          }
          // Ẩn thông báo sau 3 giây
          setTimeout(() => {
            codeStatus.innerText = '';
          }, 3000);
        }
      );
    });
  }
});