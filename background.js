// OctoLite Scraper — background.js
// จัดเก็บผลลัพธ์, ประสานงาน message, และ helper สำหรับ export
// เพิ่มเติม: จัดการกับการเรียก API โดยตรง

const RESULT_KEY = "octolite_results";
const JOB_KEY = "octolite_job"; // เก็บ last job config
const SOURCE_KEY = "octolite_source"; // เก็บข้อมูล source URL
const TEMP_SELECTOR_KEY = "octolite_temp_selector"; // เก็บ selector ชั่วคราว

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ 
        [RESULT_KEY]: [], 
        [JOB_KEY]: null, 
        [SOURCE_KEY]: "",
        [TEMP_SELECTOR_KEY]: ""
    });
});

// ช่วยให้ popup ที่เปิดใหม่รู้ว่ากำลังอยู่ใน selector mode หรือไม่
let isPickerActive = false;

// ฟังก์ชันช่วยดึงข้อมูลจาก object โดย path (รองรับ nested path ด้วยจุด ".")
function getNestedValue(obj, path) {
    if (!path) return obj;
    const keys = path.split('.');
    return keys.reduce((o, key) => (o && o[key] !== undefined) ? o[key] : null, obj);
}

// ฟังก์ชันช่วยสำหรับการ map ข้อมูลจาก API ไปยัง schema ที่ต้องการ
function mapApiData(item, mapping) {
    if (!item || !mapping) return item;
    
    const result = {};
    for (const [resultField, apiField] of Object.entries(mapping)) {
        result[resultField] = getNestedValue(item, apiField);
    }
    
    return result;
}

// ฟังก์ชันสำหรับเรียก API
async function callApi(config) {
    const {
        url,
        method = 'GET',
        contentType = 'application/json',
        headers = {},
        body,
        throttleMs = 0
    } = config;
    
    if (!url) {
        throw new Error('URL is required');
    }
    
    // เตรียม headers
    const requestHeaders = { ...headers };
    if (contentType && !requestHeaders['Content-Type']) {
        requestHeaders['Content-Type'] = contentType;
    }
    
    // เตรียม body
    let requestBody = body;
    if (body && contentType === 'application/json' && typeof body === 'string') {
        try {
            // แปลง body string เป็น object ถ้าจำเป็น
            const bodyObj = JSON.parse(body);
            requestBody = bodyObj;
        } catch (e) {
            console.error('Error parsing JSON body:', e);
        }
    }
    
    // Throttle ถ้ากำหนด
    if (throttleMs > 0) {
        await new Promise(resolve => setTimeout(resolve, throttleMs));
    }
    
    // เตรียม request options
    const options = {
        method,
        headers: requestHeaders
    };
    
    // เพิ่ม body สำหรับ POST/PUT
    if (method !== 'GET' && method !== 'HEAD' && requestBody) {
        if (contentType === 'application/json') {
            if (typeof requestBody !== 'string') {
                options.body = JSON.stringify(requestBody);
            } else {
                options.body = requestBody;
            }
        } else if (contentType === 'application/x-www-form-urlencoded') {
            if (typeof requestBody === 'string') {
                options.body = requestBody;
            } else {
                // แปลง object เป็น URL encoded
                const params = new URLSearchParams();
                for (const key in requestBody) {
                    params.append(key, requestBody[key]);
                }
                options.body = params.toString();
            }
        } else {
            // สำหรับ content type อื่น ๆ
            options.body = requestBody;
        }
    }
    
    // เรียก API
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    // แปลงการตอบกลับตาม content type
    const responseContentType = response.headers.get('Content-Type') || '';
    if (responseContentType.includes('application/json')) {
        return await response.json();
    } else {
        return await response.text();
    }
}

// ฟังก์ชันหลักสำหรับ API scraping
async function runApiScrape(config) {
    const {
        url,
        method = 'GET',
        contentType = 'application/json',
        headers = {},
        body,
        dataPath,
        mapping = {},
        pagination = {
            type: 'page',
            param: 'page',
            start: '1',
            increment: '1',
            maxPages: 5,
            cursorPath: ''
        },
        throttleMs = 1000
    } = config;
    
    let allResults = [];
    let currentPage = pagination.start;
    let nextCursor = null;
    
    try {
        for (let i = 0; i < pagination.maxPages; i++) {
            // สร้าง request config
            const apiConfig = {
                url: url,
                method,
                contentType,
                headers,
                body: body,
                throttleMs: i > 0 ? throttleMs : 0 // ไม่ throttle สำหรับ request แรก
            };
            
            // แก้ไข URL หรือ body ตามประเภทการแบ่งหน้า
            if (pagination.type !== 'none') {
                // แปลง body string เป็น object ถ้าจำเป็น
                let bodyObj = {};
                if (typeof body === 'string') {
                    try {
                        bodyObj = JSON.parse(body);
                    } catch (e) {
                        console.error('Error parsing JSON body:', e);
                        bodyObj = {};
                    }
                } else if (body && typeof body === 'object') {
                    bodyObj = { ...body };
                }
                
                if (pagination.type === 'cursor' && i > 0) {
                    // ใช้ cursor จาก response ก่อนหน้า
                    if (!nextCursor && pagination.type === 'cursor') {
                        // ไม่มี cursor ถัดไป ออกจากลูป
                        break;
                    }
                    
                    if (method === 'GET') {
                        // เพิ่ม cursor ใน URL params
                        const urlObj = new URL(url);
                        urlObj.searchParams.set(pagination.param, nextCursor);
                        apiConfig.url = urlObj.toString();
                    } else {
                        // เพิ่ม cursor ใน body
                        bodyObj[pagination.param] = nextCursor;
                        apiConfig.body = JSON.stringify(bodyObj);
                    }
                } else {
                    // แบ่งหน้าแบบ page number หรือ offset
                    if (method === 'GET') {
                        // เพิ่ม page param ใน URL
                        const urlObj = new URL(url);
                        urlObj.searchParams.set(pagination.param, currentPage);
                        apiConfig.url = urlObj.toString();
                    } else {
                        // เพิ่ม page param ใน body
                        bodyObj[pagination.param] = currentPage;
                        apiConfig.body = JSON.stringify(bodyObj);
                    }
                    
                    // เพิ่มค่าตาม increment (สำหรับการแบ่งหน้าแบบตัวเลข)
                    if (pagination.type === 'page' || pagination.type === 'offset') {
                        const increment = Number(pagination.increment) || 1;
                        currentPage = String(Number(currentPage) + increment);
                    }
                }
            }
            
            // เรียก API
            const response = await callApi(apiConfig);
            
            // แยกข้อมูลตาม dataPath
            let items = [];
            if (dataPath) {
                items = getNestedValue(response, dataPath) || [];
            } else {
                // ถ้าไม่มี dataPath แต่ response เป็น array ให้ใช้ response เลย
                items = Array.isArray(response) ? response : [response];
            }
            
            // ถ้าไม่มีข้อมูล หรือเป็น array ว่างเปล่า ให้ออกจากลูป
            if (!items || (Array.isArray(items) && items.length === 0)) {
                break;
            }
            
            // แปลงข้อมูลตาม mapping
            const mappedItems = Array.isArray(items)
                ? items.map(item => mapApiData(item, mapping))
                : [mapApiData(items, mapping)];
            
            // เพิ่มข้อมูลลงใน results
            allResults.push(...mappedItems);
            
            // หา cursor ถัดไปถ้ามี
            if (pagination.type === 'cursor' && pagination.cursorPath) {
                nextCursor = getNestedValue(response, pagination.cursorPath);
                // ถ้าไม่พบ cursor ถัดไป ให้ออกจากลูป
                if (!nextCursor) {
                    break;
                }
            }
        }
        
        return { results: allResults };
    } catch (error) {
        throw new Error(`API scraping failed: ${error.message}`);
    }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
        try {
            if (msg.type === "STORE_RESULTS") {
                const cur = (await chrome.storage.local.get(RESULT_KEY))[RESULT_KEY] || [];
                const next = cur.concat(msg.payload || []);
                
                // เพิ่ม source และ scraped_at ให้ผลลัพธ์ทุกแถว
                const sourceURL = (await chrome.storage.local.get(SOURCE_KEY))[SOURCE_KEY] || "";
                const domain = sourceURL ? new URL(sourceURL).hostname : "";
                const now = new Date().toISOString();
                
                for (const row of next) {
                    if (!row.source && domain) row.source = domain;
                    if (!row.scraped_at) row.scraped_at = now;
                }
                
                await chrome.storage.local.set({ [RESULT_KEY]: next });
                sendResponse({ ok: true, count: next.length });
                return;
            }

            if (msg.type === "STORE_SOURCE") {
                await chrome.storage.local.set({ [SOURCE_KEY]: msg.payload || "" });
                sendResponse({ ok: true });
                return;
            }

            if (msg.type === "CLEAR_RESULTS") {
                await chrome.storage.local.set({ [RESULT_KEY]: [] });
                sendResponse({ ok: true });
                return;
            }

            if (msg.type === "GET_RESULTS") {
                const res = (await chrome.storage.local.get(RESULT_KEY))[RESULT_KEY] || [];
                sendResponse({ ok: true, results: res });
                return;
            }

            if (msg.type === "SET_JOB") {
                await chrome.storage.local.set({ [JOB_KEY]: msg.payload || null });
                sendResponse({ ok: true });
                return;
            }

            if (msg.type === "GET_JOB") {
                const val = (await chrome.storage.local.get(JOB_KEY))[JOB_KEY] || null;
                sendResponse({ ok: true, job: val });
                return;
            }

            if (msg.type === "START_PICK") {
                isPickerActive = true;
                sendResponse({ ok: true });
                return;
            }

            if (msg.type === "STOP_PICK") {
                isPickerActive = false;
                sendResponse({ ok: true });
                return;
            }

            if (msg.type === "IS_PICKER_ACTIVE") {
                sendResponse({ active: isPickerActive });
                return;
            }

            if (msg.type === "SELECTOR_PICKED") {
                // เก็บ selector ที่เลือกไว้ใน storage
                await chrome.storage.local.set({ [TEMP_SELECTOR_KEY]: msg.selector || "" });
                
                // อัปเดต flag
                isPickerActive = false;
                
                // แจ้งเตือนด้วย chrome.notifications ถ้าต้องการ
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icons/icon48.png',
                    title: 'OctoLite Scraper',
                    message: 'Selector บันทึกแล้ว: ' + msg.selector,
                    priority: 2
                });
                
                sendResponse({ ok: true });
                return;
            }

            if (msg.type === "GET_TEMP_SELECTOR") {
                const selector = (await chrome.storage.local.get(TEMP_SELECTOR_KEY))[TEMP_SELECTOR_KEY] || "";
                sendResponse({ selector });
                return;
            }

            if (msg.type === "CLEAR_TEMP_SELECTOR") {
                await chrome.storage.local.set({ [TEMP_SELECTOR_KEY]: "" });
                sendResponse({ ok: true });
                return;
            }

            if (msg.type === "DOWNLOAD_BLOB") {
                // ใช้ chrome.downloads สำหรับไฟล์ CSV/JSON/TXT/SQL
                const { url, filename } = msg.payload || {};
                if (url && filename) {
                    await chrome.downloads.download({ url, filename });
                    sendResponse({ ok: true });
                } else {
                    sendResponse({ ok: false, error: "missing url/filename" });
                }
                return;
            }
            
            // API scraping: รับคำสั่งจาก popup และส่งต่อไปยัง background worker
            if (msg.type === "RUN_API_SCRAPE") {
                try {
                    // บันทึก source domain
                    const sourceUrl = msg.payload.url;
                    if (sourceUrl) {
                        const domain = new URL(sourceUrl).hostname;
                        await chrome.storage.local.set({ [SOURCE_KEY]: sourceUrl });
                    }
                    
                    // เรียก API และรับผลลัพธ์
                    const { results } = await runApiScrape(msg.payload);
                    
                    // เพิ่ม source และ scraped_at
                    const domain = sourceUrl ? new URL(sourceUrl).hostname : "";
                    const now = new Date().toISOString();
                    
                    for (const row of results) {
                        if (!row.source && domain) row.source = domain;
                        if (!row.scraped_at) row.scraped_at = now;
                    }
                    
                    // บันทึกผลลัพธ์
                    const cur = (await chrome.storage.local.get(RESULT_KEY))[RESULT_KEY] || [];
                    const next = cur.concat(results);
                    await chrome.storage.local.set({ [RESULT_KEY]: next });
                    
                    sendResponse({ 
                        ok: true, 
                        added: results.length, 
                        total: next.length
                    });
                } catch (error) {
                    sendResponse({ 
                        ok: false, 
                        error: "API scraping failed", 
                        details: error.message
                    });
                }
                return;
            }
        } catch (e) {
            console.error(e);
            sendResponse({ ok: false, error: String(e) });
        }
    })();
    return true; // keep channel open for async
});

// เพิ่ม permissions ที่จำเป็น
chrome.permissions.contains({
    permissions: ['notifications']
}, (result) => {
    if (!result) {
        chrome.permissions.request({
            permissions: ['notifications']
        });
    }
});