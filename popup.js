document.addEventListener('DOMContentLoaded', function() {
  // Check license status on popup open
  checkLicenseStatus();

  document.getElementById('startButton').addEventListener('click', function() {
    const videoTitle = document.getElementById('videoTitle').value.trim();
    
    if (!videoTitle) {
      showStatusMessage('Vui lòng nhập tên video', 'error');
      return;
    }
    
    // Check license before starting
    chrome.storage.sync.get(['licenseKey', 'usageCount'], function(result) {
      const hasValidLicense = result.licenseKey && isValidKey(result.licenseKey);
      const usageCount = result.usageCount || 0;
      
      if (!hasValidLicense && usageCount >= 10) {
        // Trial expired, show message
        showStatusMessage('Bạn đã hết lượt dùng thử. Vui lòng nhập license key.', 'error');
        showLicenseInput();
        return;
      }
      
      // If in trial mode, increment usage count
      if (!hasValidLicense) {
        chrome.storage.sync.set({ usageCount: usageCount + 1 });
        const remaining = 10 - (usageCount + 1);
        if (remaining > 0) {
          showStatusMessage(`Bạn còn ${remaining} lượt dùng thử.`, 'warning');
        }
      }
      
      // Gửi thông tin đến content script
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'start',
          videoTitle: videoTitle,
          isForKids: false // Luôn gửi false vì đã mặc định chọn "Không dành cho trẻ em"
        });
        showStatusMessage('Đã bắt đầu quá trình', 'success');
      });
    });
  });

  // Xử lý nút tạm dừng
  document.getElementById('pauseButton').addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'pause'
      });
      showStatusMessage('Đã tạm dừng quá trình.', 'warning');
    });
  });

  // Xử lý nút tiếp tục
  document.getElementById('resumeButton').addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'resume'
      });
      showStatusMessage('Đã tiếp tục quá trình.', 'success');
    });
  });

  // Xử lý nút dừng hẳn
  document.getElementById('stopButton').addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'stop'
      });
      showStatusMessage('Đã dừng hẳn quá trình.', 'info');
      setTimeout(() => window.close(), 1500); // Đóng popup sau 1.5 giây
    });
  });

  // Hàm hiển thị thông báo
  function showStatusMessage(message, type) {
    const statusElement = document.getElementById('statusMessage');
    statusElement.textContent = message;
    statusElement.style.display = 'block';
    
    // Đặt màu sắc dựa trên loại thông báo
    switch(type) {
      case 'error':
        statusElement.style.color = '#c62828';
        break;
      case 'warning':
        statusElement.style.color = '#ff8f00';
        break;
      case 'success':
        statusElement.style.color = '#2e7d32';
        break;
      case 'info':
      default:
        statusElement.style.color = '#1565c0';
        break;
    }
  }
  
  // License key functionality
  // Valid license keys
  function isValidKey(key) {
    const validKeys = [
      'KEY-12345-ABCDE',
      'KEY-67890-FGHIJ',
      'KEY-54321-KLMNO',
      'KEY-09876-PQRST',
      'KEY-13579-UVWXY'
    ];
    return validKeys.includes(key);
  }
  
  // Check license status and update UI
  function checkLicenseStatus() {
    chrome.storage.sync.get(['licenseKey', 'usageCount'], function(result) {
      const licenseKey = result.licenseKey;
      const usageCount = result.usageCount || 0;
      
      // Create or update license section if it doesn't exist
      let licenseSection = document.getElementById('licenseSection');
      if (!licenseSection) {
        licenseSection = document.createElement('div');
        licenseSection.id = 'licenseSection';
        licenseSection.style.marginTop = '15px';
        licenseSection.style.borderTop = '1px solid #ddd';
        licenseSection.style.paddingTop = '10px';
        document.body.appendChild(licenseSection);
      }
      
      if (licenseKey && isValidKey(licenseKey)) {
        // Licensed version
        licenseSection.innerHTML = `
          <div style="color: #2e7d32; margin-bottom: 10px;">
            <strong>Phiên bản đầy đủ</strong> - Cảm ơn bạn đã sử dụng!
          </div>
        `;
      } else {
        // Trial version
        const remainingUses = Math.max(0, 10 - usageCount);
        
        if (remainingUses > 0) {
          licenseSection.innerHTML = `
            <div style="margin-bottom: 10px;">
              <div style="color: #ff8f00; margin-bottom: 5px;">
                <strong>Phiên bản dùng thử</strong> - Còn ${remainingUses} lượt sử dụng
              </div>
              <button id="showLicenseBtn" style="font-size: 12px; padding: 3px 8px;">Nhập license key</button>
            </div>
          `;
        } else {
          licenseSection.innerHTML = `
            <div style="color: #c62828; margin-bottom: 10px;">
              <strong>Hết lượt dùng thử</strong> - Vui lòng nhập license key để tiếp tục sử dụng
            </div>
            <button id="showLicenseBtn" style="font-size: 12px; padding: 3px 8px;">Nhập license key</button>
          `;
        }
        
        // Add event listener to the license button
        document.getElementById('showLicenseBtn').addEventListener('click', showLicenseInput);
      }
    });
  }
  
  // Show license input dialog
  function showLicenseInput() {
    // Create license input container if it doesn't exist
    let licenseInputContainer = document.getElementById('licenseInputContainer');
    if (!licenseInputContainer) {
      licenseInputContainer = document.createElement('div');
      licenseInputContainer.id = 'licenseInputContainer';
      licenseInputContainer.style.marginTop = '10px';
      licenseInputContainer.style.padding = '10px';
      licenseInputContainer.style.backgroundColor = '#f5f5f5';
      licenseInputContainer.style.borderRadius = '4px';
      
      licenseInputContainer.innerHTML = `
        <div style="margin-bottom: 8px;">
          <label for="licenseKeyInput" style="display: block; margin-bottom: 5px;">License Key:</label>
          <input type="text" id="licenseKeyInput" style="width: 100%; padding: 5px; box-sizing: border-box;" placeholder="Nhập license key của bạn">
        </div>
        <div style="display: flex; gap: 5px;">
          <button id="activateKeyBtn" style="padding: 5px 10px; background-color: #1565c0; color: white; border: none; cursor: pointer;">Kích hoạt</button>
          <button id="cancelKeyBtn" style="padding: 5px 10px; background-color: #f5f5f5; border: 1px solid #ddd; cursor: pointer;">Hủy</button>
        </div>
        <div id="licenseMessage" style="margin-top: 5px; font-size: 12px;"></div>
      `;
      
      const licenseSection = document.getElementById('licenseSection');
      licenseSection.appendChild(licenseInputContainer);
      
      // Add event listeners
      document.getElementById('activateKeyBtn').addEventListener('click', activateLicense);
      document.getElementById('cancelKeyBtn').addEventListener('click', function() {
        licenseInputContainer.style.display = 'none';
      });
    } else {
      licenseInputContainer.style.display = 'block';
    }
  }
  
  // Activate license key
  function activateLicense() {
    const licenseKeyInput = document.getElementById('licenseKeyInput');
    const licenseMessage = document.getElementById('licenseMessage');
    const key = licenseKeyInput.value.trim();
    
    if (!key) {
      licenseMessage.textContent = 'Vui lòng nhập license key';
      licenseMessage.style.color = '#c62828';
      return;
    }
    
    if (isValidKey(key)) {
      // Save valid key to storage
      chrome.storage.sync.set({ licenseKey: key }, function() {
        licenseMessage.textContent = 'License key hợp lệ! Bạn đã kích hoạt phiên bản đầy đủ.';
        licenseMessage.style.color = '#2e7d32';
        
        // Update UI after successful activation
        setTimeout(function() {
          checkLicenseStatus();
          document.getElementById('licenseInputContainer').style.display = 'none';
        }, 1500);
      });
    } else {
      licenseMessage.textContent = 'License key không hợp lệ. Vui lòng thử lại.';
      licenseMessage.style.color = '#c62828';
    }
  }
});