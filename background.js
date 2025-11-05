// OctoLite Scraper — background.js
// จัดเก็บผลลัพธ์, ประสานงาน message, และ helper สำหรับ export

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