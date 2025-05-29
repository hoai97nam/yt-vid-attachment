chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const validCodes = [
    "WS2023-ABCD-1264",
    "WS2023-EFGH-2387",
    "WS2023-IJKL-3492",
    "WS2023-MNOP-4571",
    "WS2023-QRST-5683",
    "WS2023-UVWX-6794",
    "WS2023-YZAB-7815",
    "WS2023-CDEF-8926",
    "WS2023-GHIJ-9037",
    "WS2023-KLMN-1048",
    "WS2023-OPQR-2159",
    "WS2023-STUV-3260",
    "WS2023-WXYZ-4371",
    "WS2023-BCDE-5482",
    "WS2023-FGHI-6593",
    "WS2023-JKLM-7604",
    "WS2023-NOPQ-8715",
    "WS2023-RSTU-9826",
    "WS2023-VWXY-0937",
    "WS2023-ZABC-1048"
  ];
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
              console.log(`Không nhận được kết quả hợp lệ, thử lại lần ${retryCount + 1}`);
              setTimeout(() => translateWithRetry(retryCount + 1, maxRetry), 800);
            } else {
              sendResponse({ translation: 'Lỗi: Không nhận được kết quả dịch hợp lệ sau nhiều lần thử lại' });
            }
          })
          .catch(error => {
            if (retryCount < maxRetry) {
              console.log(`Hết lượt dng thử: ${error.message}, thử lại lần ${retryCount + 1}`);
              setTimeout(() => translateWithRetry(retryCount + 1, maxRetry), 800);
            } else {
              sendResponse({ translation: 'Hết lượt dng thử: ' + error.message });
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
    if (validCodes.includes(message.code)) {
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
    if (!isUpgraded && trialRequestCount >= 20) {
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