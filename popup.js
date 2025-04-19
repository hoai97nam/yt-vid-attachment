// Trong phần xử lý sự kiện DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
  // Kiểm tra trạng thái kích hoạt và phiên dùng thử
  chrome.runtime.sendMessage({action: 'checkTrialStatus'}, function(response) {
    if (response.activated) {
      // Đã kích hoạt đầy đủ
      document.getElementById('passwordSection').style.display = 'none';
      document.getElementById('mainContent').style.display = 'block';
    } else if (response.showActivation) {
      // Phiên dùng thử đã hết, hiển thị form kích hoạt
      document.getElementById('passwordSection').style.display = 'block';
      document.getElementById('mainContent').style.display = 'none';
      showStatusMessage('Phiên dùng thử đã hết. Vui lòng nhập mã kích hoạt để tiếp tục sử dụng.', 'warning');
    } else if (response.trialActive) {
      // Phiên dùng thử vẫn còn hiệu lực
      document.getElementById('passwordSection').style.display = 'none';
      document.getElementById('mainContent').style.display = 'block';
    }
  });
  
  // Thêm sự kiện click cho nút kích hoạt
  document.getElementById('activateButton').addEventListener('click', function() {
    const password = document.getElementById('passwordInput').value.trim();
    
    if (password === '123456') {
      // Hiển thị nội dung chính nếu mật khẩu đúng
      document.getElementById('passwordSection').style.display = 'none';
      document.getElementById('mainContent').style.display = 'block';
      showStatusMessage('Đã kích hoạt thành công', 'success');
      
      // Lưu trạng thái kích hoạt vào storage
      chrome.storage.local.set({activated: true}, function() {
        console.log('Đã lưu trạng thái kích hoạt');
      });
    } else {
      // Hiển thị thông báo lỗi nếu mật khẩu sai
      showStatusMessage('Mã kích hoạt không đúng. Vui lòng thử lại.', 'error');
    }
  });
});

// Trong phần xử lý sự kiện onMessage
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'trialEnded' && request.showActivation) {
    // Hiển thị form kích hoạt khi phiên dùng thử kết thúc
    document.getElementById('passwordSection').style.display = 'block';
    document.getElementById('mainContent').style.display = 'none';
    showStatusMessage('Phiên dùng thử đã hết. Vui lòng nhập mã kích hoạt để tiếp tục sử dụng.', 'warning');
  }
  if (request.action === 'updateCompletedCount') {
    document.getElementById('completedCounter').textContent = request.count;
    document.getElementById('counterContainer').style.display = 'block';
  } else if (request.action === 'logoutComplete') {
    // Khi đăng xuất hoàn tất, hiển thị lại màn hình đăng nhập
    document.getElementById('passwordSection').style.display = 'block';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('passwordInput').value = ''; // Xóa mật khẩu đã nhập
    showStatusMessage('Đã đăng xuất thành công', 'success');
  } else if (request.action === 'trialEnded') {
    // Trial period has ended
    document.getElementById('passwordSection').style.display = 'block';
    document.getElementById('mainContent').style.display = 'none';
    showStatusMessage('Phiên dùng thử đã hết. Vui lòng nhập mã kích hoạt để tiếp tục sử dụng.', 'warning');
  } else if (request.action === 'noVideoSelected') {
    // Thông báo khi không có video nào được chọn
    showStatusMessage('Vui lòng chọn (tick) các video trước khi bắt đầu', 'warning');
  }
});

// Modify the startButton event listener
document.getElementById('startButton').addEventListener('click', function() {
  const videoTitle = document.getElementById('videoTitle').value.trim();
  
  if (!videoTitle) {
    showStatusMessage('Vui lòng nhập tên video', 'error');
    return;
  }
  
  // Check trial status before starting
  chrome.runtime.sendMessage({action: 'checkTrialStatus'}, function(response) {
    if (!response.activated && !response.trialActive) {
      // Trial ended and not activated
      document.getElementById('passwordSection').style.display = 'block';
      document.getElementById('mainContent').style.display = 'none';
      showStatusMessage('Phiên dùng thử đã hết. Vui lòng nhập mã kích hoạt để tiếp tục sử dụng.', 'warning');
    } else {
      // Reset counter when starting new process
      document.getElementById('completedCounter').textContent = '0';
      document.getElementById('counterContainer').style.display = 'block';
      
      // Gửi thông tin đến content script
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'start',
          videoTitle: videoTitle,
          isForKids: false,
          onlySelected: true // Chỉ xử lý video được chọn (tick)
        });
        showStatusMessage('Đã bắt đầu quá trình', 'success');
      });
    }
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