// content.js - Đặt file này trong thư mục gốc của extension
let lastSeenMessageId = '';
let observerActive = false;
// Biến lưu trữ cache các bản dịch
let translationCache = {};
// Biến để lưu trữ ID chat hiện tại
let currentChatId = '';
let chatObserverActive = false;

// Khai báo biến const để lưu XPath của ô textbox nhập tin nhắn và nút gửi
const TEXT_INPUT_XPATH = '//*[@id="main"]/footer/div[1]/div/span/div/div[2]/div[1]/div[2]/div[1]';
const SEND_BUTTON_XPATH = 'button[aria-label="Send"]';
const CHAT_LIST_SELECTOR = '#pane-side';
const CHAT_CONTAINER_SELECTOR = 'div[role="application"]';


// Hàm để tải cache từ storage khi extension khởi động
function loadTranslationCache() {
  chrome.storage.local.get(['translationCache'], function(result) {
    if (result.translationCache) {
      translationCache = result.translationCache;
      console.log('Đã tải cache bản dịch từ storage:', Object.keys(translationCache).length, 'tin nhắn');
    }
  });
}

// Hàm để lưu cache vào storage
function saveTranslationCache() {
  chrome.storage.local.set({ translationCache: translationCache }, function() {
    console.log('Đã lưu cache bản dịch vào storage');
  });
}

// Gọi hàm tải cache khi extension bắt đầu
loadTranslationCache();

function getElementByXPath(xpath) {
  return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

// Lấy ID của cuộc trò chuyện hiện tại
function getCurrentChatId() {
  try {
    // Nhiều cách để xác định cuộc trò chuyện hiện tại
    const chatHeader = document.querySelector('#main header');
    if (chatHeader) {
      return chatHeader.innerText || 'unknown-chat';
    }
    return 'unknown-chat';
  } catch (e) {
    console.log('Không thể xác định cuộc trò chuyện hiện tại:', e);
    return 'unknown-chat';
  }
}

function monitorChatChanges() {
  if (chatObserverActive) return;
  
  const chatList = document.querySelector(CHAT_LIST_SELECTOR); // '#pane-side';
  if (!chatList) {
    console.log("Không tìm thấy danh sách chat để theo dõi");
    setTimeout(monitorChatChanges, 2000);
    return;
  }
  
  // Lưu lại ID cuộc trò chuyện ban đầu
  currentChatId = getCurrentChatId();
  console.log("Chat hiện tại:", currentChatId);
  
  // Theo dõi khi người dùng nhấp vào một cuộc trò chuyện khác
  chatList.addEventListener('click', (event) => {
    // Sử dụng setTimeout để đảm bảo UI đã cập nhật sau khi click
    setTimeout(() => {
      const newChatId = getCurrentChatId();
      if (newChatId !== currentChatId) {
        console.log(`Đã chuyển từ chat "${currentChatId}" sang "${newChatId}"`);
        currentChatId = newChatId;
        
        // Reset trạng thái và khởi động lại observer cho cuộc trò chuyện mới
        lastSeenMessageId = '';
        observerActive = false;
        startMessageObserver();
      }
    }, 300);
  });
  
  // Theo dõi thay đổi trong DOM để phát hiện khi WhatsApp thay đổi cuộc trò chuyện
  const appWrapper = document.querySelector('#app');
  if (appWrapper) {
    const chatSwitchObserver = new MutationObserver(() => {
      const newChatId = getCurrentChatId();
      if (newChatId !== currentChatId && newChatId !== 'unknown-chat') {
        console.log(`Phát hiện chuyển sang chat "${newChatId}" từ "${currentChatId}"`);
        currentChatId = newChatId;
        
        // Reset trạng thái và khởi động lại observer cho cuộc trò chuyện mới
        lastSeenMessageId = '';
        observerActive = false;
        
        // Cho một chút thời gian để UI cập nhật hoàn toàn
        setTimeout(startMessageObserver, 500);
      }
    });
    
    chatSwitchObserver.observe(appWrapper, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-selected']
    });
    
    chatObserverActive = true;
    console.log("Đang theo dõi chuyển đổi cuộc trò chuyện...");
  }
}
// Theo dõi thay đổi tin nhắn bằng MutationObserver
function startMessageObserver() {
  if (observerActive) return;
  
  const messageContainer = document.querySelector(CHAT_CONTAINER_SELECTOR);
  if (!messageContainer) {
    console.warn("Không tìm thấy container tin nhắn để theo dõi");
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
  
  applyTranslationsFromCache();
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

    // Kiểm tra xem tin nhắn có phải là tin nhắn đến hay không
    // Tin nhắn đến sẽ có class "message-in" hoặc phần tử cha/con có class này
    if (!lastMessage.querySelector('.message-in') && !lastMessage.closest('.message-in')) {
      isFromMe = true; // Nếu không có class "message-in" thì đây là tin nhắn của mình
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

// Sửa đổi hàm handleNewMessage để sử dụng và cập nhật cache
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
          
          // Kiểm tra xem bản dịch đã có trong cache chưa
          if (translationCache[result.id]) {
            // Sử dụng bản dịch từ cache
            textElement.innerText = result.text + '\n---\n' + translationCache[result.id];
            console.log('Đã sử dụng bản dịch từ cache');
          } else {
            // Thêm placeholder trong khi chờ dịch
            textElement.innerText += '\n---\nĐang dịch...';
            console.log('Đã thêm placeholder: ', result.text);
            
            // Gửi tin nhắn đến extension background để dịch
            chrome.runtime.sendMessage(
              { action: 'translate', text: result.text },
              response => {
                if (response && response.translation) {
                  // Cập nhật nội dung với bản dịch
                  textElement.innerText = result.text + '\n---\n' + response.translation;
                  
                  // Lưu bản dịch vào cache
                  translationCache[result.id] = response.translation;
                  saveTranslationCache();
                  
                  console.log('Đã dịch xong tin nhắn và lưu vào cache');
                } else {
                  textElement.innerText = result.text + '\n---\nLỗi dịch thuật';
                  console.warn('Không nhận được phản hồi dịch thuật');
                }
              }
            );
          }
        }
      } catch (e) {
        console.warn("Không thể chỉnh sửa nội dung tin nhắn: ", e);
      }
    }
  }
}

// Cải tiến hàm áp dụng bản dịch từ cache
function applyTranslationsFromCache() {
  console.log("Bắt đầu áp dụng bản dịch từ cache");
  
  const messageContainer = document.querySelector('#main div.copyable-area');
  if (!messageContainer) {
    console.warn("Không tìm thấy container tin nhắn để áp dụng bản dịch");
    return;
  }

  const allMessages = messageContainer.querySelectorAll('[data-id]');
  console.log('Đang kiểm tra', allMessages.length, 'tin nhắn để áp dụng bản dịch từ cache');

  let appliedCount = 0;
  
  allMessages.forEach(message => {
    const messageId = message.getAttribute('data-id');
    // Kiểm tra nhiều loại selector có thể chứa nội dung tin nhắn
    const textElements = message.querySelectorAll('span.selectable-text, .selectable-text, .message-text');
    
    // Lặp qua tất cả các phần tử văn bản tìm thấy
    for (const textElement of textElements) {
      // Chỉ xử lý phần tử có nội dung
      if (textElement && textElement.innerText && textElement.innerText.trim() !== '') {
        // Nếu tin nhắn có trong cache và chưa được dịch
        if (messageId && translationCache[messageId] && !textElement.innerText.includes('---\n')) {
          // Kiểm tra xem có phải tin nhắn của người khác không
          const isFromMe = !message.querySelector('.message-in') && !message.closest('.message-in');
          if (!isFromMe) {
            // Lưu nội dung gốc
            const originalText = textElement.innerText.trim();
            
            // Chỉ áp dụng bản dịch cho tin nhắn của người khác
            textElement.innerText = originalText + '\n---\n' + translationCache[messageId];
            appliedCount++;
            console.log('Đã áp dụng bản dịch từ cache cho tin nhắn:', messageId);
          }
        }
      }
    }
  });
  
  console.log(`Hoàn tất áp dụng bản dịch: ${appliedCount}/${allMessages.length} tin nhắn`);
}

// Hàm debounce để tránh gọi quá nhiều lần khi cuộn
function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

window.addEventListener('load', () => {
  // Cho thêm chút thời gian để WhatsApp Web khởi tạo đầy đủ
  setTimeout(() => {
    startMessageObserver();
    monitorChatChanges();
    observeTargetElement();
  }, 5000);
});

// Kiểm tra lại mỗi 30 giây để đảm bảo observer vẫn hoạt động
setInterval(() => {
  if (!observerActive) {
    console.log("Khởi động lại message observer...");
    startMessageObserver();
  }
  if (!chatObserverActive) {
    console.log("Khởi động lại chat change observer...");
    monitorChatChanges();
  }
}, 30000);


// Cài đặt theo dõi sự kiện DOM để phát hiện khi WhatsApp đã tải xong hoặc thay đổi
const domObserver = new MutationObserver(debounce(() => {
  // Nếu tìm thấy container tin nhắn nhưng observer chưa chạy
  const messageContainer = document.querySelector('#main div.copyable-area');
  if (messageContainer && !observerActive) {
    console.log("Phát hiện tải WhatsApp xong, khởi động observer");
  }
  
  // Kiểm tra các bản dịch mỗi khi DOM thay đổi lớn
  if (document.querySelector('#main')) {
    // applyTranslationsFromCache();
  }
}, 1000));

// Theo dõi thay đổi trên toàn bộ trang
domObserver.observe(document.body, {
  childList: true,
  subtree: true
});

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
    let targetElement = getElementByXPath(TEXT_INPUT_XPATH);
    if (!targetElement) {
      targetElement = document.querySelectorAll('div[role="textbox"]')[1]?.children[0];
    }
    if (!targetElement) return;
    
    // Kiểm tra xem đã có bản dịch trong translationResult chưa
    if (translationResult.style.display === 'block') {
      console.log('Đã có bản dịch, thực hiện thay thế và gửi tin nhắn');
      
      // Thay thế nội dung trong ô nhập liệu bằng bản dịch
      
      // Đặt focus vào element để đảm bảo WhatsApp nhận biết thay đổi
      if (targetElement) {
        targetElement.focus();
        document.execCommand('selectAll', false, null)
        setTimeout(() => {
          document.execCommand('insertText', false, translationResult.innerText);
        }, 100);
        console.log('Đã xóa nội dung hiện tại');
        console.log('Đã thay thế nội dung', translationResult.innerText);
      }
      
      // Tìm và nhấp vào nút gửi
      setTimeout(() => {
        const sendButton = document.querySelector(SEND_BUTTON_XPATH)
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
      const children = targetElement.parentElement.children;
      let textToTranslate = '';
      for (let i = 0; i < children.length; i++) {
        if (children[i].innerText) {
          textToTranslate = textToTranslate + ' \n' + children[i].innerText;
        }
      }
      if (!textToTranslate) return;
      
      // Hiển thị thông báo đang dịch
      translationResult.textContent = 'Đang dịch...';
      translationResult.style.display = 'block';
      isTranslationVisible = true;
      
      // Gọi hàm dịch đã được định nghĩa trước đó
      chrome.runtime.sendMessage(
        { action: 'translate', text: textToTranslate, sendTo: true },
        response => {
          if (response && response.translation) {
            // Hiển thị kết quả dịch
            translationResult.innerText = response.translation;
            // Không tự động ẩn kết quả nữa
          } else {
            if (response.error === 'Bạn đã hết lượt dùng thử. Vui lòng nhập code để tiếp tục sử dụng.') {
              alert(response.error);
              return;
            }
            translationResult.innerText = 'Lỗi dịch thuật';
            console.log('Hết lượt dùùng thử');
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
  const { container, floatingButton, translationResult } = createFloatingButton();
  
  // Biến để theo dõi trạng thái của floating button
  let isFloatingButtonActive = false;
  
  // Biến để lưu trữ nội dung trước đó
  let previousContent = '';
  
  // Hàm để kiểm tra element có được focus và có nội dung không
  function checkElementFocus() {
    let targetElement = getElementByXPath(TEXT_INPUT_XPATH);
    if (!targetElement) {
      targetElement = document.querySelectorAll('div[role="textbox"]')[1]?.children[0];
    }
    if (!targetElement) return;
    
    // Nếu floating button đang active, không ẩn container
    if (isFloatingButtonActive) {
      return;
    }
    
    // Lấy nội dung hiện tại
    const currentContent = targetElement.textContent.trim();
    
    // Kiểm tra xem nội dung có bị xóa không
    if (previousContent !== '' && currentContent === '') {
      console.log('Phát hiện xóa hết dữ liệu trong input');
      // Ẩn container khi dữ liệu bị xóa hết
      container.style.display = 'none';
      translationResult.style.display = 'none';
    }
    
    // Cập nhật nội dung trước đó
    previousContent = currentContent;
    
    // Kiểm tra xem element có được focus và có nội dung không
    const isElementFocused = document.activeElement === targetElement || 
                             document.activeElement === targetElement?.parentElement;
    
    if (isElementFocused && currentContent !== '') {
      // Hiển thị container ở góc trên bên phải của element
      const rect = targetElement.getBoundingClientRect();
      container.style.left = `${rect.left}px`;
      container.style.top = `${rect.top - 40}px`;
      container.style.display = 'flex';
    } else {
      // Ẩn container nếu không có nội dung hoặc không được focus
      container.style.display = 'none';
      // Ẩn kết quả dịch khi container bị ẩn
      translationResult.style.display = 'none';
    }
  }
  
  // Thêm sự kiện keydown để phát hiện phím Delete và Backspace
  document.addEventListener('keydown', (event) => {
    const targetElement = getElementByXPath(TEXT_INPUT_XPATH);
    if (!targetElement || (document.activeElement !== targetElement && document.activeElement !== targetElement.parentElement)) return;
    
    // Phát hiện phím Delete hoặc Backspace
    if (event.key === 'Delete' || event.key === 'Backspace') {
      console.log('Phát hiện phím xóa:', event.key);
      
      // Kiểm tra nếu nội dung sẽ bị xóa hoàn toàn
      if (targetElement.textContent.length <= 1 || 
          (window.getSelection().toString() === targetElement.textContent)) {
        console.log('Toàn bộ nội dung sẽ bị xóa');
        
        // Đặt timeout để kiểm tra sau khi nội dung đã được xóa
        setTimeout(() => {
          if (targetElement.textContent.trim() === '') {
            console.log('Nội dung đã bị xóa hoàn toàn');
            container.style.display = 'none';
            translationResult.style.display = 'none';
            isFloatingButtonActive = false;
          }
        }, 10);
      }
    }
  });
  
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
    const targetElement = getElementByXPath(TEXT_INPUT_XPATH);
    if (targetElement && (event.target === targetElement || event.target === targetElement.parentElement)) {
      // Kiểm tra nếu nội dung trống
      if (targetElement.textContent.trim() === '') {
        console.log('Nội dung đã bị xóa qua sự kiện input');
        container.style.display = 'none';
        translationResult.style.display = 'none';
        isFloatingButtonActive = false;
      }
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
  
  // Thêm event listener cho sự kiện cut và paste
  document.addEventListener('cut', (event) => {
    const targetElement = getElementByXPath(TEXT_INPUT_XPATH);
    if (targetElement && (event.target === targetElement || event.target === targetElement.parentElement)) {
      setTimeout(() => {
        if (targetElement.textContent.trim() === '') {
          console.log('Nội dung đã bị cắt hết');
          container.style.display = 'none';
          translationResult.style.display = 'none';
          isFloatingButtonActive = false;
        }
      }, 10);
    }
  }, true);
}

// Lắng nghe thông điệp từ popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "restart") {
    console.log("Nhận yêu cầu khởi động lại extension từ popup");
    restartAllObservers();
    sendResponse({status: "OK", message: "Đã khởi động lại toàn bộ extension"});
  } else if (message.action === "languageChanged") {
    // Xóa cache khi ngôn ngữ thay đổi để buộc dịch lại
    console.log("Nhận thông báo thay đổi ngôn ngữ từ popup");
    translationCache = {};
    saveTranslationCache();
    console.log('Đã xóa cache bản dịch do thay đổi ngôn ngữ');
    
    // Áp dụng lại bản dịch với ngôn ngữ mới
    setTimeout(() => {
      applyTranslationsFromCache();
    }, 1000);
    
    sendResponse({status: "OK", message: "Đã xóa cache và đang áp dụng ngôn ngữ mới"});
  } else if (message.action === "forceApplyTranslations") {
    // Lệnh từ popup để buộc áp dụng lại tất cả bản dịch
    console.log("Nhận lệnh áp dụng lại tất cả bản dịch");
    applyTranslationsFromCache();
    sendResponse({status: "OK", message: "Đã áp dụng lại tất cả bản dịch"});
  }
  
  // Trả về true để giữ kết nối mở cho sendResponse bất đồng bộ
  return true;
});