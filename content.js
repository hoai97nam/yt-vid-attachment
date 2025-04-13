// Global variables
let videoTitle = '';
let isForKids = false;
let isPaused = false;
let isStopped = false;

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'start') {
    videoTitle = request.videoTitle;
    isForKids = request.isForKids;
    isPaused = false;
    isStopped = false;
    
    console.log('Starting process with video title:', videoTitle);
    console.log('Is for kids:', isForKids);
    
    // Start the process
    startProcess();
  } else if (request.action === 'pause') {
    isPaused = true;
    console.log('Process paused');
  } else if (request.action === 'resume') {
    isPaused = false;
    console.log('Process resumed');
  } else if (request.action === 'stop') {
    isStopped = true;
    console.log('Process stopped');
  }
});

// Thêm hàm để kiểm tra trạng thái tạm dừng
async function checkPaused() {
  while (isPaused && !isStopped) {
    console.log('Process is paused, waiting...');
    await sleep(1000);
  }
  
  // Nếu đã dừng hẳn, ném lỗi để dừng quy trình
  if (isStopped) {
    throw new Error('Process was stopped by user');
  }
}

// Main process function
async function startProcess() {
  try {
    // Check if we're on the YouTube Studio page
    if (!window.location.href.includes('studio.youtube.com')) {
      alert('Please navigate to YouTube Studio first');
      return;
    }
    
    let videoIndex = 1;
    let continueProcessing = true;
    
    while (continueProcessing) {
      // Kiểm tra trạng thái tạm dừng
      await checkPaused();
      
      console.log(`Bắt đầu xử lý video thứ ${videoIndex}`);
      
      try {
        // Wait for the video index to be available and click it
        const videoXPath = `(//a[@id='video-title'])[${videoIndex}]`;
        const videoExists = await elementExists(videoXPath);
        
        if (!videoExists) {
          console.log(`Không tìm thấy video thứ ${videoIndex}. Kết thúc quy trình.`);
          continueProcessing = false;
          break;
        }
        
        await waitAndClick(videoXPath, `Video thứ ${videoIndex} không tìm thấy`);
        console.log(`Đã nhấn vào video thứ ${videoIndex}`);
        
        // Kiểm tra trạng thái tạm dừng
        await checkPaused();
        
        // Wait for the page to load
        await sleep(2000);
        
        // Kiểm tra trạng thái hiện tại của tùy chọn đối tượng người xem
        console.log('Kiểm tra trạng thái đối tượng người xem...');
        
        // Kiểm tra nút "Không dành cho trẻ em" đã được chọn chưa
        const notForKidsSelected = await elementExists("//tp-yt-paper-radio-button[@name='VIDEO_MADE_FOR_KIDS_NOT_MFK' and @checked]");
        
        // Kiểm tra nút "Dành cho trẻ em" đã được chọn chưa
        const forKidsSelected = await elementExists("//tp-yt-paper-radio-button[@name='VIDEO_MADE_FOR_KIDS_MFK' and @checked]");
        
        if (!notForKidsSelected && !forKidsSelected) {
          // Trường hợp 1: Chưa chọn cái nào
          console.log('Chưa chọn đối tượng người xem, đang chọn "Không dành cho trẻ em"');
          await waitAndClick("//tp-yt-paper-radio-button[@name='VIDEO_MADE_FOR_KIDS_NOT_MFK']//div[@id='offRadio']", "Not for kids radio button not found");
          await sleep(1000);
        } else if (forKidsSelected) {
          // Trường hợp 2: Đã chọn "Có, nội dung này dành cho trẻ em"
          console.log('Đã chọn "Dành cho trẻ em", đang chuyển sang "Không dành cho trẻ em"');
          await waitAndClick("//tp-yt-paper-radio-button[@name='VIDEO_MADE_FOR_KIDS_NOT_MFK']//div[@id='offRadio']", "Not for kids radio button not found");
          
          // Bấm nút lưu sau khi thay đổi
          console.log('Đang lưu thay đổi đối tượng người xem...');
          
          // Tìm và nhấn nút Lưu
          let saveButtonClicked = false;
          
          // Thử các cách khác nhau để tìm nút Lưu
          const saveButtons = Array.from(document.querySelectorAll('button')).filter(button => 
            button.textContent.includes('Lưu')
          );
          
          if (saveButtons.length > 0) {
            saveButtons[0].click();
            saveButtonClicked = true;
            console.log('Đã nhấn nút Lưu bằng text content');
          }
          
          if (!saveButtonClicked) {
            try {
              await waitAndClick("//button[contains(., 'Lưu')]", "Không tìm thấy nút Lưu", 5000);
              saveButtonClicked = true;
              console.log('Đã nhấn nút Lưu bằng XPath');
            } catch (e) {
              console.log('Lỗi khi tìm nút Lưu bằng XPath:', e);
            }
          }
          
          if (saveButtonClicked) {
            // Đợi thông báo "Đã lưu thay đổi" xuất hiện và biến mất
            console.log('Đợi thông báo "Đã lưu thay đổi"...');
            
            const saveConfirmed = await waitForElement(
              "//div[contains(text(), 'Đã lưu thay đổi')]", 
              "//span[contains(text(), 'Đã lưu thay đổi')]",
              "//tp-yt-paper-toast[contains(., 'Đã lưu thay đổi')]"
            );
            
            if (saveConfirmed) {
              console.log('Thông báo "Đã lưu thay đổi" đã xuất hiện');
              
              // Đợi thông báo biến mất
              await sleep(3000);
              
              // Kiểm tra xem thông báo đã biến mất chưa
              const confirmationGone = !(await elementExists(
                "//div[contains(text(), 'Đã lưu thay đổi')]", 
                "//span[contains(text(), 'Đã lưu thay đổi')]",
                "//tp-yt-paper-toast[contains(., 'Đã lưu thay đổi')]"
              ));
              
              if (confirmationGone) {
                console.log('Thông báo "Đã lưu thay đổi" đã biến mất');
              } else {
                console.log('Thông báo vẫn còn hiển thị, đợi thêm...');
                await sleep(2000);
              }
            }
          }
          
          // Đợi thêm 3 giây trước khi tiếp tục quy trình
          await sleep(3000);
        } else {
          // Trường hợp 3: Đã chọn "Không, nội dung này không dành cho trẻ em"
          console.log('Đã chọn "Không dành cho trẻ em", tiếp tục quy trình');
        }
        
        // Check if there's already a linked video (trash button exists)
        console.log('Kiểm tra xem shorts đã được gắn video khác chưa...');
        
        // Sử dụng phương pháp được chỉ định để tìm và nhấn nút xóa
        try {
          const trashButton = document.querySelector('ytcp-icon-button#right-icon tp-yt-iron-icon.remove-defaults');
          if (trashButton) {
            trashButton.click();
            console.log('Đã nhấn nút xóa');
            // Chờ 3 giây để nút pencil hiện ra
            await sleep(3000);
          } else {
            console.log('Không tìm thấy nút xóa hoặc shorts chưa được gắn video');
          }
        } catch (e) {
          console.log('Lỗi khi tìm và nhấn nút xóa:', e);
        }
        
        // Click on the pencil icon to open the video selection dialog
        await waitAndClick("//div[@class='has-label container style-scope ytcp-dropdown-trigger style-scope ytcp-dropdown-trigger']//tp-yt-iron-icon[@id='right-icon']", "Pencil icon not found");
        console.log('Clicked on pencil icon');
        
        // Wait for the dialog to appear
        await sleep(3000);
        
        // Enter the video title in the search box
        const searchInput = document.querySelector("input[placeholder='Tìm kiếm video của bạn']");
        if (searchInput) {
          searchInput.value = videoTitle;
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          console.log('Entered video title in search box');
        } else {
          throw new Error("Search input not found");
        }
        
        // Wait for search results
        await sleep(3000);
        
        // Modified: Instead of looking for exact title match, select the first video in search results
        const videoCards = document.querySelectorAll("ytcp-entity-card");
        if (videoCards && videoCards.length > 0) {
          // Click on the first video card
          videoCards[0].click();
          console.log('Selected the first video from search results');
        } else {
          // If no video cards found, try clicking on the visible video thumbnail
          const videoThumbnail = document.querySelector(".thumbnail-container");
          if (videoThumbnail) {
            videoThumbnail.click();
            console.log('Clicked on video thumbnail');
          } else {
            // As a last resort, try to find any clickable element in the video selection dialog
            const videoItem = document.querySelector(".video-item");
            if (videoItem) {
              videoItem.click();
              console.log('Clicked on video item');
            } else {
              throw new Error("No video found in search results");
            }
          }
        }
        
        // Wait for selection to be processed
        await sleep(1000);
        
        // Check if error dialog appears and handle it
        const errorDialog = document.querySelector(".error-dialog");
        if (errorDialog) {
          const okButton = errorDialog.querySelector("button");
          if (okButton) {
            okButton.click();
            console.log('Closed error dialog');
          }
          
          // Try clicking on the visible video again
          const visibleVideo = document.querySelector(".thumbnail-container");
          if (visibleVideo) {
            visibleVideo.click();
            console.log('Clicked on visible video after error');
          }
        }
        
        // Wait for a moment before clicking save
        await sleep(2000);
        
        // Click the save button using multiple selectors to increase chances of finding it
        let saveButtonClicked = false;
        
        // Try using the Lưu button text
        const saveButtons = Array.from(document.querySelectorAll('button')).filter(button => 
          button.textContent.includes('Lưu')
        );
        
        if (saveButtons.length > 0) {
          saveButtons[0].click();
          saveButtonClicked = true;
          console.log('Clicked save button by text content');
        }
        
        // If text search didn't work, try CSS selector
        if (!saveButtonClicked) {
          const saveButtonCSS = document.querySelector("div.yt-spec-touch-feedback-shape--touch-response-inverse");
          if (saveButtonCSS) {
            saveButtonCSS.click();
            saveButtonClicked = true;
            console.log('Clicked save button using CSS selector');
          }
        }
        
        // If CSS selector didn't work, try XPath
        if (!saveButtonClicked) {
          await waitAndClick("//button[contains(., 'Lưu')]", "Save button not found", 5000);
          saveButtonClicked = true;
          console.log('Clicked save button using XPath');
        }
        
        if (saveButtonClicked) {
          console.log('Save button clicked, waiting for confirmation...');
          
          // Wait for the save confirmation message "Đã lưu thay đổi"
          const saveConfirmed = await waitForElement(
            "//div[contains(text(), 'Đã lưu thay đổi')]", 
            "//span[contains(text(), 'Đã lưu thay đổi')]",
            "//tp-yt-paper-toast[contains(., 'Đã lưu thay đổi')]"
          );
          
          if (saveConfirmed) {
            console.log('Save confirmation message appeared, save successful');
            
            // Wait for the confirmation message to disappear
            await sleep(2000);
            
            // Check if the confirmation message is gone
            const confirmationGone = !(await elementExists(
              "//div[contains(text(), 'Đã lưu thay đổi')]", 
              "//span[contains(text(), 'Đã lưu thay đổi')]",
              "//tp-yt-paper-toast[contains(., 'Đã lưu thay đổi')]"
            ));
            
            if (confirmationGone) {
              console.log('Save confirmation message has disappeared');
            } else {
              console.log('Save confirmation message still visible, waiting a bit longer');
              await sleep(3000); // Wait a bit longer if message is still visible
            }
            
            // Wait an additional second before clicking back
            await sleep(1000);
            
            // Click the back button to return to the previous page
            let backButtonClicked = false;
            
            // Try the first selector from XPath Helper
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
            
            // Try the exact XPath from the screenshot
            if (!backButtonClicked) {
              try {
                await waitAndClick("//tp-yt-paper-icon-button[@id='back-button']", "Back button not found", 5000);
                backButtonClicked = true;
                console.log('Clicked back button using exact XPath');
              } catch (e) {
                console.log('Error clicking back button with exact XPath:', e);
              }
            }
            
            // Try the CSS selector from the screenshot
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
              // Thử các phương pháp khác để quay lại trang trước
              try {
                window.history.back();
                backButtonClicked = true;
                console.log('Used browser history back() as fallback');
              } catch (e) {
                console.log('Error using history.back():', e);
              }
            }
            
            if (backButtonClicked) {
              console.log('Đã quay lại trang danh sách video');
              // Chờ trang danh sách video tải
              await sleep(3000);
              
              // Tăng chỉ số video để xử lý video tiếp theo
              videoIndex++;
            } else {
              console.warn('Không thể quay lại trang danh sách video, kết thúc quy trình');
              continueProcessing = false;
            }
          } else {
            console.warn('Save confirmation message did not appear');
            continueProcessing = false;
          }
        } else {
          console.warn('Could not find save button');
          continueProcessing = false;
        }
      } catch (error) {
        console.error(`Lỗi khi xử lý video thứ ${videoIndex}:`, error);
        // Nếu có lỗi với video hiện tại, thử chuyển sang video tiếp theo
        try {
          // Thử quay lại trang danh sách video
          window.history.back();
          await sleep(3000);
          videoIndex++;
        } catch (e) {
          console.error('Không thể tiếp tục sau lỗi:', e);
          continueProcessing = false;
        }
      }
    }
    
    console.log('Đã hoàn thành xử lý tất cả video');
    
  } catch (error) {
    console.error('Error in process:', error);
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
  const timeout = 15000; // 15 seconds timeout
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
  
  return false; // Timeout reached, element not found
}

// Helper function to get element by XPath
function getElementByXPath(xpath) {
  return document.evaluate(
    xpath, 
    document, 
    null, 
    XPathResult.FIRST_ORDERED_NODE_TYPE, 
    null
  ).singleNodeValue;
}

// Helper function to check if any of the elements exist
async function elementExists(...xpaths) {
  for (const xpath of xpaths) {
    const element = getElementByXPath(xpath);
    if (element) {
      return true;
    }
  }
  return false;
}

// Helper function to sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}