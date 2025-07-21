// API Keys array
const API_KEYS = [
  'AIzaSyBldYrsk-NeJ0NQ8qNUedFwsMTbsdK99lA',
  'AIzaSyCxB1BzEXSLzuY-NV81Wz0_QfrZr_PewPc',
  'AIzaSyCaWo3IM56g8Wq7UlvRdulmISJqKljYClQ',
  'AIzaSyAajQJOjTyS4iaRvQONa6Z1ebn6T8cnnZE',
  'AIzaSyAoPqclA3hTCqOfir-iOESn4bMCeoPUtn4',
  'AIzaSyCv0QjDQYKSggLc0CD3gkwKy80jXKTDAwA',
  'AIzaSyAdV9pWgHjYYe_96EQ9XVG5JGFY66axKFs',
  'AIzaSyDwABFp9b8d8klZ5182XdEjJP4xUot2mls',
  'AIzaSyDzI4qjN9OgpRuRK1xfyFYG1OoIiU3HxBg',
  'AIzaSyA7oD2_fsIeJkvG-ybUHc4mHJkNQX3q_zc',
  'AIzaSyDz15kZy_pvTwOYMZy1c8WWvTmb-bY50qY'
];

// Gumroad configuration
const GUMROAD_PRODUCT_ID = 'z0q0MAXStHUkCcVWynPnug==';
const GUMROAD_VERIFY_URL = 'https://api.gumroad.com/v2/licenses/verify';

// Trial configuration
const TRIAL_REQUESTS_LIMIT = 20;

// Random key selection for better load distribution
function getRandomApiKey() {
  return API_KEYS[Math.floor(Math.random() * API_KEYS.length)];
}

// Verify license with Gumroad
async function verifyLicenseWithGumroad(licenseKey) {
  try {
    const formData = new URLSearchParams();
    formData.append('product_id', GUMROAD_PRODUCT_ID);
    formData.append('license_key', licenseKey);
    formData.append('increment_uses_count', 'false');

    const response = await fetch(GUMROAD_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData
    });

    const data = await response.json();
    
    if (data.success && data.purchase) {
      // Check if subscription is active (not cancelled or failed)
      const isActive = !data.purchase.refunded && 
                      !data.purchase.disputed && 
                      !data.purchase.subscription_cancelled_at &&
                      !data.purchase.subscription_failed_at;
      
      return {
        valid: isActive,
        email: data.purchase.email,
        uses: data.uses
      };
    }
    
    return { valid: false };
  } catch (error) {
    console.log('Error verifying license:', error);
    return { valid: false };
  }
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'translate') {
    // Check license and trial status
    chrome.storage.sync.get(['licenseKey', 'licenseValid', 'lastVerified', 'trialRequestCount'], async function(data) {
      const trialCount = data.trialRequestCount || 0;
      const now = Date.now();
      const oneHour = 60 * 60 * 1000; // Verify license every hour
      
      // Check if user has a license key
      if (data.licenseKey) {
        // Check if we need to reverify the license
        let isValid = data.licenseValid;
        if (!data.lastVerified || now - data.lastVerified > oneHour) {
          const verifyResult = await verifyLicenseWithGumroad(data.licenseKey);
          isValid = verifyResult.valid;
          
          // Update storage with verification result
          chrome.storage.sync.set({ 
            licenseValid: isValid,
            lastVerified: now,
            licenseEmail: verifyResult.email || ''
          });
        }
        
        if (!isValid) {
          sendResponse({ translation: 'License expired. Please check your subscription.' });
          return;
        }
      } else {
        // No license key - check trial limit
        if (trialCount >= TRIAL_REQUESTS_LIMIT) {
          sendResponse({ translation: 'Trial expired. Please enter a license key.' });
          return;
        }
      }
      
      // Get languages
      chrome.storage.sync.get(['targetLanguage', 'sourceLanguage'], function(langData) {
        const targetLang = langData.targetLanguage || 'English';
        const sourceLang = langData.sourceLanguage || 'Vietnamese';
        
        // Determine translation direction
        const translateTo = message.sendTo ? targetLang : sourceLang;
        
        // Call translate function
        translateText(message.text, translateTo, (result) => {
          if (result.success) {
            // Update trial count if no license
            if (!data.licenseKey) {
              chrome.storage.sync.set({ 
                trialRequestCount: trialCount + 1 
              });
            }
            sendResponse({ translation: result.translation });
          } else {
            sendResponse({ translation: 'Translation error' });
          }
        });
      });
    });
    
    return true; // Keep channel open
    
  } else if (message.action === 'validateLicense') {
    // Validate license with Gumroad
    verifyLicenseWithGumroad(message.licenseKey).then(result => {
      if (result.valid) {
        chrome.storage.sync.set({ 
          licenseKey: message.licenseKey,
          licenseValid: true,
          lastVerified: Date.now(),
          licenseEmail: result.email || ''
        }, () => {
          sendResponse({ 
            status: 'success', 
            message: 'License activated successfully!',
            email: result.email 
          });
        });
      } else {
        sendResponse({ 
          status: 'error', 
          message: 'Invalid or expired license key. Please check your subscription.' 
        });
      }
    });
    return true; // Keep channel open for async response
  }
});

// Simple translation function with random key selection
function translateText(text, targetLanguage, callback) {
  const maxRetries = Math.min(API_KEYS.length, 5); // Try max 5 different keys
  let retryCount = 0;
  const triedKeys = new Set(); // Track which keys we've tried
  
  function tryTranslate() {
    // Get random API key that we haven't tried yet
    let apiKey;
    let attempts = 0;
    
    do {
      apiKey = getRandomApiKey();
      attempts++;
      // If we've tried too many times, just use any key
      if (attempts > 20) break;
    } while (triedKeys.has(apiKey) && triedKeys.size < API_KEYS.length);
    
    triedKeys.add(apiKey);
    
    
    // System prompt
    const systemPrompt = `You are a translation tool. Translate the following text to ${targetLanguage}. 
    Return ONLY the translation without any explanation or additional text.
    If the text is already in ${targetLanguage}, return it unchanged.`;
    
    // Make API request
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{ text: text }]
        }],
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1000
        }
      })
    })
    .then(response => {
      console.log(`Response status: ${response.status}`);
      
      if (response.status === 429) {
        throw new Error('Rate limit');
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return response.json();
    })
    .then(data => {
      // Check if we have valid response
      if (data.candidates && 
          data.candidates[0] && 
          data.candidates[0].content && 
          data.candidates[0].content.parts && 
          data.candidates[0].content.parts[0] &&
          data.candidates[0].content.parts[0].text) {
        
        const translation = data.candidates[0].content.parts[0].text.trim();
        console.log('Translation successful');
        callback({ success: true, translation: translation });
        
      } else {
        throw new Error('Invalid response structure');
      }
    })
    .catch(error => {
      console.log(`Error with key ${API_KEYS.indexOf(apiKey)}: ${error.message}`);
      
      retryCount++;
      
      // Try next key if we haven't exceeded max retries
      if (retryCount < maxRetries) {
        // Small delay before retry
        setTimeout(tryTranslate, 500);
      } else {
        console.log('Max retries reached');
        callback({ success: false });
      }
    });
  }
  
  // Start translation
  tryTranslate();
}