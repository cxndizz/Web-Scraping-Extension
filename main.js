// BrowserHarvest - main.js (Electron app)
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const url = require('url');

// เก็บหน้าต่างแอปหลัก
let mainWindow;
// เก็บ browser ที่ควบคุมด้วย Playwright
let browser = null;
let page = null;

// สร้างหน้าต่างหลัก
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'assets/icon.png')
  });

  // โหลด UI หลัก
  mainWindow.loadFile('index.html');

  // เปิด DevTools ในโหมดพัฒนา (ปิดในโหมดผลิต)
  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
    closeBrowser();
  });
}

// เริ่มแอพเมื่อ Electron พร้อม
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeBrowser().then(() => {
      app.quit();
    });
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ฟังก์ชันปิด browser
async function closeBrowser() {
  if (browser) {
    try {
      await browser.close();
    } catch (e) {
      console.error('Error closing browser:', e);
    }
    browser = null;
    page = null;
  }
}

// ฟังก์ชันเปิดเว็บด้วย URL ที่กำหนด
ipcMain.handle('open-website', async (event, url) => {
  try {
    // ปิด browser ก่อนหน้าถ้ามี
    await closeBrowser();
    
    // สร้าง browser ใหม่
    browser = await chromium.launch({
      headless: false,  // แสดง browser ให้ผู้ใช้เห็น
      args: ['--start-maximized'] // เปิดแบบเต็มจอ
    });
    
    const context = await browser.newContext({
      viewport: null,  // ใช้ขนาดหน้าต่างจากการ maximize
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36'
    });
    
    page = await context.newPage();
    
    // ตั้งค่า event listener เพื่อจับภาพหน้าจอและข้อมูลเมื่อโหลดเสร็จ
    page.on('load', async () => {
      const screenshot = await page.screenshot({ type: 'jpeg', quality: 80 });
      mainWindow.webContents.send('page-loaded', {
        url: page.url(),
        title: await page.title(),
        screenshot: screenshot.toString('base64')
      });
    });
    
    // เปิดเว็บไซต์
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    return { success: true, message: "เปิดเว็บไซต์สำเร็จ" };
  } catch (error) {
    console.error('Error opening website:', error);
    return { success: false, message: `เกิดข้อผิดพลาด: ${error.message}` };
  }
});

// เลือก selector จากเว็บ
ipcMain.handle('select-element', async (event, targetType) => {
  if (!page) {
    return { success: false, message: "ยังไม่ได้เปิด browser" };
  }
  
  try {
    // ใส่ script เพื่อช่วยในการเลือก element
    await page.evaluate(() => {
      if (!window._browserHarvestHelper) {
        window._browserHarvestHelper = true;
        
        // สร้าง overlay เพื่อไฮไลต์ element
        const overlay = document.createElement('div');
        overlay.id = 'bh-selector-overlay';
        overlay.style.cssText = 'position:absolute;pointer-events:none;border:2px dashed #ff5722;background:rgba(255,87,34,0.1);z-index:999999;display:none;';
        document.body.appendChild(overlay);
        
        // tooltip แสดงข้อความ
        const tooltip = document.createElement('div');
        tooltip.id = 'bh-selector-tooltip';
        tooltip.style.cssText = 'position:fixed;padding:6px 12px;background:#333;color:#fff;border-radius:4px;font-size:14px;z-index:999999;pointer-events:none;display:none;';
        document.body.appendChild(tooltip);
        
        // ฟังก์ชันติดตามเมาส์และไฮไลต์ element
        window.bhTrackMouse = (e) => {
          const target = e.target;
          const rect = target.getBoundingClientRect();
          
          overlay.style.top = `${window.scrollY + rect.top}px`;
          overlay.style.left = `${window.scrollX + rect.left}px`;
          overlay.style.width = `${rect.width}px`;
          overlay.style.height = `${rect.height}px`;
          overlay.style.display = 'block';
          
          tooltip.textContent = `<${target.tagName.toLowerCase()}> ${target.className ? '.' + target.className.replace(/\s+/g, '.') : ''}`;
          tooltip.style.top = `${e.clientY + 15}px`;
          tooltip.style.left = `${e.clientX + 15}px`;
          tooltip.style.display = 'block';
        };
        
        // ฟังก์ชันเมื่อคลิก element
        window.bhSelectElement = (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const target = e.target;
          const path = [];
          let el = target;
          
          // สร้าง CSS selector path
          while (el && el.nodeType === 1) {
            let selector = el.nodeName.toLowerCase();
            
            if (el.id) {
              selector += '#' + el.id;
              path.unshift(selector);
              break;
            }
            
            if (el.className) {
              const classes = el.className.trim().split(/\s+/).filter(c => c);
              if (classes.length) {
                selector += '.' + classes.join('.');
              }
            }
            
            // ถ้ามี sibling เดียวกัน ใช้ :nth-child
            const siblings = Array.from(el.parentNode.children).filter(child => child.tagName === el.tagName);
            if (siblings.length > 1) {
              const index = siblings.indexOf(el) + 1;
              selector += `:nth-child(${index})`;
            }
            
            path.unshift(selector);
            el = el.parentNode;
          }
          
          const cssPath = path.join(' > ');
          window._bhSelectedElement = {
            selector: cssPath,
            text: target.innerText && target.innerText.trim(),
            html: target.innerHTML,
            attributes: Array.from(target.attributes).reduce((obj, attr) => {
              obj[attr.name] = attr.value;
              return obj;
            }, {})
          };
          
          // ล้าง event listeners
          document.removeEventListener('mousemove', window.bhTrackMouse);
          document.removeEventListener('click', window.bhSelectElement, true);
          
          // ซ่อน visual helpers
          overlay.style.display = 'none';
          tooltip.style.display = 'none';
          
          return cssPath;
        };
      }
    });
    
    // เริ่มโหมดเลือก element
    await page.evaluate(() => {
      document.addEventListener('mousemove', window.bhTrackMouse);
      document.addEventListener('click', window.bhSelectElement, true);
    });
    
    // แจ้งผู้ใช้ว่าให้คลิกเลือก element
    mainWindow.webContents.send('selection-mode-active', { type: targetType });
    
    // รอให้ผู้ใช้เลือก
    const selectedElement = await page.evaluate(() => {
      return new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (window._bhSelectedElement) {
            clearInterval(checkInterval);
            const selected = window._bhSelectedElement;
            window._bhSelectedElement = null;
            resolve(selected);
          }
        }, 100);
      });
    });
    
    return { 
      success: true, 
      selector: selectedElement.selector,
      text: selectedElement.text,
      type: targetType,
      attributes: selectedElement.attributes
    };
  } catch (error) {
    console.error('Error selecting element:', error);
    return { success: false, message: `เกิดข้อผิดพลาด: ${error.message}` };
  }
});

// ฟังก์ชันเก็บข้อมูลจากหน้าเว็บตาม selectors ที่กำหนด
ipcMain.handle('harvest-data', async (event, config) => {
  if (!page) {
    return { success: false, message: "ยังไม่ได้เปิด browser" };
  }
  
  try {
    const { 
      fields,         // Array of {name, selector, attribute}
      paginationConfig, // {selector, maxPages, currentPage}
      recordLimit     // จำนวน records สูงสุดที่ต้องการ
    } = config;
    
    let allRecords = [];
    let currentPage = paginationConfig?.currentPage || 1;
    const maxPages = paginationConfig?.maxPages || 1;
    
    // ฟังก์ชันเก็บข้อมูลในหน้าปัจจุบัน
    async function scrapeCurrentPage() {
      return await page.evaluate((fields) => {
        // Helper function: ตัด :nth-child(...) ออกจาก selector เพื่อให้ได้หลาย elements
        function normalizeSelector(selector) {
          return selector.replace(/:nth-child\(\d+\)/g, '');
        }

        // Helper function: ดึงค่าจาก element ตาม attribute
        function extractValue(element, attribute) {
          if (!element) return null;

          if (!attribute || attribute === 'text') {
            return element.textContent.trim();
          } else if (attribute === 'html') {
            return element.innerHTML;
          } else {
            return element.getAttribute(attribute);
          }
        }

        // เก็บข้อมูลจากแต่ละ field
        const records = [];

        // Normalize selectors ก่อนใช้งาน
        const normalizedFields = fields.map(field => ({
          ...field,
          normalizedSelector: normalizeSelector(field.selector)
        }));

        console.log('[BrowserHarvest] Fields:', normalizedFields);

        // หา container elements ที่มี child elements ตรงกับ fields
        // วิธีนี้ช่วยให้จับคู่ข้อมูลในแถวเดียวกันได้ถูกต้อง
        let containerSelector = null;
        let maxElements = 0;

        for (const field of normalizedFields) {
          const elements = document.querySelectorAll(field.normalizedSelector);
          console.log(`[BrowserHarvest] Field "${field.name}" with selector "${field.normalizedSelector}" found ${elements.length} elements`);

          if (elements.length > maxElements) {
            maxElements = elements.length;

            // ลองหา parent ร่วมที่เหมาะสม
            if (elements.length > 0) {
              let parent = elements[0].parentElement;
              let level = 0;
              // ไต่ขึ้นไปหา parent ที่มี children แยกกัน (น่าจะเป็น container ของแต่ละรายการ)
              while (parent && level < 10) {
                if (parent.children.length > 1) {
                  const testSelector = parent.tagName.toLowerCase() +
                    (parent.id ? `#${parent.id}` : '') +
                    (parent.className ? `.${parent.className.replace(/\s+/g, '.')}` : '');

                  // ตรวจสอบว่า parent นี้มีหลาย elements ที่เหมือนกันไหม
                  const similarParents = document.querySelectorAll(testSelector);
                  if (similarParents.length >= 2 && similarParents.length <= elements.length * 2) {
                    containerSelector = testSelector;
                    console.log(`[BrowserHarvest] Found container: ${testSelector} (${similarParents.length} containers)`);
                    break;
                  }
                }
                parent = parent.parentElement;
                level++;
              }
            }
          }
        }

        console.log(`[BrowserHarvest] Max elements found: ${maxElements}, Container: ${containerSelector}`);
        
        if (containerSelector && document.querySelectorAll(containerSelector).length > 1) {
          // กรณีมี container ที่ชัดเจน (เช่น .product-item, .card)
          const containers = document.querySelectorAll(containerSelector);
          console.log(`[BrowserHarvest] Using container approach with ${containers.length} containers`);

          containers.forEach((container, idx) => {
            const record = {};

            for (const field of normalizedFields) {
              // ลองหลายวิธีในการค้นหา element ภายใน container
              let element = null;

              // วิธีที่ 1: ใช้ส่วนท้ายของ selector
              const selectorParts = field.normalizedSelector.split(' > ').filter(p => p);
              for (let i = selectorParts.length - 1; i >= 0; i--) {
                const partialSelector = selectorParts.slice(i).join(' > ');
                element = container.querySelector(partialSelector);
                if (element) {
                  console.log(`[BrowserHarvest] Container ${idx}: Found "${field.name}" with partial selector: ${partialSelector}`);
                  break;
                }
              }

              // วิธีที่ 2: ถ้ายังหาไม่เจอ ลองใช้เฉพาะส่วนท้ายสุด
              if (!element) {
                const lastPart = selectorParts[selectorParts.length - 1];
                if (lastPart) {
                  element = container.querySelector(lastPart);
                  if (element) {
                    console.log(`[BrowserHarvest] Container ${idx}: Found "${field.name}" with last part: ${lastPart}`);
                  }
                }
              }

              // ดึงค่าจาก element
              record[field.name] = extractValue(element, field.attribute);
            }

            // เพิ่ม metadata
            record._page = window.location.href;
            record._scraped_at = new Date().toISOString();

            records.push(record);
          });
        } else {
          // กรณีไม่มี container ชัดเจน หรือข้อมูลไม่อยู่ในรูปแบบตาราง
          // ใช้วิธีเทียบจำนวน elements ของแต่ละ field
          console.log(`[BrowserHarvest] Using index-based approach`);

          // ค้นหา field ที่มีจำนวน elements มากที่สุด
          let mainField = null;
          let mainElements = [];

          for (const field of normalizedFields) {
            const elements = document.querySelectorAll(field.normalizedSelector);
            console.log(`[BrowserHarvest] Field "${field.name}" has ${elements.length} elements`);
            if (elements.length > 0 && (!mainField || elements.length > mainElements.length)) {
              mainField = field;
              mainElements = Array.from(elements);
            }
          }

          if (mainField && mainElements.length > 0) {
            console.log(`[BrowserHarvest] Main field: "${mainField.name}" with ${mainElements.length} elements`);

            // สร้าง records ตามจำนวน elements ของ main field
            for (let i = 0; i < mainElements.length; i++) {
              const record = {};

              // เก็บค่าของ main field
              record[mainField.name] = extractValue(mainElements[i], mainField.attribute);

              // พยายามเก็บค่าจาก fields อื่น ๆ ในตำแหน่งเดียวกัน (ถ้ามี)
              for (const field of normalizedFields) {
                if (field === mainField) continue;

                const elements = document.querySelectorAll(field.normalizedSelector);
                if (elements[i]) {
                  record[field.name] = extractValue(elements[i], field.attribute);
                } else {
                  record[field.name] = null;
                }
              }

              // เพิ่ม metadata
              record._page = window.location.href;
              record._scraped_at = new Date().toISOString();

              records.push(record);
            }
          } else if (normalizedFields.length > 0) {
            // กรณีมี field แต่ไม่มี elements เจอ หรือมีแค่ element เดียว (เช่น รายละเอียดสินค้าเดี่ยว)
            console.log(`[BrowserHarvest] Single record mode`);
            const record = {};

            for (const field of normalizedFields) {
              const element = document.querySelector(field.normalizedSelector);

              if (element) {
                record[field.name] = extractValue(element, field.attribute);
              } else {
                record[field.name] = null;
                console.warn(`[BrowserHarvest] Could not find element for "${field.name}" with selector: ${field.normalizedSelector}`);
              }
            }

            // เพิ่ม metadata
            record._page = window.location.href;
            record._scraped_at = new Date().toISOString();

            records.push(record);
          }
        }

        console.log(`[BrowserHarvest] Total records scraped: ${records.length}`);
        if (records.length > 0) {
          console.log(`[BrowserHarvest] First record:`, records[0]);
        }
        
        return records;
      }, fields);
    }
    
    // เก็บข้อมูลจากหน้าแรก
    console.log('[Main] Starting data harvest...');
    const records = await scrapeCurrentPage();
    console.log(`[Main] Scraped ${records.length} records from page ${currentPage}`);
    if (records.length > 0) {
      console.log('[Main] First record sample:', records[0]);
    }
    allRecords = allRecords.concat(records);

    // แจ้งผลลัพธ์กลับไปที่ UI
    mainWindow.webContents.send('harvested-page', {
      page: currentPage,
      records: records,
      totalRecords: allRecords.length
    });
    
    // กรณีมีหลายหน้า และกำหนดการเลื่อนหน้า
    if (paginationConfig && paginationConfig.selector && maxPages > 1) {
      // วนเลื่อนหน้าตามจำนวนที่กำหนด
      while (currentPage < maxPages) {
        // เช็คถ้าเก็บข้อมูลถึงจำนวนที่ต้องการแล้ว
        if (recordLimit && allRecords.length >= recordLimit) {
          break;
        }
        
        // คลิกปุ่ม next หรือปุ่มหมายเลขหน้าถัดไป
        const nextExists = await page.evaluate((selector) => {
          const nextButton = document.querySelector(selector);
          if (nextButton) {
            nextButton.click();
            return true;
          }
          return false;
        }, paginationConfig.selector);
        
        if (!nextExists) {
          break; // ไม่พบปุ่มเลื่อนหน้าแล้ว
        }
        
        // รอให้หน้าโหลดใหม่
        await page.waitForTimeout(2000);
        await page.waitForLoadState('domcontentloaded');
        
        // เพิ่มเลขหน้า
        currentPage++;
        
        // เก็บข้อมูลจากหน้าใหม่
        const pageRecords = await scrapeCurrentPage();
        allRecords = allRecords.concat(pageRecords);
        
        // ตัดให้เหลือแค่จำนวนที่ต้องการ
        if (recordLimit && allRecords.length > recordLimit) {
          allRecords = allRecords.slice(0, recordLimit);
        }
        
        // แจ้งผลลัพธ์กลับไปที่ UI
        mainWindow.webContents.send('harvested-page', {
          page: currentPage,
          records: pageRecords,
          totalRecords: allRecords.length
        });
        
        // delay ก่อนไปหน้าถัดไป
        await page.waitForTimeout(1000);
      }
    }
    
    return {
      success: true,
      totalRecords: allRecords.length,
      records: allRecords,
      lastPage: currentPage
    };
  } catch (error) {
    console.error('Error harvesting data:', error);
    return { success: false, message: `เกิดข้อผิดพลาด: ${error.message}` };
  }
});

// เปิด URL ภายนอก
ipcMain.handle('open-external-url', async (event, externalUrl) => {
  await shell.openExternal(externalUrl);
  return { success: true };
});

// บันทึกไฟล์
ipcMain.handle('save-file', async (event, data) => {
  const { content, fileType, defaultPath } = data;
  
  const options = {
    title: 'บันทึกข้อมูล',
    defaultPath: defaultPath,
    filters: []
  };
  
  // กำหนดประเภทไฟล์ตามที่เลือก
  switch (fileType) {
    case 'csv':
      options.filters.push({ name: 'CSV', extensions: ['csv'] });
      break;
    case 'json':
      options.filters.push({ name: 'JSON', extensions: ['json'] });
      break;
    case 'sql':
      options.filters.push({ name: 'SQL', extensions: ['sql'] });
      break;
    case 'txt':
      options.filters.push({ name: 'Text', extensions: ['txt'] });
      break;
    case 'xlsx':
      options.filters.push({ name: 'Excel', extensions: ['xlsx'] });
      break;
  }
  
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(options);
    if (canceled || !filePath) {
      return { success: false, message: 'การบันทึกถูกยกเลิก' };
    }
    
    fs.writeFileSync(filePath, content);
    return { success: true, filePath };
  } catch (error) {
    console.error('Error saving file:', error);
    return { success: false, message: `เกิดข้อผิดพลาด: ${error.message}` };
  }
});