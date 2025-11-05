// OctoLite Scraper — background.js
// จัดเก็บผลลัพธ์, ประสานงาน message, และ helper สำหรับ export


const RESULT_KEY = "octolite_results";
const JOB_KEY = "octolite_job"; // เก็บ last job config


chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ [RESULT_KEY]: [], [JOB_KEY]: null });
});


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
        try {
            if (msg.type === "STORE_RESULTS") {
                const cur = (await chrome.storage.local.get(RESULT_KEY))[RESULT_KEY] || [];
                const next = cur.concat(msg.payload || []);
                await chrome.storage.local.set({ [RESULT_KEY]: next });
                sendResponse({ ok: true, count: next.length });
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


            if (msg.type === "DOWNLOAD_BLOB") {
                // ใช้ chrome.downloads สำหรับไฟล์ CSV/JSON
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