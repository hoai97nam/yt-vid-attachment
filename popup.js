document.getElementById('startButton').addEventListener('click', function() {
  const videoTitle = document.getElementById('videoTitle').value.trim();
  
  if (!videoTitle) {
    showStatusMessage('Vui lòng nhập tên video', 'error');
    return;
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