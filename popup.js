document.addEventListener('DOMContentLoaded', function() {
  // Get all the buttons
  const redButton = document.getElementById('red');
  const greenButton = document.getElementById('green');
  const blueButton = document.getElementById('blue');
  const resetButton = document.getElementById('reset');
  
  // Add new button for message monitoring
  const monitorButton = document.createElement('button');
  monitorButton.id = 'monitor';
  monitorButton.textContent = 'Monitor Messages';
  monitorButton.style.backgroundColor = '#ff9900';
  monitorButton.style.color = 'white';
  monitorButton.style.margin = '5px';
  monitorButton.style.padding = '5px 10px';
  monitorButton.style.cursor = 'pointer';
  monitorButton.style.border = 'none';
  monitorButton.style.borderRadius = '4px';
  document.body.appendChild(monitorButton);

  // Function to change background color
  function changeBackgroundColor(color) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: setBackgroundColor,
        args: [color]
      });
    });
  }

  // Function that will be executed in the context of the page
  function setBackgroundColor(color) {
    document.body.style.backgroundColor = color;
  }
  
  // Function to start monitoring WhatsApp messages
  function startMonitoringMessages() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: setupMessageMonitor
      });
    });
  }
  
  // Function that will be executed in the context of the page to monitor messages
  function setupMessageMonitor() {
    // Function to get element by XPath
    function getElementByXpath(path) {
      return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }
    
    // Get the message container element
    const messageContainer = getElementByXpath('//*[@id="main"]/div[3]/div/div[2]/div[2]');
    
    if (messageContainer) {
      // Create a MutationObserver instance
      const observer = new MutationObserver(function(mutations) {
        // Show alert notification when changes are detected
        console.log("new message!!");
      });
      
      // Start observing the target node for configured mutations
      observer.observe(messageContainer, { 
        childList: true,
        // subtree: true,
        // characterData: true
      });
      
      // Add a flag to indicate monitoring is active
      window._whatsappMonitorActive = true;
      
      console.log("WhatsApp message monitoring started!");
      alert("WhatsApp message monitoring started!");
    } else {
      console.error("Message container not found. Are you on WhatsApp Web?");
      alert("Message container not found. Please make sure you're on WhatsApp Web and have a chat open.");
    }
  }

  // Add click event listeners to buttons
  redButton.addEventListener('click', function() {
    changeBackgroundColor('#ffcccc');
  });

  greenButton.addEventListener('click', function() {
    changeBackgroundColor('#ccffcc');
  });

  blueButton.addEventListener('click', function() {
    changeBackgroundColor('#ccccff');
  });

  resetButton.addEventListener('click', function() {
    changeBackgroundColor('');
  });
  
  // Add click event listener for the monitor button
  monitorButton.addEventListener('click', function() {
    startMonitoringMessages();
  });
});