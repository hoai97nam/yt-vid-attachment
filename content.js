// content.js - Đặt file này trong thư mục gốc của extension
let lastSeenMessageId = '';
let observerActive = false;

function getElementByXPath(xpath) {
  return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

// Hàm lấy tin nhắn cuối cùng và xác định có phải của bạn không
function getLastMessageSimple() {
  try {
    const messageContainer = document.querySelector('div[role="application"]');
    if (!messageContainer) return { id: '', text: "Không tìm thấy container tin nhắn", isFromMe: false };

    const allMessages = messageContainer.querySelectorAll('[data-id]');
    if (!allMessages || allMessages.length === 0) return { id: '', text: "Không tìm thấy tin nhắn nào", isFromMe: false };

    const lastMessage = allMessages[allMessages.length - 1];
    const messageId = lastMessage.getAttribute('data-id') || '';
    let isFromMe = false;

    // Xét màu nền là #D9FDD3 (rgb(217, 253, 211))
    const bubble = lastMessage.querySelector('div[style*="background-color"]') || lastMessage;
    const style = window.getComputedStyle(bubble);
    const bgColor = style.backgroundColor;

    if (bgColor === 'rgb(217, 253, 211)' || bgColor.includes('217, 253, 211')) {
      isFromMe = true;
    }

    // Lấy nội dung tin nhắn
    const textSelectors = ['span.selectable-text', '.selectable-text', '.message-text'];
    let messageText = '';
    for (const selector of textSelectors) {
      const element = lastMessage.querySelector(selector);
      if (element && element.innerText) {
        messageText = element.innerText;
        break;
      }
    }

    return {
      id: messageId,
      text: messageText || "Không thể đọc nội dung tin nhắn",
      isFromMe: isFromMe,
      element: lastMessage
    };
  } catch (error) {
    return {
      id: '',
      text: "Lỗi: " + error.message,
      isFromMe: false,
      element: null
    };
  }
}

// Xử lý khi có tin nhắn mới
async function handleNewMessage() {
  const result = getLastMessageSimple();

  if (result.id && result.id !== lastSeenMessageId) {
    lastSeenMessageId = result.id;
    console.log(`Phát hiện tin nhắn mới: ${result.isFromMe ? "Của bạn" : "Từ người khác"}`);

    if (!result.isFromMe && result.element) {
      try {
        const textElement = result.element.querySelector('span.selectable-text, .selectable-text, .message-text');
        
        // Kiểm tra nếu tin nhắn không chứa "---" (chưa được dịch)
        if (textElement && !textElement.innerText.includes('---\n')) {
          console.log('Đang dịch tin nhắn...');
          
          // Thêm placeholder trong khi chờ dịch
          textElement.innerText += '\n---\nĐang dịch...';
          
          // Gửi tin nhắn đến extension background để dịch
          chrome.runtime.sendMessage(
            { action: 'translate', text: result.text },
            response => {
              if (response && response.translation) {
                // Cập nhật nội dung với bản dịch
                textElement.innerText = result.text + '\n---\n' + response.translation;
                console.log('Đã dịch xong tin nhắn.');
              } else {
                textElement.innerText = result.text + '\n---\nLỗi dịch thuật';
                console.error('Không nhận được phản hồi dịch thuật');
              }
            }
          );
        }
      } catch (e) {
        console.warn("Không thể chỉnh sửa nội dung tin nhắn: ", e);
      }
    }
  }
}

// Theo dõi thay đổi tin nhắn bằng MutationObserver
function startMessageObserver() {
  if (observerActive) return;
  
  const messageContainer = document.querySelector('div[role="application"]');
  if (!messageContainer) {
    console.error("Không tìm thấy container tin nhắn để theo dõi");
    // Thử lại sau 2 giây nếu trang chưa load xong
    setTimeout(startMessageObserver, 2000);
    return;
  }

  const initialMessage = getLastMessageSimple();
  lastSeenMessageId = initialMessage.id;
  console.log("WhatsApp Translator đã kích hoạt");

  const observer = new MutationObserver(() => {
    handleNewMessage();
  });

  observer.observe(messageContainer, {
    childList: true,
    subtree: true
  });
  
  observerActive = true;
  console.log("Đang theo dõi tin nhắn mới...");
}

// Đợi trang load xong
window.addEventListener('load', () => {
  // Cho thêm chút thời gian để WhatsApp Web khởi tạo đầy đủ
  setTimeout(startMessageObserver, 5000);
});

// Kiểm tra lại mỗi 30 giây để đảm bảo observer vẫn hoạt động
setInterval(() => {
  if (!observerActive) {
    console.log("Khởi động lại observer...");
    startMessageObserver();
  }
}, 30000);

// Content script để theo dõi element WhatsApp và hiển thị floating button

// Tạo floating button
function createFloatingButton() {
  // Tạo container bọc cả floating button và translation result
  const container = document.createElement('div');
  container.id = 'whatsapp-translator-container';
  container.style.cssText = `
    position: absolute;
    display: none;
    z-index: 9999;
    display: flex;
    flex-direction: row;
    align-items: center;
  `;
  
  const floatingButton = document.createElement('div');
  floatingButton.id = 'whatsapp-floating-button';
  floatingButton.textContent = '+';
  floatingButton.style.cssText = `
    width: 30px;
    height: 30px;
    background-color: #25D366;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 20px;
    font-weight: bold;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    opacity: 0.4;
    margin-right: 10px;
  `;
  
  // Tạo phần tử hiển thị kết quả dịch
  const translationResult = document.createElement('div');
  translationResult.id = 'whatsapp-translation-result';
  translationResult.style.cssText = `
    background-color: #f0f0f0;
    color: #333;
    padding: 5px 10px;
    border-radius: 5px;
    font-size: 14px;
    max-width: 250px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    display: none;
    text-align: left;
    word-wrap: break-word;
    opacity: 0.4;
  `;
  
  // Thêm các phần tử vào container
  container.appendChild(floatingButton);
  container.appendChild(translationResult);
  document.body.appendChild(container);
  
  // Biến để theo dõi trạng thái hiển thị của kết quả dịch
  let isTranslationVisible = false;
  
  floatingButton.addEventListener('click', () => {
    console.log('Floating button clicked!');
    
    // Lấy element đang được focus
    const targetElement = getElementByXPath('//*[@id="main"]/footer/div[1]/div/span/div/div[2]/div[1]/div[2]/div[1]');
    if (!targetElement) return;
    
    // Kiểm tra xem đã có bản dịch trong translationResult chưa
    if (translationResult.style.display === 'block') {
      console.log('Đã có bản dịch, thực hiện thay thế và gửi tin nhắn');
      
      // Thay thế nội dung trong ô nhập liệu bằng bản dịch
      targetElement.innerText = translationResult.innerText;
      
      // Đặt focus vào element để đảm bảo WhatsApp nhận biết thay đổi
      targetElement.focus();
      console.log('Đã thay thế nội dung', translationResult.innerText);
      
      // Tìm và nhấp vào nút gửi
      setTimeout(() => {
        const sendButton = getElementByXPath('//*[@id="main"]/footer/div[1]/div/span/div/div[2]/div[2]/button');
        if (sendButton) {
          console.log('Đã tìm thấy nút gửi, đang nhấp...');
          sendButton.click();
          
          // Ẩn container sau khi gửi tin nhắn
          container.style.display = 'none';
          translationResult.style.display = 'none';
          isFloatingButtonActive = false;
          console.log('Đã ẩn container sau khi gửi tin nhắn');
        } else {
          console.log('Không tìm thấy nút gửi');
        }
      }, 500); // Đợi 500ms để đảm bảo nội dung đã được cập nhật
    } else {
      // Trường hợp chưa có bản dịch, thực hiện dịch mới
      
      // Lấy text từ element
      const textToTranslate = targetElement.innerText.trim();
      if (!textToTranslate) return;
      
      // Hiển thị thông báo đang dịch
      translationResult.textContent = 'Đang dịch...';
      translationResult.style.display = 'block';
      isTranslationVisible = true;
      
      // Gọi hàm dịch đã được định nghĩa trước đó
      chrome.runtime.sendMessage(
        { action: 'translate', text: textToTranslate },
        response => {
          if (response && response.translation) {
            // Hiển thị kết quả dịch
            translationResult.innerText = response.translation;
          // Không tự động ẩn kết quả nữa
          } else {
            translationResult.innerText = 'Lỗi dịch thuật';
            // Vẫn giữ thông báo lỗi hiển thị
          }
        }
      );
    }
  });
  
  return { container, floatingButton, translationResult };
}

// Theo dõi element và hiển thị floating button
function observeTargetElement() {
  const targetXPath = '//*[@id="main"]/footer/div[1]/div/span/div/div[2]/div[1]/div[2]/div[1]';
  const { container, floatingButton, translationResult } = createFloatingButton();
  
  // Biến để theo dõi trạng thái của floating button
  let isFloatingButtonActive = false;
  
  // Hàm để kiểm tra element có được focus và có nội dung không
  function checkElementFocus() {
    const targetElement = getElementByXPath(targetXPath);
    if (!targetElement) return;
    
    // Nếu floating button đang active, không ẩn container
    if (isFloatingButtonActive) {
      return;
    }
    
    // Kiểm tra xem element có được focus và có nội dung không
    if (document.activeElement === targetElement && (targetElement.textContent.trim() !== '' || floatingButton.style.display !== 'none')) {
      // Hiển thị container ở góc trên bên phải của element
      const rect = targetElement.getBoundingClientRect();
      container.style.left = `${rect.left}px`;
      container.style.top = `${rect.top - 40}px`;
      container.style.display = 'flex';
    } else {
      // Ẩn container
      container.style.display = 'none';
      // Ẩn kết quả dịch khi container bị ẩn
      translationResult.style.display = 'none';
    }
  }
  
  // Thêm sự kiện click cho floating button để đánh dấu trạng thái active
  floatingButton.addEventListener('click', () => {
    isFloatingButtonActive = true;
    console.log('Floating button active:', isFloatingButtonActive);
  });
  
  // Thêm sự kiện click cho document để kiểm tra khi click ra ngoài
  document.addEventListener('click', (event) => {
    // Kiểm tra xem click có phải vào floating button hoặc translation result không
    if (!container.contains(event.target) && isFloatingButtonActive) {
      isFloatingButtonActive = false;
      console.log('Clicked outside, floating button inactive');
      checkElementFocus(); // Kiểm tra lại trạng thái hiển thị
    }
  });
  
  // Kiểm tra focus và nội dung mỗi 300ms
  setInterval(checkElementFocus, 300);
  
  // Thêm event listener cho sự kiện input
  document.addEventListener('input', (event) => {
    if (event.target === getElementByXPath(targetXPath)) {
      checkElementFocus();
    }
  }, true);
  
  // Thêm event listener cho sự kiện focus
  document.addEventListener('focus', (event) => {
    checkElementFocus();
  }, true);
  
  // Thêm event listener cho sự kiện blur
  document.addEventListener('blur', (event) => {
    checkElementFocus();
  }, true);
}

// Khởi động khi trang đã load
window.addEventListener('load', () => {
  setTimeout(observeTargetElement, 3000); // Đợi 3 giây để trang WhatsApp load hoàn toàn
});

// Lắng nghe thông điệp từ popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "restart") {
    observeTargetElement();
  }
});