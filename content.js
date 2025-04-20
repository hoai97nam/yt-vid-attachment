//2
// Global variables
let videoTitle = '';
let isForKids = false;
let isPaused = false;
let isStopped = false;
let completedVideos = 0;

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'start') {
    chrome.runtime.sendMessage({action: 'verifyTrialBeforeStart'}, function(response) {
      if (response && response.canProceed) {
        videoTitle = request.videoTitle;
        isForKids = request.isForKids;
        isPaused = false;
        isStopped = false;
        completedVideos = 0;
        
        console.log('Starting process with video title:', videoTitle);
        console.log('Is for kids:', isForKids);
        
        startProcess();
      } else {
        console.log('Trial period has ended. Process cannot start.');
        alert('Trial period has ended. Please enter activation code to continue using.');
      }
    });
  } else if (request.action === 'pause') {
    isPaused = true;
    console.log('Process paused');
  } else if (request.action === 'resume') {
    isPaused = false;
    console.log('Process resumed');
  } else if (request.action === 'stop') {
    isStopped = true;
    isPaused = false;
    console.log('Process stopped');
  } else if (request.action === 'trialEnded') {
    isStopped = true;
    console.log('Trial period ended. Process stopped.');
    alert('Trial period has ended. Please enter activation code to continue using.');
  }
});

async function checkPaused() {
  while (isPaused && !isStopped) {
    console.log('Process is paused, waiting...');
    await sleep(1000);
  }
  
  if (isStopped) {
    throw new Error('Process was stopped by user');
  }
}

async function checkActivationStatus() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({action: 'checkTrialStatus'}, function(response) {
      if (!response.activated && !response.trialActive) {
        isStopped = true;
        console.log('Trial period has ended during processing. Process stopped.');
        alert('Trial period has ended. Please enter activation code to continue using.');
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

async function checkRowHasCheckmark(index) {
  const rowContainerXPath = `(//a[@id='video-title'])[${index}]`;
  const rowElement = getElementByXPath(rowContainerXPath);
  
  if (!rowElement) {
    console.log(`Could not find row-container #${index}`);
    return null;
  }
  
  const parentElement = rowElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement;
  
  if (!parentElement) {
    console.log(`Could not find parent element of row-container #${index}`);
    return false;
  }
  
  console.log(`Found parent element of row-container #${index}`);
    
  try {
    const checkmarkXPath = `.//div[@id="checkmark"]`;
    const result = document.evaluate(
      checkmarkXPath,
      parentElement,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    
    if (result.singleNodeValue) {
      console.log(`Found checkmark using relative XPath for video #${index}`);
      return true;
    }
  } catch (e) {
    console.log(`Error when finding checkmark with relative XPath: ${e.message}`);
  }
  return false;
}

async function startProcess() {
  try {
    if (!window.location.href.includes('studio.youtube.com')) {
      alert('Please navigate to YouTube Studio first');
      return;
    }
    
    let videoIndex = 1;
    let continueProcessing = true;
    
    while (continueProcessing) {
      await checkPaused();
      
      const canContinue = await checkActivationStatus();
      if (!canContinue || isStopped) {
        console.log('Process stopped due to trial limitations or user action');
        break;
      }
      
      console.log(`Starting to process video #${videoIndex}`);
      
      try {
        const videoXPath = `(//a[@id='video-title'])[${videoIndex}]`;
        const videoExists = await elementExists(videoXPath);
        
        if (!videoExists) {
          console.log(`Could not find video #${videoIndex}. Ending process.`);
          continueProcessing = false;
          break;
        }

        const hasCheckmark = await checkRowHasCheckmark(videoIndex);
        
        if (!hasCheckmark) {
          console.log(`Video #${videoIndex} has no checkmark, skipping.`);
          videoIndex++;
          continue;
        }
        
        await waitAndClick(videoXPath, `Video #${videoIndex} not found`);
        console.log(`Clicked on video #${videoIndex}`);
        
        await checkPaused();
        await sleep(2000);
        
        console.log('Checking audience settings status...');
        
        const notForKidsSelected = await elementExists("//tp-yt-paper-radio-button[@name='VIDEO_MADE_FOR_KIDS_NOT_MFK' and @checked]");
        const forKidsSelected = await elementExists("//tp-yt-paper-radio-button[@name='VIDEO_MADE_FOR_KIDS_MFK' and @checked]");
        
        if (!notForKidsSelected && !forKidsSelected) {
          console.log('Audience setting not selected yet, selecting "Not for kids"');
          await waitAndClick("//tp-yt-paper-radio-button[@name='VIDEO_MADE_FOR_KIDS_NOT_MFK']//div[@id='offRadio']", "Not for kids radio button not found");
          await sleep(1000);
        } else if (forKidsSelected) {
          console.log('Currently set to "For kids", changing to "Not for kids"');
          await waitAndClick("//tp-yt-paper-radio-button[@name='VIDEO_MADE_FOR_KIDS_NOT_MFK']//div[@id='offRadio']", "Not for kids radio button not found");
          
          console.log('Saving audience setting changes...');
          
          let saveButtonClicked = false;
          
          const saveButtons = Array.from(document.querySelectorAll('button')).filter(button => 
            button.textContent.includes('Save')
          );
          
          if (saveButtons.length > 0) {
            saveButtons[0].click();
            saveButtonClicked = true;
            console.log('Clicked Save button using text content');
          }
          
          if (!saveButtonClicked) {
            try {
              await waitAndClick("//button[contains(., 'Save')]", "Save button not found", 5000);
              saveButtonClicked = true;
              console.log('Clicked Save button using XPath');
            } catch (e) {
              console.log('Error when finding Save button using XPath:', e);
            }
          }
          
          if (saveButtonClicked) {
            console.log('Waiting for "Changes saved" notification...');
            
            const saveConfirmed = await waitForElement(
              "//div[contains(text(), 'Changes saved')]", 
              "//span[contains(text(), 'Changes saved')]",
              "//tp-yt-paper-toast[contains(., 'Changes saved')]"
            );
            
            if (saveConfirmed) {
              console.log('"Changes saved" notification appeared');
              await sleep(3000);
              
              const confirmationGone = !(await elementExists(
                "//div[contains(text(), 'Changes saved')]", 
                "//span[contains(text(), 'Changes saved')]",
                "//tp-yt-paper-toast[contains(., 'Changes saved')]"
              ));
              
              if (confirmationGone) {
                console.log('"Changes saved" notification has disappeared');
              } else {
                console.log('Notification still showing, waiting longer...');
                await sleep(2000);
              }
            }
          }
          
          await sleep(3000);
        } else {
          console.log('"Not for kids" already selected, continuing process');
        }
        
        console.log('Checking if shorts already has linked video...');
        
        try {
          const trashButton = document.querySelector('ytcp-icon-button#right-icon tp-yt-iron-icon.remove-defaults');
          if (trashButton) {
            trashButton.click();
            console.log('Clicked delete button');
            await sleep(3000);
          } else {
            console.log('Delete button not found or shorts has no linked video yet');
          }
        } catch (e) {
          console.log('Error when finding and clicking delete button:', e);
        }
        
        await waitAndClick("//div[@class='has-label container style-scope ytcp-dropdown-trigger style-scope ytcp-dropdown-trigger']//tp-yt-iron-icon[@id='right-icon']", "Pencil icon not found");
        console.log('Clicked on pencil icon');
        
        await sleep(3000);
        
        const searchInput = document.evaluate("//input[@id='search-yours']", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (searchInput) {
          searchInput.value = videoTitle;
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          console.log('Entered video title in search box');
        } else {
          throw new Error("Search input not found");
        }
        
        await sleep(3000);
        
        const videoCards = document.querySelectorAll("ytcp-entity-card");
        if (videoCards && videoCards.length > 0) {
          videoCards[0].click();
          console.log('Selected the first video from search results');
        } else {
          const videoThumbnail = document.querySelector(".thumbnail-container");
          if (videoThumbnail) {
            videoThumbnail.click();
            console.log('Clicked on video thumbnail');
          } else {
            const videoItem = document.querySelector(".video-item");
            if (videoItem) {
              videoItem.click();
              console.log('Clicked on video item');
            } else {
              throw new Error("No video found in search results");
            }
          }
        }
        
        await sleep(1000);
        
        const errorDialog = document.querySelector(".error-dialog");
        if (errorDialog) {
          const okButton = errorDialog.querySelector("button");
          if (okButton) {
            okButton.click();
            console.log('Closed error dialog');
          }
          
          const visibleVideo = document.querySelector(".thumbnail-container");
          if (visibleVideo) {
            visibleVideo.click();
            console.log('Clicked on visible video after error');
          }
        }
        
        await sleep(2000);
        
        let saveButtonClicked = false;
        let saveSuccessful = false;
        
        const saveButtons = Array.from(document.querySelectorAll('button')).filter(button => 
          button.textContent.includes('Save')
        );
        
        if (saveButtons.length > 0) {
          saveButtons[0].click();
          saveButtonClicked = true;
          console.log('Clicked save button by text content');
        }
        
        if (!saveButtonClicked) {
          const saveButtonCSS = document.querySelector("div.yt-spec-touch-feedback-shape--touch-response-inverse");
          if (saveButtonCSS) {
            saveButtonCSS.click();
            saveButtonClicked = true;
            console.log('Clicked save button using CSS selector');
          }
        }
        
        if (!saveButtonClicked) {
          try {
            await waitAndClick("//button[contains(., 'Save')]", "Save button not found", 5000);
            saveButtonClicked = true;
            console.log('Clicked save button using XPath');
          } catch (e) {
            console.log('Failed to click save button using XPath:', e);
          }
        }
        
        if (saveButtonClicked) {
          console.log('Save button clicked, waiting for confirmation...');
          
          const saveConfirmed = await waitForElement(
            "//div[contains(text(), 'Changes saved')]", 
            "//span[contains(text(), 'Changes saved')]",
            "//tp-yt-paper-toast[contains(., 'Changes saved')]"
          );
          
          if (saveConfirmed) {
            console.log('Save confirmation message appeared, save successful');
          } else {
            console.log('Save confirmation message did not appear, save may have failed');
          }
          saveSuccessful = true;
        }
        
        if (!saveSuccessful) {
          console.log('Save operation was not successful, attempting to go back...');
          let backButtonClicked = false;
          
          try {
            const backButton = document.querySelector("#back-button");
            if (backButton) {
              backButton.click();
              backButtonClicked = true;
              console.log('Clicked back button using ID selector');
            }
          } catch (e) {
            console.log('Error clicking back button with ID selector:', e);
          }
          
          if (!backButtonClicked) {
            try {
              await waitAndClick("//tp-yt-paper-icon-button[@id='back-button']", "Back button not found", 5000);
              backButtonClicked = true;
              console.log('Clicked back button using exact XPath');
            } catch (e) {
              console.log('Error clicking back button with exact XPath:', e);
            }
          }
          
          if (!backButtonClicked) {
            try {
              window.history.back();
              backButtonClicked = true;
              console.log('Used browser history back() as fallback');
            } catch (e) {
              console.log('Error using history.back():', e);
            }
          }
          
          if (backButtonClicked) {
            await sleep(3000);
            videoIndex++;
            continue;
          }
        }

        if (saveSuccessful) {
          await sleep(2000);
          
          const confirmationGone = !(await elementExists(
            "//div[contains(text(), 'Changes Saved')]", 
            "//span[contains(text(), 'Changes Saved')]",
            "//tp-yt-paper-toast[contains(., 'Changes saved')]"
          ));
          
          if (confirmationGone) {
            console.log('Save confirmation message has disappeared');
          } else {
            console.log('Save confirmation message still visible, waiting a bit longer');
            await sleep(3000);
          }
          
          await sleep(1000);
          
          let backButtonClicked = false;
          
          try {
            const backButton = document.querySelector("#back-button");
            if (backButton) {
              backButton.click();
              backButtonClicked = true;
              console.log('Clicked back button using ID selector');
            }
          } catch (e) {
            console.log('Error clicking back button with ID selector:', e);
          }
          
          if (!backButtonClicked) {
            try {
              await waitAndClick("//tp-yt-paper-icon-button[@id='back-button']", "Back button not found", 5000);
              backButtonClicked = true;
              console.log('Clicked back button using exact XPath');
            } catch (e) {
              console.log('Error clicking back button with exact XPath:', e);
            }
          }
          
          if (!backButtonClicked) {
            try {
              const backButtonCSS = document.querySelector("[id='back-button']");
              if (backButtonCSS) {
                backButtonCSS.click();
                backButtonClicked = true;
                console.log('Clicked back button using CSS ID selector');
              }
            } catch (e) {
              console.log('Error clicking back button with CSS ID selector:', e);
            }
          }
          
          if (!backButtonClicked) {
            try {
              window.history.back();
              backButtonClicked = true;
              console.log('Used browser history back() as fallback');
            } catch (e) {
              console.log('Error using history.back():', e);
            }
          }
          
          if (backButtonClicked) {
            console.log('Returned to video list page');
            await sleep(3000);
            
            completedVideos++;
            
            chrome.runtime.sendMessage({
              action: 'updateCompletedCount',
              count: completedVideos
            });
            
            videoIndex++;
          } else {
            console.warn('Could not return to video list page, ending process');
            continueProcessing = false;
          }
        }
      } catch (error) {
        console.error(`Error when processing video #${videoIndex}:`, error);
        try {
          window.history.back();
          await sleep(3000);
          videoIndex++;
        } catch (e) {
          console.error('Cannot continue after error:', e);
          continueProcessing = false;
        }
      }
    }
    
    console.log(`Completed processing all videos. Total: ${completedVideos}`);
    
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

// Helper function to wait for an element and click it
async function waitAndClick(xpath, errorMessage, timeout = 10000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const element = getElementByXPath(xpath);
      if (element) {
        element.click();
        return;
      }
    } catch (e) {
      // Continue trying
    }
    
    await sleep(500);
  }
  
  throw new Error(errorMessage);
}

// Helper function to wait for one of multiple elements to appear
async function waitForElement(...xpaths) {
  const timeout = 15000;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    for (const xpath of xpaths) {
      const element = getElementByXPath(xpath);
      if (element) {
        return true;
      }
    }
    
    await sleep(500);
  }
  
  return false;
}

function getElementByXPath(xpath) {
  return document.evaluate(
    xpath, 
    document, 
    null, 
    XPathResult.FIRST_ORDERED_NODE_TYPE, 
    null
  ).singleNodeValue;
}

async function elementExists(...xpaths) {
  for (const xpath of xpaths) {
    const element = getElementByXPath(xpath);
    if (element) {
      return true;
    }
  }
  return false;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}