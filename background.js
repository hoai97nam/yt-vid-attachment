// Background script to handle extension events
chrome.runtime.onInstalled.addListener(function() {
  console.log('YouTube Shorts Related Video Linker extension installed');
  // Initialize trial count when extension is installed
  chrome.storage.local.set({trialCount: 0, trialActive: true, selectedVideos: []}, function() {
    console.log('Trial mode initialized');
  });
});

// Lắng nghe thông báo từ content script để chuyển tiếp đến popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'updateCompletedCount') {
    // Chuyển tiếp thông báo đến popup
    chrome.runtime.sendMessage(request);
    
    // Check and update trial usage
    chrome.storage.local.get(['trialCount', 'trialActive', 'activated'], function(result) {
      // Only count if in trial mode and not fully activated
      if (result.trialActive && !result.activated) {
        const newCount = result.trialCount + 1;
        chrome.storage.local.set({trialCount: newCount}, function() {
          console.log('Trial usage updated:', newCount);
          
          // If trial limit reached (3 videos)
          if (newCount >= 3) {
            chrome.storage.local.set({trialActive: false}, function() {
              console.log('Trial period ended');
              // Notify both popup and content script that trial has ended
              chrome.runtime.sendMessage({
                action: 'trialEnded',
                showActivation: true
              });
              
              // Also notify the content script to stop processing
              if (sender.tab && sender.tab.id) {
                chrome.tabs.sendMessage(sender.tab.id, {
                  action: 'trialEnded'
                });
              }
            });
          }
        });
      }
    });
  } else if (request.action === 'checkTrialStatus') {
    // Check trial status and respond immediately
    chrome.storage.local.get(['trialCount', 'trialActive', 'activated'], function(result) {
      sendResponse({
        trialCount: result.trialCount || 0,
        trialActive: result.trialActive !== false,
        activated: result.activated === true,
        showActivation: !result.trialActive && !result.activated
      });
    });
    return true; // Keep message channel open for async response
  } else if (request.action === 'verifyTrialBeforeStart') {
    // Verify trial status before starting process
    chrome.storage.local.get(['trialActive', 'activated'], function(result) {
      sendResponse({
        canProceed: result.activated || result.trialActive
      });
    });
    return true; // Keep message channel open for async response
  } else if (request.action === 'toggleVideoSelection') {
    // Handle video selection toggle
    chrome.storage.local.get(['selectedVideos'], function(result) {
      let selectedVideos = result.selectedVideos || [];
      const videoId = request.videoId;
      
      if (selectedVideos.includes(videoId)) {
        // Remove video if already selected
        selectedVideos = selectedVideos.filter(id => id !== videoId);
        console.log(`Video ${videoId} removed from selection`);
      } else {
        // Add video to selection
        selectedVideos.push(videoId);
        console.log(`Video ${videoId} added to selection`);
      }
      
      chrome.storage.local.set({selectedVideos: selectedVideos}, function() {
        sendResponse({
          selected: selectedVideos.includes(videoId),
          selectedVideos: selectedVideos
        });
      });
    });
    return true; // Keep message channel open for async response
  } else if (request.action === 'getSelectedVideos') {
    // Return the list of selected videos
    chrome.storage.local.get(['selectedVideos'], function(result) {
      sendResponse({
        selectedVideos: result.selectedVideos || []
      });
    });
    return true; // Keep message channel open for async response
  } else if (request.action === 'isVideoSelected') {
    // Check if a specific video is selected
    const videoId = request.videoId;
    chrome.storage.local.get(['selectedVideos'], function(result) {
      const selectedVideos = result.selectedVideos || [];
      sendResponse({
        selected: selectedVideos.includes(videoId)
      });
    });
    return true; // Keep message channel open for async response
  }
});