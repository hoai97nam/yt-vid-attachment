// content.js - Place this file in the root directory of the extension
let lastSeenMessageId = '';
let observerActive = false;
// Variable to store translation cache
let translationCache = {};
// Variable to store current chat ID
let currentChatId = '';
let chatObserverActive = false;

// Declare constants to store the XPath of the message input box and send button
const TEXT_INPUT_XPATH = '//*[@id="main"]/footer/div[1]/div/span/div/div[2]/div[1]/div[2]/div[1]';
const SEND_BUTTON_XPATH = 'button[aria-label="Send"]';
const CHAT_LIST_SELECTOR = '#pane-side';
const CHAT_CONTAINER_SELECTOR = 'div[role="application"]';

// Function to load cache from storage when the extension starts
function loadTranslationCache() {
  chrome.storage.local.get(['translationCache'], function(result) {
    if (result.translationCache) {
      translationCache = result.translationCache;
      console.log('Loaded translation cache from storage:', Object.keys(translationCache).length, 'messages');
    }
  });
}

// Function to save cache to storage
function saveTranslationCache() {
  chrome.storage.local.set({ translationCache: translationCache }, function() {
    console.log('Saved translation cache to storage');
  });
}

// Call the load cache function when the extension starts
loadTranslationCache();

function getElementByXPath(xpath) {
  return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

// Get the ID of the current chat
function getCurrentChatId() {
  try {
    // Multiple ways to determine the current chat
    const chatHeader = document.querySelector('#main header');
    if (chatHeader) {
      return chatHeader.innerText || 'unknown-chat';
    }
    return 'unknown-chat';
  } catch (e) {
    console.log('Cannot determine current chat:', e);
    return 'unknown-chat';
  }
}

function monitorChatChanges() {
  if (chatObserverActive) return;
  
  const chatList = document.querySelector(CHAT_LIST_SELECTOR); // '#pane-side';
  if (!chatList) {
    console.log("Cannot find chat list to monitor");
    setTimeout(monitorChatChanges, 2000);
    return;
  }
  
  // Save the initial chat ID
  currentChatId = getCurrentChatId();
  console.log("Current chat:", currentChatId);
  
  // Monitor when the user clicks on a different chat
  chatList.addEventListener('click', (event) => {
    // Use setTimeout to ensure the UI has updated after the click
    setTimeout(() => {
      const newChatId = getCurrentChatId();
      if (newChatId !== currentChatId) {
        console.log(`Switched from chat "${currentChatId}" to "${newChatId}"`);
        currentChatId = newChatId;
        
        // Reset state and restart observer for the new chat
        lastSeenMessageId = '';
        observerActive = false;
        startMessageObserver();
      }
    }, 300);
  });
  
  // Monitor DOM changes to detect when WhatsApp switches chats
  const appWrapper = document.querySelector('#app');
  if (appWrapper) {
    const chatSwitchObserver = new MutationObserver(() => {
      const newChatId = getCurrentChatId();
      if (newChatId !== currentChatId && newChatId !== 'unknown-chat') {
        console.log(`Detected switch to chat "${newChatId}" from "${currentChatId}"`);
        currentChatId = newChatId;
        
        // Reset state and restart observer for the new chat
        lastSeenMessageId = '';
        observerActive = false;
        
        // Give some time for the UI to fully update
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
    console.log("Monitoring chat switching...");
  }
}
// Monitor message changes using MutationObserver
function startMessageObserver() {
  if (observerActive) return;
  
  const messageContainer = document.querySelector(CHAT_CONTAINER_SELECTOR);
  if (!messageContainer) {
    console.log("Cannot find message container to monitor");
    // Retry after 2 seconds if the page hasn't loaded yet
    setTimeout(startMessageObserver, 2000);
    return;
  }

  const initialMessage = getLastMessageSimple();
  lastSeenMessageId = initialMessage.id;
  console.log("WhatsApp Translator activated");

  const observer = new MutationObserver(() => {
    handleNewMessage();
  });

  observer.observe(messageContainer, {
    childList: true,
    subtree: true
  });
  
  observerActive = true;
  console.log("Monitoring new messages...");
  
  applyTranslationsFromCache();
}
// Function to get the last message and determine if it's from you
function getLastMessageSimple() {
  try {
    const messageContainer = document.querySelector('div[role="application"]');
    if (!messageContainer) return { id: '', text: "Cannot find message container", isFromMe: false };

    const allMessages = messageContainer.querySelectorAll('[data-id]');
    if (!allMessages || allMessages.length === 0) return { id: '', text: "No messages found", isFromMe: false };

    const lastMessage = allMessages[allMessages.length - 1];
    const messageId = lastMessage.getAttribute('data-id') || '';
    let isFromMe = false;

    // Check if the message is incoming or not
    // Incoming messages will have class "message-in" or a parent/child with this class
    if (!lastMessage.querySelector('.message-in') && !lastMessage.closest('.message-in')) {
      isFromMe = true; // If there's no "message-in" class, it's your message
    }

    // Get the message content
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
      text: messageText || "Cannot read message content",
      isFromMe: isFromMe,
      element: lastMessage
    };
  } catch (error) {
    return {
      id: '',
      text: "Error: " + error.message,
      isFromMe: false,
      element: null
    };
  }
}

// Modified handleNewMessage function to use and update cache
async function handleNewMessage() {
  const result = getLastMessageSimple();

  if (result.id && result.id !== lastSeenMessageId) {
    lastSeenMessageId = result.id;
    console.log(`Detected new message: ${result.isFromMe ? "From you" : "From others"}`);

    if (!result.isFromMe && result.element) {
      try {
        const textElement = result.element.querySelector('span.selectable-text, .selectable-text, .message-text');
        
        // Check if the message does not contain "---" (not yet translated)
        if (textElement && !textElement.innerText.includes('---\n')) {
          console.log('Translating message...');
          
          // Check if the translation is already in cache
          if (translationCache[result.id]) {
            // Use translation from cache
            textElement.innerText = result.text + '\n---\n' + translationCache[result.id];
            console.log('Used translation from cache');
          } else {
            // Add placeholder while waiting for translation
            textElement.innerText += '\n---\nTranslating...';
            console.log('Added placeholder:', result.text);
            
            // Send message to extension background for translation
            chrome.runtime.sendMessage(
              { action: 'translate', text: result.text },
              response => {
                if (response && response.translation) {
                  // Update content with translation
                  textElement.innerText = result.text + '\n---\n' + response.translation;
                  
                  // Save translation to cache
                  translationCache[result.id] = response.translation;
                  saveTranslationCache();
                  
                  console.log('Translated message and saved to cache');
                } else {
                  textElement.innerText = result.text + '\n---\nTranslation error';
                  console.log('No translation response received');
                }
              }
            );
          }
        }
      } catch (e) {
        console.log("Cannot edit message content: ", e);
      }
    }
  }
}

// Improved function to apply translations from cache
function applyTranslationsFromCache() {
  console.log("Start applying translations from cache");
  
  const messageContainer = document.querySelector('#main div.copyable-area');
  if (!messageContainer) {
    console.log("Cannot find message container to apply translations");
    return;
  }

  const allMessages = messageContainer.querySelectorAll('[data-id]');
  console.log('Checking', allMessages.length, 'messages to apply translations from cache');

  let appliedCount = 0;
  
  allMessages.forEach(message => {
    const messageId = message.getAttribute('data-id');
    // Check multiple selectors that may contain message content
    const textElements = message.querySelectorAll('span.selectable-text, .selectable-text, .message-text');
    
    // Loop through all found text elements
    for (const textElement of textElements) {
      // Only process elements with content
      if (textElement && textElement.innerText && textElement.innerText.trim() !== '') {
        // If the message is in cache and not yet translated
        if (messageId && translationCache[messageId] && !textElement.innerText.includes('---\n')) {
          // Check if it's not your message
          const isFromMe = !message.querySelector('.message-in') && !message.closest('.message-in');
          if (!isFromMe) {
            // Save original content
            const originalText = textElement.innerText.trim();
            
            // Only apply translation to messages from others
            textElement.innerText = originalText + '\n---\n' + translationCache[messageId];
            appliedCount++;
            console.log('Applied translation from cache for message:', messageId);
          }
        }
      }
    }
  });
  
  console.log(`Finished applying translations: ${appliedCount}/${allMessages.length} messages`);
}

// Debounce function to avoid calling too many times when scrolling
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
  // Give WhatsApp Web some time to fully initialize
  setTimeout(() => {
    startMessageObserver();
    monitorChatChanges();
    observeTargetElement();
  }, 5000);
});

// Check every 30 seconds to ensure observer is still active
setInterval(() => {
  if (!observerActive) {
    console.log("Restarting message observer...");
    startMessageObserver();
  }
  if (!chatObserverActive) {
    console.log("Restarting chat change observer...");
    monitorChatChanges();
  }
}, 30000);

// Set up DOM event monitoring to detect when WhatsApp has loaded or changed
const domObserver = new MutationObserver(debounce(() => {
  // If message container is found but observer is not running
  const messageContainer = document.querySelector('#main div.copyable-area');
  if (messageContainer && !observerActive) {
    console.log("Detected WhatsApp loaded, starting observer");
  }
  
  // Check translations each time the DOM changes significantly
  if (document.querySelector('#main')) {
    // applyTranslationsFromCache();
  }
}, 1000));

// Monitor changes on the entire page
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
  floatingButton.innerHTML = `
  <span aria-hidden="true" class="">
      <svg viewBox="0 0 24 24" width="24" preserveAspectRatio="xMidYMid meet" class="x11xpdln x1d8287x x1h4ghdb" fill="none">
          <title>translate</title>
          <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" fill="currentColor"></path>
      </svg>
  </span>
  `;
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
    transition: all 0.3s ease;
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