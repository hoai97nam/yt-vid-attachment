// In the DOMContentLoaded event handler section
document.addEventListener('DOMContentLoaded', function() {
  // Check activation status and trial period
  chrome.runtime.sendMessage({action: 'checkTrialStatus'}, function(response) {
    if (response.activated) {
      // Fully activated
      document.getElementById('passwordSection').style.display = 'none';
      document.getElementById('mainContent').style.display = 'block';
    } else if (response.showActivation) {
      // Trial period ended, show activation form
      document.getElementById('passwordSection').style.display = 'block';
      document.getElementById('mainContent').style.display = 'none';
      showStatusMessage('Thank You!', 'warning');
    } else if (response.trialActive) {
      // Trial period still active
      document.getElementById('passwordSection').style.display = 'none';
      document.getElementById('mainContent').style.display = 'block';
    }
  });
  
  // Add click event for activation button
  document.getElementById('activateButton').addEventListener('click', function() {
    const password = document.getElementById('passwordInput').value.trim();
    
    // List of 20 valid activation codes
    const validActivationCodes = [
      'YT2023-ABCD-1264',
      'YT2023-EFGH-5008',
      'YT2023-IJKL-9012',
      'YT2023-MNOP-3456',
      'YT2023-QRST-7890',
      'YT2023-UVWX-1357',
      'YT2023-YZAB-2468',
      'YT2023-CDEF-9753',
      'YT2023-GHIJ-8642',
      'YT2023-KLMN-1593',
      'YT2023-OPQR-7531',
      'YT2023-STUV-2468',
      'YT2023-WXYZ-3579',
      'YT2023-ABEF-4680',
      'YT2023-CDGH-5791',
      'YT2023-IJMN-6802',
      'YT2023-OPST-7913',
      'YT2023-UVYZ-8024',
      'YT2023-ACEG-9135',
    ];
    
    if (validActivationCodes.includes(password)) {
      // Show main content if password is correct
      document.getElementById('passwordSection').style.display = 'none';
      document.getElementById('mainContent').style.display = 'block';
      showStatusMessage('Successfully activated', 'success');
      
      // Save activation status to storage
      chrome.storage.local.set({activated: true}, function() {
        console.log('Activation status saved');
      });
    } else {
      // Show error message if password is incorrect
      showStatusMessage('Activation code is incorrect. Please try again.', 'error');
    }
  });
  
  // Add event listeners for control buttons
  document.getElementById('pauseButton').addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'pause'});
      showStatusMessage('Process paused', 'info');
    });
  });

  document.getElementById('resumeButton').addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'resume'});
      showStatusMessage('Process resumed', 'success');
    });
  });

  document.getElementById('stopButton').addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'stop'});
      showStatusMessage('Process stopped', 'warning');
    });
  });
});

// In the onMessage event handler section
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'trialEnded' && request.showActivation) {
    // Show activation form when trial period ends
    document.getElementById('passwordSection').style.display = 'block';
    document.getElementById('mainContent').style.display = 'none';
    showStatusMessage('Trial period has ended. Please enter activation code to continue using.', 'warning');
  }
  if (request.action === 'updateCompletedCount') {
    document.getElementById('completedCounter').textContent = request.count;
    document.getElementById('counterContainer').style.display = 'block';
  } else if (request.action === 'logoutComplete') {
    // When logout is complete, show login screen again
    document.getElementById('passwordSection').style.display = 'block';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('passwordInput').value = ''; // Clear entered password
    showStatusMessage('Successfully logged out', 'success');
  } else if (request.action === 'trialEnded') {
    // Trial period has ended
    document.getElementById('passwordSection').style.display = 'block';
    document.getElementById('mainContent').style.display = 'none';
    showStatusMessage('Trial period has ended. Please enter activation code to continue using.', 'warning');
  } else if (request.action === 'noVideoSelected') {
    // Notification when no video is selected
    showStatusMessage('Please select (tick) the videos before starting', 'warning');
  }
});

// Modify the startButton event listener
document.getElementById('startButton').addEventListener('click', function() {
  const videoTitle = document.getElementById('videoTitle').value.trim();
  
  if (!videoTitle) {
    showStatusMessage('Please enter video name', 'error');
    return;
  }
  
  // Check trial status before starting
  chrome.runtime.sendMessage({action: 'checkTrialStatus'}, function(response) {
    if (!response.activated && !response.trialActive) {
      // Trial ended and not activated
      document.getElementById('passwordSection').style.display = 'block';
      document.getElementById('mainContent').style.display = 'none';
      showStatusMessage('Trial period has ended. Please enter activation code to continue using.', 'warning');
    } else {
      // Reset counter when starting new process
      document.getElementById('completedCounter').textContent = '0';
      document.getElementById('counterContainer').style.display = 'block';
      
      // Send information to content script
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'start',
          videoTitle: videoTitle,
          isForKids: false,
          onlySelected: true // Only process selected (ticked) videos
        });
        showStatusMessage('Process started', 'success');
      });
    }
  });
});

// Function to display notifications
function showStatusMessage(message, type) {
  const statusElement = document.getElementById('statusMessage');
  statusElement.textContent = message;
  statusElement.style.display = 'block';
  
  // Set color based on notification type
  switch(type) {
    case 'error':
      statusElement.style.color = '#c62828';
      break;
    case 'warning':
      statusElement.style.color = '#ff8f00';
      break;
    case 'success':
      statusElement.style.color = '#2e7d32';
      break;
    case 'info':
    default:
      statusElement.style.color = '#1565c0';
      break;
  }
}