// content.js - PHIÊN BẢN HOÀN CHỈNH

// --- CÁC BIẾN GLOBAL VÀ SELECTOR ---
let lastSeenMessageId = '';
let observerActive = false;
let translationCache = {};
let currentChatId = '';
let chatObserverActive = false;

// Biến lưu text gốc khi dịch
let originalTextWhenTranslated = '';
let textCheckInterval = null;

// Các selector cho các thành phần trên giao diện WhatsApp
const TEXT_INPUT_SELECTOR = 'div[role="textbox"][data-tab="10"]';
const SEND_BUTTON_SELECTOR = 'button[data-testid="send"], button[aria-label="Send"]';
const CHAT_HISTORY_CONTAINER_SELECTOR = 'div[role="application"]';
// Selector cho khu vực soạn thảo, nơi chúng ta sẽ chèn các thành phần UI
const COMPOSER_AREA_SELECTOR = 'div._ak1q';


// --- CÁC HÀM CỐT LÕI (Không thay đổi) ---

function loadTranslationCache() {
  chrome.storage.local.get(['translationCache'], function(result) {
    if (result.translationCache) {
      translationCache = result.translationCache;
      console.log('Cache loaded.');
    }
  });
}

function saveTranslationCache() {
  chrome.storage.local.set({ translationCache: translationCache });
}

function waitForElement(selector, callback, timeout = 10000) {
    const startTime = Date.now();
    const interval = setInterval(() => {
        const element = document.querySelector(selector);
        if (element) {
            clearInterval(interval);
            callback(element);
        } else if (Date.now() - startTime > timeout) {
            clearInterval(interval);
        }
    }, 100);
}


// --- HÀM TỰ ĐỘNG DỊCH TIN NHẮN ĐẾN (Không thay đổi) ---

function getCurrentChatId() {
  try {
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
  const appWrapper = document.querySelector('#app');
  if (!appWrapper) {
      setTimeout(monitorChatChanges, 2000);
      return;
  }
  currentChatId = getCurrentChatId();
  const chatSwitchObserver = new MutationObserver(() => {
      const newChatId = getCurrentChatId();
      if (newChatId !== currentChatId && newChatId !== 'unknown-chat') {
        currentChatId = newChatId;
        lastSeenMessageId = '';
        observerActive = false;
        startMessageObserver();
      }
  });
  chatSwitchObserver.observe(appWrapper, { childList: true, subtree: true });
  chatObserverActive = true;
}

function startMessageObserver() {
  if (observerActive) return;
  waitForElement(CHAT_HISTORY_CONTAINER_SELECTOR, (messageContainer) => {
    observerActive = true;
    
    // Lấy ID tin nhắn cuối cùng hiện tại mà không dịch nó
    const allMessages = messageContainer.querySelectorAll('[data-id]');
    if (allMessages.length > 0) {
      const lastMessage = allMessages[allMessages.length - 1];
      const messageId = lastMessage.getAttribute('data-id');
      if (messageId) {
        lastSeenMessageId = messageId;
        console.log('Initial message ID recorded:', messageId);
      }
    }
    
    const observer = new MutationObserver(() => handleNewMessage());
    observer.observe(messageContainer, { childList: true, subtree: true });
    applyTranslationsFromCache(messageContainer);
  });
}

async function handleNewMessage() {
    const messageContainer = document.querySelector(CHAT_HISTORY_CONTAINER_SELECTOR);
    if (!messageContainer) return;
    const allMessages = messageContainer.querySelectorAll('[data-id]');
    if (allMessages.length === 0) return;
    const lastMessage = allMessages[allMessages.length - 1];
    const messageId = lastMessage.getAttribute('data-id');
    
    // Chỉ xử lý nếu đây là tin nhắn mới
    if (messageId && messageId !== lastSeenMessageId) {
        lastSeenMessageId = messageId;
        const isFromMe = !lastMessage.querySelector('.message-in') && !lastMessage.closest('.message-in');
        if (isFromMe) return;
        const textElement = lastMessage.querySelector('span.selectable-text');
        if (textElement && !textElement.innerText.includes('---\n')) {
            const originalText = textElement.innerText;
            if (translationCache[messageId]) {
                textElement.innerText = originalText + '\n---\n' + translationCache[messageId];
            } else {
                textElement.innerText += '\n---\nTranslating...';
                chrome.runtime.sendMessage({ action: 'translate', text: originalText }, response => {
                    if (response && response.translation) {
                        textElement.innerText = originalText + '\n---\n' + response.translation;
                        translationCache[messageId] = response.translation;
                        saveTranslationCache();
                    } else {
                        textElement.innerText = originalText + '\n---\nTranslation error';
                    }
                });
            }
        }
    }
}

function applyTranslationsFromCache(container) {
  const allMessages = container.querySelectorAll('[data-id]');
  allMessages.forEach(message => {
    const messageId = message.getAttribute('data-id');
    const textElement = message.querySelector('span.selectable-text');
    if (textElement && translationCache[messageId] && !textElement.innerText.includes('---\n')) {
      if (!message.closest('.message-out')) {
        textElement.innerText = textElement.innerText.trim() + '\n---\n' + translationCache[messageId];
      }
    }
  });
}


// --- LOGIC NÚT DỊCH KHI GỬI (ĐÃ CẬP NHẬT HOÀN TOÀN) ---

/**
 * Bắt đầu kiểm tra text thay đổi bằng polling
 */
function startTextChangePolling() {
    if (textCheckInterval) {
        clearInterval(textCheckInterval);
    }
    
    textCheckInterval = setInterval(() => {
        const translationResult = document.getElementById('whatsapp-translation-result');
        const currentTextBox = document.querySelector(TEXT_INPUT_SELECTOR);
        
        if (!translationResult || !currentTextBox) return;
        
        // Nếu bản dịch đang hiển thị
        if (translationResult.style.display === 'block') {
            const currentText = currentTextBox.innerText.trim();
            
            // Kiểm tra xem text có khác với text gốc khi dịch không
            if (currentText !== originalTextWhenTranslated) {
                // Ẩn bản dịch và reset trạng thái
                translationResult.style.display = 'none';
                translationResult.innerText = '';
                originalTextWhenTranslated = '';
                console.log('Text changed detected, translation reset.');
                
                // Dừng polling khi đã reset
                clearInterval(textCheckInterval);
                textCheckInterval = null;
            }
        } else {
            // Dừng polling nếu bản dịch không hiển thị
            clearInterval(textCheckInterval);
            textCheckInterval = null;
        }
    }, 100); // Kiểm tra mỗi 100ms
}

/**
 * Tạo và chèn các thành phần UI (hộp thoại dịch và nút dịch) vào trang.
 */
function createAndInsertUI() {
    const composerArea = document.querySelector(COMPOSER_AREA_SELECTOR);
    if (!composerArea || document.getElementById('whatsapp-translator-button')) {
        return;
    }

    // 1. Tạo hộp thoại chứa kết quả dịch (ẩn mặc định)
    const translationResult = document.createElement('div');
    translationResult.id = 'whatsapp-translation-result';
    translationResult.style.cssText = `
        background-color: #F0F2F5;
        color: #54656F;
        padding: 10px 15px;
        margin-bottom: 8px;
        border-radius: 8px;
        font-size: 14.5px;
        text-align: center;
        box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
        box-sizing: border-box;
        display: none; /* Quan trọng: ẩn đi lúc đầu */
        transition: all 0.2s ease;
        width: fit-content;
        max-width: 85%;
        margin-left: auto;
        margin-right: auto;
    `;
    // Chèn hộp thoại dịch vào trước khu vực soạn thảo
    composerArea.parentNode.insertBefore(translationResult, composerArea);


    // 2. Tạo nút dịch
    const floatingButton = document.createElement('button');
    floatingButton.id = 'whatsapp-translator-button';
    floatingButton.style.cssText = `background-color: #25D366 !important; color: white !important; border: none !important; border-radius: 50% !important; cursor: pointer !important; width: 40px !important; height: 40px !important; padding: 0 !important; display: flex; align-items: center; justify-content: center; margin: 0 4px; align-self: flex-end; flex-shrink: 0;`;
    floatingButton.innerHTML = `<span aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><title>translate</title><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"></path></svg></span>`;
    
    floatingButton.addEventListener('click', handleTranslateButtonClick);
    
    // Chèn nút dịch vào một vị trí ổn định trong khu vực soạn thảo
    const textInputWrapper = composerArea.querySelector('div[role="textbox"]')?.parentNode;
    if (textInputWrapper) {
        textInputWrapper.insertAdjacentElement('afterend', floatingButton);
    } else {
        // Phương án dự phòng nếu không tìm thấy: chèn vào cuối
        composerArea.appendChild(floatingButton);
    }
    
    console.log('WhatsApp Translator UI inserted.');
}

/**
 * Xử lý sự kiện khi nhấn nút dịch.
 */
function handleTranslateButtonClick() {
    const translationResult = document.getElementById('whatsapp-translation-result');
    const currentTextBox = document.querySelector(TEXT_INPUT_SELECTOR);
    if (!translationResult || !currentTextBox) return;

    // TRƯỜNG HỢP 1: Hộp thoại đang hiển thị -> Thay thế text và gửi đi
    if (translationResult.style.display === 'block') {
        // Lưu bản dịch trước
        const translatedText = translationResult.innerText;
        console.log(translatedText)
        
        // Clear textbox hoàn toàn
        // currentTextBox.innerHTML = '';
        currentTextBox.focus();
        setTimeout(() => {
          document.execCommand('selectAll', false, null)
        },);
        
        
        // Insert translated text
        setTimeout(() => {
          document.execCommand('insertText', false, translatedText);
        }, 110);
        
        // Ẩn hộp thoại
        translationResult.style.display = 'none';

        // Tự động nhấn nút gửi sau một khoảng trễ ngắn
        setTimeout(() => {
            const sendButton = document.querySelector(SEND_BUTTON_SELECTOR);
            if (sendButton) sendButton.click();
        }, 2200);

    } 
    // TRƯỜNG HỢP 2: Hộp thoại đang ẩn -> Dịch văn bản
    else {
        const textToTranslate = currentTextBox.innerText;
        if (!textToTranslate.trim()) return;
        
        // Lưu text gốc để so sánh sau này
        originalTextWhenTranslated = textToTranslate.trim();
        
        // Hiển thị hộp thoại và gọi API
        translationResult.textContent = 'Đang dịch...';
        translationResult.style.display = 'block';
        
        // Bắt đầu kiểm tra text thay đổi
        startTextChangePolling();
        
        chrome.runtime.sendMessage({ action: 'translate', text: textToTranslate.trim(), sendTo: true }, response => {
            translationResult.innerText = (response && response.translation) ? response.translation : 'Translation error';
        });
    }
}

// --- VÒNG LẶP CHÍNH VÀ KHỞI TẠO ---

function mainLoop() {
    // Vòng lặp này đảm bảo các thành phần UI luôn tồn tại khi giao diện WhatsApp thay đổi
    if (!document.getElementById('whatsapp-translator-button')) {
        createAndInsertUI();
    }
}

function main() {
    loadTranslationCache();
    startMessageObserver();
    monitorChatChanges();
    // Bắt đầu vòng lặp kiểm tra chính
    setInterval(mainLoop, 1500);
}

// Bắt đầu chạy toàn bộ script
main();

// Lắng nghe tin nhắn từ popup (để xóa cache khi đổi ngôn ngữ)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "languageChanged") {
    translationCache = {};
    saveTranslationCache();
    console.log('Translation cache cleared.');
    sendResponse({status: "OK"});
  }
  return true;
});