chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
if (message.action === 'translate') {
    const API_KEY = 'AIzaSyBldYrsk-NeJ0NQ8qNUedFwsMTbsdK99lA';
    const MODEL = 'gemini-2.0-flash';
    
    // Lấy ngôn ngữ đích và ngôn ngữ gửi đi từ storage
    chrome.storage.sync.get(['targetLanguage', 'sourceLanguage'], function(data) {
      // Mặc định là tiếng Anh nếu chưa có cài đặt
      const targetLanguage = data.targetLanguage || 'English';
      const sourceLanguage = data.sourceLanguage || 'English';
      
      // Định nghĩa nội dung system prompt
      let systemContent = '';
      
      if (message.sendTo) {
        systemContent = `You are a translation tool. Translate the provided text from ${sourceLanguage} into ${targetLanguage}. Return only the translation, nothing else.`;
      } else {
        systemContent = `You are a translation tool. Translate the provided text into ${targetLanguage}. Return only the translation, nothing else.`;
      }
      
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
          sendResponse({ translation: data.candidates[0].content.parts[0].text.trim() });
        } else {
          sendResponse({ translation: 'Lỗi: Không nhận được kết quả dịch hợp lệ' });
        }
      })
      .catch(error => {
        sendResponse({ translation: 'Lỗi dịch thuật: ' + error.message });
      });
    });
    
    return true; // Quan trọng: Giữ kết nối mở cho sendResponse bất đồng bộ
  }
});
