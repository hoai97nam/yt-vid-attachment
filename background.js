chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'translate') {
    const API_KEY = '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';
    
    fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro-exp-03-25:free',
        messages: [
          {
            role: 'system',
            content: 'You are a translation tool. Translate the provided text into English. Return only the translation, nothing else.'
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
    
    return true; // Quan trọng: Giữ kết nối mở cho sendResponse bất đồng bộ
  }
});
