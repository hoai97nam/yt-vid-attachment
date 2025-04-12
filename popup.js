document.addEventListener('DOMContentLoaded', function() {
    const executeButton = document.getElementById('executeButton');
    const statusDiv = document.getElementById('status');
    
    executeButton.addEventListener('click', function() {
        const targetXPath = document.getElementById('targetXPath').value;
        const delayTime = parseInt(document.getElementById('delayTime').value) || 2000;
        const forChildren = document.getElementById('forChildrenToggle').checked;

        if (!targetXPath) {
            statusDiv.textContent = 'Please fill in all XPath fields';
            statusDiv.style.color = 'red';
            return;
        }

        // Update status to show we're starting
        statusDiv.textContent = 'Starting task...';
        statusDiv.style.color = 'blue';

        // Send message to the active tab to execute the task
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs || tabs.length === 0) {
                statusDiv.textContent = 'Error: No active tab found';
                statusDiv.style.color = 'red';
                return;
            }
            
            // Check if we can inject into this tab
            const currentUrl = tabs[0].url;
            if (!currentUrl.includes('youtube.com')) {
                statusDiv.textContent = 'Error: This extension only works on YouTube';
                statusDiv.style.color = 'red';
                return;
            }
            
            // First, inject the content script to ensure it's loaded
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ['common.js']
            }, function(injectionResults) {
                // Check for injection errors
                if (chrome.runtime.lastError) {
                    statusDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
                    statusDiv.style.color = 'red';
                    return;
                }
                
                // Now send the message after ensuring the script is loaded
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "executeClickSequence",
                    targetXPath: targetXPath,
                    delayTime: delayTime,
                    forChildren: forChildren
                }, function(response) {
                    if (chrome.runtime.lastError) {
                        statusDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
                        statusDiv.style.color = 'red';
                    } else if (response && response.status === 'success') {
                        statusDiv.textContent = `Task started successfully! Processing ${response.itemsProcessed} items.`;
                        statusDiv.style.color = 'green';
                    } else {
                        statusDiv.textContent = 'Error: ' + (response ? response.message : 'No response from page');
                        statusDiv.style.color = 'red';
                    }
                });
            });
        });
    });
});