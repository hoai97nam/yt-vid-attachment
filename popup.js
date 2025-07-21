document.addEventListener('DOMContentLoaded', function() {
  // Check license and trial status on load
  checkLicenseAndTrialStatus();
  
  // Get language settings from storage
  chrome.storage.sync.get(['targetLanguage', 'sourceLanguage'], function(data) {
    const targetLanguageSelect = document.getElementById('targetLanguage');
    if (targetLanguageSelect && data.targetLanguage) {
      targetLanguageSelect.value = data.targetLanguage;
    }
    
    const sourceLanguageSelect = document.getElementById('sourceLanguage');
    if (sourceLanguageSelect && data.sourceLanguage) {
      sourceLanguageSelect.value = data.sourceLanguage;
    }
  });

  // Handle Activate License button
  const submitCodeButton = document.getElementById('submitCode');
  if (submitCodeButton) {
    submitCodeButton.addEventListener('click', function() {
      const licenseKey = document.getElementById('upgradeCode').value.trim();
      if (!licenseKey) {
        showCodeStatus('Please enter a license key!', 'error');
        return;
      }
      
      // Send license to background for validation
      chrome.runtime.sendMessage(
        { action: 'validateLicense', licenseKey: licenseKey },
        response => {
          if (response.status === 'success') {
            showCodeStatus(response.message, 'success');
            // Clear the input
            document.getElementById('upgradeCode').value = '';
            // Refresh status after a short delay
            setTimeout(() => {
              checkLicenseAndTrialStatus();
            }, 1500);
          } else {
            showCodeStatus(response.message, 'error');
          }
        }
      );
    });
  }

  // Handle Log out button
  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', function() {
      if (confirm('Are you sure you want to log out?')) {
        // Clear license data
        chrome.storage.sync.remove(['licenseKey', 'licenseValid', 'licenseEmail', 'lastVerified'], function() {
          showCodeStatus('Logged out successfully', 'success');
          // Refresh status
          setTimeout(() => {
            checkLicenseAndTrialStatus();
          }, 1000);
        });
      }
    });
  }

  // Handle Save Settings button
  const saveButton = document.getElementById('saveButton');
  if (saveButton) {
    saveButton.addEventListener('click', function() {
      const targetLanguageSelect = document.getElementById('targetLanguage');
      const sourceLanguageSelect = document.getElementById('sourceLanguage');
      
      if (!targetLanguageSelect || !sourceLanguageSelect) return;
      
      const targetLanguage = targetLanguageSelect.value;
      const sourceLanguage = sourceLanguageSelect.value;
      
      // Save settings to storage
      chrome.storage.sync.set({
        targetLanguage: targetLanguage,
        sourceLanguage: sourceLanguage
      }, function() {
        showStatusMessage('Settings saved!', 'success');
        
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
      });
    });
  }
});

function checkLicenseAndTrialStatus() {
  chrome.storage.sync.get(['licenseKey', 'licenseValid', 'licenseEmail', 'trialRequestCount'], function(data) {
    const trialInfoDiv = document.getElementById('trial-info');
    const codeInputContainer = document.getElementById('codeInputContainer');
    const logoutButton = document.getElementById('logoutButton');
    const trialCount = data.trialRequestCount || 0;
    const trialLimit = 20;
    
    if (data.licenseKey && data.licenseValid) {
      // Licensed user
      trialInfoDiv.innerHTML = `✓ Licensed to: ${data.licenseEmail || 'Premium User'}`;
      trialInfoDiv.className = 'status-box success';
      trialInfoDiv.style.display = 'block';
      codeInputContainer.style.display = 'none';
      logoutButton.style.display = 'block';
    } else {
      // Trial user or no license
      const requestsLeft = Math.max(0, trialLimit - trialCount);
      logoutButton.style.display = 'none';
      
      if (requestsLeft > 0) {
        // Still have trial requests
        trialInfoDiv.innerHTML = `You have ${requestsLeft} trial translations left.`;
        trialInfoDiv.className = 'status-box info';
        trialInfoDiv.style.display = 'block';
        codeInputContainer.style.display = 'block'; // Always show input during trial
      } else {
        // Trial expired
        trialInfoDiv.innerHTML = `Trial expired. Please enter your license key to continue.`;
        trialInfoDiv.className = 'status-box error';
        trialInfoDiv.style.display = 'block';
        codeInputContainer.style.display = 'block';
      }
    }
  });
}

function showStatusMessage(message, type) {
  const statusDiv = document.getElementById('statusMessage');
  statusDiv.textContent = message;
  statusDiv.className = `status-box ${type}`;
  statusDiv.style.display = 'block';
  
  // Hide after 2 seconds
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 2000);
}

function showCodeStatus(message, type) {
  const codeStatusDiv = document.getElementById('codeStatus');
  codeStatusDiv.textContent = message;
  codeStatusDiv.className = `status-box ${type}`;
  codeStatusDiv.style.display = 'block';
  
  // Hide after 3 seconds
  setTimeout(() => {
    codeStatusDiv.style.display = 'none';
  }, 3000);
}