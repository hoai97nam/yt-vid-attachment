chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'translate') {
    const API_KEY = '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';
    
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
      
      fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'thudm/glm-z1-32b:free',
          messages: [
            {
              role: 'system',
              content: systemContent
            },
            {
              role: 'user',
              content: message.text
            }
          ],
          max_tokens: 1000
        })
      })
      .then(response => response.json())
      .then(data => {
        if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
          sendResponse({ translation: data.choices[0].message.content.trim() });
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
