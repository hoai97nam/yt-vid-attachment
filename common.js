function commonFunction(param) {
  // Add your common logic here
  console.log('Common function called with:', param);
  return param;
}

function getElementXPath(element) {
  // Chỉ xử lý nếu là Element Node
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  // Trường hợp đặc biệt: Nếu là thẻ gốc HTML
  if (element.tagName.toLowerCase() === 'html') {
    return '/html';
  }

  const pathSegments = [];
  let currentElement = element;

  while (currentElement && currentElement.nodeType === Node.ELEMENT_NODE) {
    let segment = currentElement.nodeName.toLowerCase();
    const parent = currentElement.parentNode;

    // Nếu không có parent hoặc parent không phải Element (ví dụ: document)
    // hoặc là thẻ body/html thì không cần chỉ số vị trí (thường là duy nhất)
    if (!parent || parent.nodeType !== Node.ELEMENT_NODE || segment === 'body' || segment === 'html') {
       // Chỉ thêm thẻ html một lần ở cuối
       if (segment !== 'html') {
           pathSegments.unshift(segment);
       }
    } else {
      // Tính chỉ số vị trí của element này trong số các anh chị em CÙNG TÊN THẺ
      let index = 1;
      let sibling = currentElement.previousElementSibling; // Chỉ xét Element siblings
      while (sibling) {
        // Chỉ tăng index nếu sibling trước đó có cùng tên thẻ
        if (sibling.nodeName.toLowerCase() === segment) {
          index++;
        }
        sibling = sibling.previousElementSibling;
      }
      segment += `[${index}]`;
      pathSegments.unshift(segment);
    }

    // Di chuyển lên node cha để tiếp tục vòng lặp
    currentElement = parent;
  }

  // Kết hợp các đoạn thành XPath hoàn chỉnh, bắt đầu bằng /html
  return pathSegments.length ? '/html/' + pathSegments.join('/') : '';
}
/**
 * Tìm các phần tử con/cháu bên trong mội phần tử cha dựa vào XPath tương đối.
 *
 * @param {string} parentXPath - XPath để xác định (các) phần tử cha, tìm kiếm từ gốc document.
 * @param {string} childRelativeXPath - XPath *tương đối* để tìm các phần tử con/cháu
 * BÊN TRONG mỗi phần tử cha tìm được.
 * QUAN TRỌNG: Phải bắt đầu bằng dấu chấm '.' (ví dụ: './/div[@class="con"]').
 * @param {Node} [rootContextNode=document] - Node gốc để bắt đầu tìm phần tử cha (thường là document).
 * @returns {Array<Node>} - Một mảng phẳng (flat array) chứa tất cả các phần tử con/cháu tìm được
 * từ tất cả các phần tử cha khớp với parentXPath. Trả về mảng rỗng nếu không tìm thấy.
 */
function findChildElementsByXPath(parentXPath, childRelativeXPath, rootContextNode = document) {
  const allFoundChildren = []; // Mảng để chứa tất cả các con/cháu tìm được
  const allChildXPaths = []; // Mảng để chứa tất cả các con/cháu tìm được

  // --- Bước 1: Tìm (các) phần tử cha ---
  try {
    // Sử dụng snapshot để dễ lặp qua các phần tử cha
    const parentQuery = document.evaluate(
      parentXPath,
      rootContextNode,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );

    console.log(`Tìm thấy ${parentQuery.snapshotLength} phần tử cha với XPath: ${parentXPath}`);

    // --- Bước 2: Lặp qua từng phần tử cha tìm được ---
    for (let i = 0; i < parentQuery.snapshotLength; i++) {
      const parentElement = parentQuery.snapshotItem(i);
      
      // --- Bước mới: Tìm các row-container có chứa checkmark ---
      try {
        // Tìm tất cả các row-container trong phần tử cha
        const rowContainers = document.evaluate(
          './/*[@id="row-container"]',
          parentElement,
          null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null
        );
        
        console.log(`Tìm thấy ${rowContainers.snapshotLength} row-container trong phần tử cha thứ ${i+1}`);
        
        // Lặp qua từng row-container
        for (let j = 0; j < rowContainers.snapshotLength; j++) {
          const rowContainer = rowContainers.snapshotItem(j);
          
          // Kiểm tra xem row-container này có chứa checkmark không
          const hasCheckmark = document.evaluate(
            './/*[@id="checkmark"]',
            rowContainer,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          ).singleNodeValue !== null;
          
          if (hasCheckmark) {
            console.log(`Row-container thứ ${j+1} có chứa checkmark`);
            
            // Tìm phần tử con theo childRelativeXPath trong row-container này
            try {
              const targetElements = document.evaluate(
                childRelativeXPath,
                rowContainer,
                null,
                XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                null
              );
              
              for (let k = 0; k < targetElements.snapshotLength; k++) {
                const targetElement = targetElements.snapshotItem(k);
                if (targetElement && targetElement.nodeType === Node.ELEMENT_NODE) {
                  const targetXPath = getElementXPath(targetElement);
                  if (targetXPath) {
                    allChildXPaths.push(targetXPath);
                    console.log(`Đã thêm phần tử con với XPath: ${targetXPath}`);
                  }
                }
              }
            } catch (targetError) {
              console.error(
                `Lỗi khi tìm phần tử con theo XPath "${childRelativeXPath}" trong row-container có checkmark:`,
                targetError
              );
            }
          } else {
            console.log(`Row-container thứ ${j+1} không chứa checkmark, bỏ qua`);
          }
        }
      } catch (rowContainerError) {
        console.error(
          `Lỗi khi tìm row-container trong phần tử cha thứ ${i+1}:`,
          rowContainerError
        );
      }

      // --- Bước 3: Nếu không tìm thấy row-container hoặc không có row-container nào có checkmark,
      // thì tìm theo cách cũ (tìm trực tiếp childRelativeXPath trong parentElement) ---
      if (allChildXPaths.length === 0) {
        try {
          // Sử dụng iterator cho việc tìm con cháu trong mỗi cha
          const childQuery = document.evaluate(
            childRelativeXPath, // XPath tương đối cho con/cháu
            parentElement,     // Ngữ cảnh là phần tử cha!
            null,
            XPathResult.ORDERED_NODE_ITERATOR_TYPE,
            null
          );

          let childNode = childQuery.iterateNext();
          while (childNode) {
            // Đảm bảo chỉ lấy XPath cho Element Node
            if (childNode.nodeType === Node.ELEMENT_NODE) {
              const childXPath = getElementXPath(childNode); // Tạo XPath cho phần tử con
              if (childXPath) { // Chỉ thêm nếu tạo XPath thành công
                allChildXPaths.push(childXPath);
              }
            }
            childNode = childQuery.iterateNext();
          }
        } catch (childError) {
          console.error(
            `Lỗi khi tìm con/cháu bằng XPath "${childRelativeXPath}" bên trong phần tử cha thứ ${i + 1} (${parentXPath}):`,
            parentElement,
            childError
          );
        }
      }
    }
  } catch (parentError) {
    console.error(`Lỗi khi tìm phần tử cha bằng XPath "${parentXPath}":`, parentError);
  }

  console.log(`Tổng cộng tìm thấy ${allChildXPaths.length} phần tử con phù hợp với điều kiện`);
  return allChildXPaths;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Tìm phần tử trên trang bằng XPath và thực hiện click sau một khoảng thời gian chờ.
 *
 * @param {string} xpathExpression - Biểu thức XPath để tìm phần tử cần click.
 * @param {number} [delayMs=500] - Thời gian chờ (tính bằng mili giây) trước khi click. Mặc định là 500ms.
 */
function clickElementByXPath(xpath) {
  return new Promise((resolve, reject) => {
    // Log cho bước click cụ thể này
    console.log(`   [Hành động Click] Đang tìm và click: ${xpath}`);
    try {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      const element = result.singleNodeValue;

      if (element) {
        if (typeof element.click === 'function') {
          try {
            element.click();
            console.log(`   [Hành động Click] Đã click thành công vào:`, element);
            resolve(element); // Hoàn thành, trả về element đã click
          } catch (clickError) {
            console.error(`   [Hành động Click] Lỗi khi click (XPath: "${xpath}"):`, clickError, element);
            reject(clickError); // Thất bại do lỗi click
          }
        } else {
          console.warn(`   [Hành động Click] Phần tử tìm thấy nhưng không có hàm .click(): ${xpath}`, element);
          reject(new Error(`Phần tử tìm thấy nhưng không có hàm .click(): ${xpath}`)); // Thất bại
        }
      } else {
        console.warn(`   [Hành động Click] Không tìm thấy phần tử: ${xpath}`);
        reject(new Error(`Không tìm thấy phần tử: ${xpath}`)); // Thất bại do không tìm thấy
      }
    } catch (findError) {
      console.error(`   [Hành động Click] Lỗi khi tìm phần tử (XPath: "${xpath}"):`, findError);
      reject(findError); // Thất bại do lỗi tìm kiếm
    }
  });
}

async function thucHienClickTuantuVoiDelay(xpaths, delayBetweenClicksMs) {
  console.log(`--- BẮT ĐẦU CHUỖI CLICK TUẦN TỰ (${xpaths.length} bước) ---`);

  // Kiểm tra đầu vào cơ bản
  if (!Array.isArray(xpaths) || xpaths.length === 0) {
    console.log("Danh sách XPath rỗng hoặc không hợp lệ. Kết thúc.");
    return;
  }
  if (typeof delayBetweenClicksMs !== 'number' || delayBetweenClicksMs < 0) {
      console.warn(`Thời gian chờ giữa các click không hợp lệ (${delayBetweenClicksMs}ms). Sử dụng 0ms.`);
      delayBetweenClicksMs = 0;
  }

  // Định nghĩa XPath thay thế cho relatedSettingXPath
  const alternativeRelatedSettingXPath = '//*[@id="linked-video-editor-link"]/ytcp-dropdown-trigger/div/div[2]/span';

  // Lặp qua từng XPath trong danh sách
  for (let i = 0; i < xpaths.length; i++) {
    const currentXPath = xpaths[i];
    console.log(`\n=> BƯỚC ${i + 1}/${xpaths.length}: Chuẩn bị click XPath: ${currentXPath}`);

    try {
      // Kiểm tra xem đây có phải là nút Save không
      const isSaveButton = currentXPath === saveXPath;
      
      // Kiểm tra xem đây có phải là relatedSettingXPath không
      // const isRelatedSetting = currentXPath === relatedSettingXPath;
      
      // Nếu là relatedSettingXPath, thử tìm phần tử trước khi click
      if (i === 2) {
        console.log(`   [Kiểm tra] Đang tìm phần tử relatedSettingXPath: ${currentXPath}`);
        
          const result = document.evaluate(
            currentXPath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          const element = result.singleNodeValue;
          
          // Nếu không tìm thấy phần tử, thử dùng XPath thay thế
        if (!element) {
          console.log(`   [Kiểm tra] Không tìm thấy relatedSettingXPath, thử dùng XPath thay thế: ${alternativeRelatedSettingXPath}`);

          // Thay đổi currentXPath thành XPath thay thế
          const altResult = document.evaluate(
            alternativeRelatedSettingXPath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          const altElement = altResult.singleNodeValue;

          if (altElement) {
            console.log(`   [Kiểm tra] Đã tìm thấy phần tử với XPath thay thế, sẽ sử dụng XPath này để click`);
            // Thay đổi XPath hiện tại thành XPath thay thế
            xpaths[i] = alternativeRelatedSettingXPath;
            // Cập nhật currentXPath
            currentXPath = alternativeRelatedSettingXPath;
          } else {
            console.log(`   [Kiểm tra] Không tìm thấy cả XPath thay thế, sẽ thử click XPath ban đầu`);
          }
        }        
      }
      
      // Đợi (await) cho đến khi hàm clickElementByXPath hoàn thành (resolve hoặc reject)
      const clickedElement = await clickElementByXPath(currentXPath);
      console.log(`<= BƯỚC ${i + 1}: Đã hoàn thành click thành công cho XPath: ${currentXPath}`);

      // Nếu chưa phải bước cuối cùng, đợi (await) một khoảng thời gian
      if (i < xpaths.length - 1) {
        console.log(`   [Chờ] Đợi ${delayBetweenClicksMs}ms trước khi thực hiện bước tiếp theo...`);
        await delay(delayBetweenClicksMs);
        console.log(`   [Chờ] Đã đợi xong.`);
      } else {
        console.log(`<= BƯỚC ${i + 1}: Đã là bước cuối cùng.`);
        
        // Thêm hành động quay lại trang trước sau khi hoàn thành bước cuối cùng
        console.log(`   [Chờ] Đợi ${delayBetweenClicksMs}ms sau khi hoàn thành bước cuối cùng...`);
        await delay(delayBetweenClicksMs);
        
        console.log(`   [Hành động] Đang quay lại trang trước đó...`);
        window.history.back();
        
        // Đợi cho việc điều hướng hoàn tất
        const navigationDelay = delayBetweenClicksMs * 1.5;
        console.log(`   [Chờ] Đợi ${navigationDelay}ms cho trang trước tải xong...`);
        await delay(navigationDelay);
        console.log(`   [Hành động] Đã quay lại trang trước đó thành công.`);
      }

    } catch (error) {
      // Nếu có lỗi xảy ra ở bất kỳ bước nào (tìm hoặc click)
      console.error(`*** LỖI ở BƯỚC ${i + 1} (XPath: ${currentXPath}):`, error.message || error);
      
      // Kiểm tra xem đây có phải là nút Save không
      if (currentXPath === saveXPath) {
        console.log(`   [Xử lý đặc biệt] Phát hiện lỗi khi click nút Save. Bỏ qua và tiếp tục...`);
        
        // Nếu là bước cuối cùng, thực hiện quay lại trang trước
        if (i === xpaths.length - 1) {
          console.log(`   [Chờ] Đợi ${delayBetweenClicksMs}ms sau khi bỏ qua bước Save...`);
          await delay(delayBetweenClicksMs);
          
          console.log(`   [Hành động] Đang quay lại trang trước đó...`);
          window.history.back();
          
          // Đợi cho việc điều hướng hoàn tất
          const navigationDelay = delayBetweenClicksMs * 1.5;
          console.log(`   [Chờ] Đợi ${navigationDelay}ms cho trang trước tải xong...`);
          await delay(navigationDelay);
          console.log(`   [Hành động] Đã quay lại trang trước đó thành công.`);
        } else {
          // Nếu không phải bước cuối cùng, đợi một khoảng thời gian trước khi tiếp tục
          console.log(`   [Chờ] Đợi ${delayBetweenClicksMs}ms trước khi thực hiện bước tiếp theo...`);
          await delay(delayBetweenClicksMs);
          console.log(`   [Chờ] Đã đợi xong.`);
        }
        
        // Tiếp tục với bước tiếp theo
        continue;
      }
      
      // Kiểm tra xem đây có phải là relatedSettingXPath không và thử dùng XPath thay thế
      if (currentXPath === relatedSettingXPath) {
        console.log(`   [Xử lý đặc biệt] Phát hiện lỗi khi click relatedSettingXPath. Thử dùng XPath thay thế...`);
        
        try {
          console.log(`   [Hành động Click] Đang tìm và click XPath thay thế: ${alternativeRelatedSettingXPath}`);
          const altElement = await clickElementByXPath(alternativeRelatedSettingXPath);
          console.log(`   [Hành động Click] Đã click thành công vào XPath thay thế`);
          
          // Nếu click thành công, đợi một khoảng thời gian trước khi tiếp tục
          console.log(`   [Chờ] Đợi ${delayBetweenClicksMs}ms trước khi thực hiện bước tiếp theo...`);
          await delay(delayBetweenClicksMs);
          console.log(`   [Chờ] Đã đợi xong.`);
          
          // Tiếp tục với bước tiếp theo
          continue;
        } catch (altError) {
          console.error(`   [Hành động Click] Lỗi khi click XPath thay thế:`, altError.message || altError);
          // Nếu cả XPath thay thế cũng không click được, dừng chuỗi click
          console.log("--- DỪNG CHUỖI CLICK do gặp lỗi ở cả XPath chính và XPath thay thế ---");
          return;
        }
      }
      
      console.log("--- DỪNG CHUỖI CLICK do gặp lỗi ---");
      // Quyết định dừng toàn bộ chuỗi khi có lỗi
      return; // Thoát khỏi hàm
    }
  }

  console.log(`\n--- HOÀN THÀNH TẤT CẢ CÁC BƯỚC TRONG CHUỖI CLICK ---`);
}


// 1. XPath để tìm các div cha có class 'parent-box'
//   const parentContainerXPath = '//div[@class="parent-box"]';
// const parentContainerXPath = '//ytcp-video-section-content[@class="style-scope ytcp-video-section"]';

// 2. XPath TƯƠNG ĐỐI để tìm TẤT CẢ các phần tử con/cháu có class 'item'
//    BÊN TRONG mỗi parent-box. Bắt đầu bằng ".//"
const childItemRelativeXPath = './/a[@class="remove-default-style style-scope ytcp-video-list-cell-video"]'; // Tìm bất kỳ phần tử nào có class 'item' ở bất kỳ cấp nào bên trong cha

// 3. XPath TƯƠNG ĐỐI để tìm CHỈ các thẻ <p> là con TRỰC TIẾP có class 'item'
//    BÊN TRONG mỗi parent-box. Bắt đầu bằng "./"
const directChildPRelativeXPath = './p[@class="item"]';

// const relatedSettingXPath = '/html/body/ytcp-app/ytcp-entity-page/div/div/main/div/ytcp-animatable[10]/ytcp-video-details-section/ytcp-video-metadata-editor/ytcp-video-metadata-editor-sidepanel/ytcp-shorts-content-links-picker/ytcp-text-dropdown-trigger/ytcp-dropdown-trigger/div/div[3]/tp-yt-iron-icon';

// const targetRelatedXPath = '/html/body/ytcp-video-pick-dialog/ytcp-dialog/tp-yt-paper-dialog/div[2]/div/ytcp-video-pick-dialog-contents/div/div/div/ytcp-entity-card[1]/div/div[1]';
// const targetRelatedXPath = '//div[@class="thumbnail style-scope ytcp-entity-card"][1]';
// const saveXPath = '/html/body/ytcp-app/ytcp-entity-page/div/div/main/div/ytcp-animatable[10]/ytcp-video-details-section/ytcp-sticky-header/ytcp-entity-page-header/div/div[2]/ytcp-button[2]/ytcp-button-shape/button/yt-touch-feedback-shape/div/div[2]';
// These will be set from the popup
let parentContainerXPath = '//ytcp-video-section-content[@class="style-scope ytcp-video-section"]';
// let targetRelatedXPath = '//div[@class="thumbnail style-scope ytcp-entity-card"][1]';
let targetRelatedXPath = '//*[@id="img-with-fallback"]';
let delayBetweenClicksMs = 2000;

const relatedSettingXPath = '/html/body/ytcp-app/ytcp-entity-page/div/div/main/div/ytcp-animatable[10]/ytcp-video-details-section/ytcp-video-metadata-editor/ytcp-video-metadata-editor-sidepanel/ytcp-shorts-content-links-picker/ytcp-text-dropdown-trigger/ytcp-dropdown-trigger/div/div[3]/tp-yt-iron-icon';
const saveXPath = '/html/body/ytcp-app/ytcp-entity-page/div/div/main/div/ytcp-animatable[10]/ytcp-video-details-section/ytcp-sticky-header/ytcp-entity-page-header/div/div[2]/ytcp-button[2]/ytcp-button-shape/button/yt-touch-feedback-shape/div/div[2]';

// Function to find items and execute the click sequence
async function executeClickSequence(customTargetXPath, customDelayTime, forChildren = false) {
  try {
    // Use custom values if provided, otherwise use defaults
    const actualParentXPath = parentContainerXPath;
    const actualTargetXPath = customTargetXPath || targetRelatedXPath;
    const actualDelayTime = customDelayTime || delayBetweenClicksMs;
    
    console.log(`Using Parent XPath: ${actualParentXPath}`);
    console.log(`Using Target XPath: ${actualTargetXPath}`);
    console.log(`Using Delay Time: ${actualDelayTime}ms`);
    console.log(`Content for children: ${forChildren ? 'Yes' : 'No'}`);
    
    // Find all items based on the provided parent XPath
    const allItems = findChildElementsByXPath(actualParentXPath, childItemRelativeXPath);
    
    console.log(`Found a total of ${allItems.length} items to process`);
    console.log(allItems);
    // Check if there are any items to process
    if (!allItems || allItems.length === 0) {
      console.log("No items found to process.");
      return;
    }
    
    console.log(`Starting sequential processing for ${allItems.length} items.`);
    
    // Define the XPath for "Made for Kids" options based on forChildren parameter
    const madeForKidsXPath = forChildren 
      ? '//*[@id="audience"]/ytkc-made-for-kids-select/div[4]/tp-yt-paper-radio-group/tp-yt-paper-radio-button[1]' // Yes, it's made for kids
      : '//*[@id="audience"]/ytkc-made-for-kids-select/div[4]/tp-yt-paper-radio-group/tp-yt-paper-radio-button[2]'; // No, it's not made for kids
    
    // Alternative XPath for related settings
    const alternativeRelatedSettingXPath = '//*[@id="linked-video-editor-link"]/ytcp-dropdown-trigger/div/div[2]/span';
    
    // Process each item in the allItems array
    for (let i = 0; i < allItems.length; i = i+2) {
      console.log(`\n=== PROCESSING ITEM ${i+1}/${allItems.length} ===`);
      
      // Define the click sequence with the "Made for Kids" option
      const clickSequence = [
        allItems[i],                // Click on the video item
        madeForKidsXPath,           // Click on the appropriate "Made for Kids" option
        relatedSettingXPath,        // Click on related settings
        actualTargetXPath,          // Click on target related content
        saveXPath                   // Click on save button
      ];
      
      console.log(`Click sequence for item ${i+1}:`, clickSequence);
      
      // Execute sequential clicks with the specified delay between clicks
      await thucHienClickTuantuVoiDelay(clickSequence, actualDelayTime);
      
      // If not the last item, wait a bit before processing the next item
      if (i < allItems.length - 1) {
        const betweenItemsDelay = 3000; // 3 seconds between items
        console.log(`Waiting ${betweenItemsDelay}ms before processing next item...`);
        await delay(betweenItemsDelay);
      }
    }
    
    console.log("\n=== COMPLETED PROCESSING ALL ITEMS ===");
    return { success: true, itemsProcessed: allItems.length };
  } catch (error) {
    console.error('Error during click sequence execution:', error);
    return { success: false, error: error.message };
  }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "executeClickSequence") {
    console.log("Received request to execute click sequence");
    
    // Execute the click sequence with the provided parameters
    executeClickSequence(
      request.targetXPath, 
      request.delayTime,
      request.forChildren // Pass the forChildren parameter
    )
      .then(result => {
        if (result.success) {
          sendResponse({ status: 'success', itemsProcessed: result.itemsProcessed });
        } else {
          sendResponse({ status: 'error', message: result.error });
        }
      })
      .catch(error => {
        sendResponse({ status: 'error', message: error.message });
      });
    
    // Return true to indicate that sendResponse will be called asynchronously
    return true;
  }
});

// Export if using modules