chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'translate') {
    const API_KEY = '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';
    
    // Lấy ngôn ngữ đích từ storage
    chrome.storage.sync.get('targetLanguage', function(data) {
      // Mặc định là tiếng Anh nếu chưa có cài đặt
      const targetLanguage = data.targetLanguage || 'English';
      
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
              content: `You are a translation tool. Translate the provided text into ${targetLanguage}. Return only the translation, nothing else.`
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
