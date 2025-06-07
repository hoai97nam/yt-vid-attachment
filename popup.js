document.addEventListener('DOMContentLoaded', function() {
  // Initialize restart button if present
  const restartButton = document.getElementById('restart');
  if (restartButton) {
    restartButton.addEventListener('click', () => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "restart"});
      });
    });
  }

  // Get language settings and trial status from storage
  chrome.storage.sync.get(['targetLanguage', 'sourceLanguage', 'trialRequestCount', 'isUpgraded'], function(data) {
    const targetLanguageSelect = document.getElementById('targetLanguage');
    if (targetLanguageSelect && data.targetLanguage) {
      targetLanguageSelect.value = data.targetLanguage;
    }
    
    const sourceLanguageSelect = document.getElementById('sourceLanguage');
    if (sourceLanguageSelect && data.sourceLanguage) {
      sourceLanguageSelect.value = data.sourceLanguage;
    }

    // Display trial status
    const trialInfo = document.getElementById('trial-info');
    const codeInputContainer = document.getElementById('codeInputContainer');
    const isUpgraded = !!data.isUpgraded;
    const trialRequestCount = data.trialRequestCount || 0;

    if (!isUpgraded) {
      const left = 20 - trialRequestCount;
      trialInfo.innerText = `Trial requests left: ${left}`;
      if (left <= 0) {
        codeInputContainer.style.display = 'block';
      }
    } else {
      trialInfo.innerText = 'Full version unlocked!';
      codeInputContainer.style.display = 'none';
    }
  });

  // Handle Save button click event
  const saveButton = document.getElementById('saveButton');
  if (saveButton) {
    saveButton.addEventListener('click', function() {
      const targetLanguageSelect = document.getElementById('targetLanguage');
      const sourceLanguageSelect = document.getElementById('sourceLanguage');
      
      if (!targetLanguageSelect || !sourceLanguageSelect) return;
      
      const targetLanguage = targetLanguageSelect.value;
      const sourceLanguage = sourceLanguageSelect.value;
      
      console.log('Target language:', targetLanguage);
      console.log('Source language:', sourceLanguage);
      
      // Save settings to storage
      chrome.storage.sync.set({
        targetLanguage: targetLanguage,
        sourceLanguage: sourceLanguage
      }, function() {
        // Show saved notification
        const statusMessage = document.getElementById('statusMessage');
        if (statusMessage) {
          statusMessage.textContent = 'Settings saved!';
          
          // Notify content script about language change
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs && tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: "languageChanged",
                targetLanguage: targetLanguage,
                sourceLanguage: sourceLanguage
              });
            }
          });
          
          // Hide notification after 2 seconds
          setTimeout(function() {
            statusMessage.textContent = '';
          }, 2000);
        }
      });
    });
  }

  // Handle Confirm Code button click event
  const submitCodeButton = document.getElementById('submitCode');
  if (submitCodeButton) {
    submitCodeButton.addEventListener('click', function() {
      const upgradeCode = document.getElementById('upgradeCode').value.trim();
      const codeStatus = document.getElementById('codeStatus');
      if (!upgradeCode) {
        codeStatus.innerText = 'Please enter the code!';
        return;
      }

      // Send code to background for validation
      chrome.runtime.sendMessage(
        { action: 'validateCode', code: upgradeCode },
        response => {
          if (response.status === 'success') {
            codeStatus.innerText = response.message;
            document.getElementById('trial-info').innerText = 'Full version unlocked!';
            document.getElementById('codeInputContainer').style.display = 'none';
          } else {
            codeStatus.innerText = response.message;
          }
          // Hide notification after 3 seconds
          setTimeout(() => {
            codeStatus.innerText = '';
          }, 3000);
        }
      );
    });
  }
});