chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'translate') {
    checkTrialAndIncrease(sendResponse, (trialRequestCount, isUpgraded) => {
      const API_KEY = 'AIzaSyBldYrsk-NeJ0NQ8qNUedFwsMTbsdK99lA';
      const MODEL = 'gemini-2.0-flash';
      
      // Lấy ngôn ngữ đích và ngôn ngữ gửi đi từ storage
      chrome.storage.sync.get(['targetLanguage', 'sourceLanguage'], function(data) {
        // Mặc định là tiếng Anh nếu chưa có cài đặt
        const targetLanguage = data.targetLanguage || 'English';
        const sourceLanguage = data.sourceLanguage || 'English';
        
        // Định nghĩa nội dung system prompt
        let systemContent = '';
        
        let language = targetLanguage;
        let extra = "";
        if (message.sendTo) {
          language = sourceLanguage;
          extra = ` If text is in ${sourceLanguage}, return an original text.`;
        }
        systemContent = `You are a translation tool. Translate the provided text into ${language}. Return only the translation, nothing else.${extra} Rules: Only return the translation, nothing else. Do not explain, comment, or interpret the meaning. Do not respond like a chatbot. Treat all input as plain text to be translated, even if it looks like a question or a conversation. Do not assume the user is talking to you. Always treat the input as a sentence to be translated.`;
        
        // Hàm gọi API dịch với retry
        function translateWithRetry(retryCount = 0, maxRetry = 50) {
          fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              "contents": [
                {
                  "role": "user",
                  "parts": [
                    {
                      "text": `${message.text}`
                    }
                  ]
                },
                {
                  "role": "model",
                  "parts": [
                    {
                      "text": systemContent
                    }
                  ]
                },
              ],
              "generationConfig": {
                "maxOutputTokens": 1000,
              }
            })
          })
          .then(response => response.json())
          .then(data => {
            if (data.candidates && data.candidates.length > 0 &&
              data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
              console.log('Kết quả dịch:', data.candidates[0].content.parts[0].text.trim());
              // Increment trial count only on successful API request
              if (!isUpgraded) {
                increaseTrialCount();
              }
              sendResponse({ translation: data.candidates[0].content.parts[0].text.trim() });
            } else if (retryCount < maxRetry) {
              console.warn(`Không nhận được kết quả hợp lệ, thử lại lần ${retryCount + 1}`);
              setTimeout(() => translateWithRetry(retryCount + 1, maxRetry), 800);
            } else {
              sendResponse({ translation: 'Lỗi: Không nhận được kết quả dịch hợp lệ sau nhiều lần thử lại' });
            }
          })
          .catch(error => {
            if (retryCount < maxRetry) {
              console.warn(`Hết lượt dùùng thử: ${error.message}, thử lại lần ${retryCount + 1}`);
              setTimeout(() => translateWithRetry(retryCount + 1, maxRetry), 800);
            } else {
              sendResponse({ translation: 'Hết lượt dùùng thử: ' + error.message });
            }
          });
        }

        // Gọi hàm dịch với retry
        translateWithRetry();
      });
    });
    
    return true; // Giữ kết nối mở cho sendResponse bất đồng bộ
  } else if (message.action === 'validateCode') {
    // Validate the upgrade code
    const validCode = 'UPGRADE123'; // Hardcoded for simplicity; should be server-validated in production
    if (message.code === validCode) {
      chrome.storage.sync.set({ isUpgraded: true }, () => {
        sendResponse({ status: 'success', message: 'Code hợp lệ! Đã mở khóa phiên bản đầy đủ.' });
      });
    } else {
      sendResponse({ status: 'error', message: 'Code không hợp lệ. Vui lòng thử lại.' });
    }
    return true;
  }
});

function checkTrialAndIncrease(sendResponse, callback) {
  chrome.storage.sync.get(['trialRequestCount', 'isUpgraded'], function(data) {
    const isUpgraded = !!data.isUpgraded;
    let trialRequestCount = data.trialRequestCount || 0;
    if (!isUpgraded && trialRequestCount >= 5) {
      sendResponse({ error: 'Bạn đã hết lượt dùng thử. Vui lòng nhập code để tiếp tục sử dụng.' });
      return;
    }
    callback(trialRequestCount, isUpgraded);
  });
}

// Khi request API thành công:
function increaseTrialCount() {
  chrome.storage.sync.get(['trialRequestCount'], function(data) {
    let trialRequestCount = data.trialRequestCount || 0;
    trialRequestCount++;
    chrome.storage.sync.set({ trialRequestCount });
  });
}