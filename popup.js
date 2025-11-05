// OctoLite Scraper — popup.js (แก้ไข)
const $ = (q) => document.querySelector(q);
const $$ = (q) => document.querySelectorAll(q);
const logEl = $('#log');
const modeEl = $('#mode');
const simpleSec = $('#simpleSec');
const ldSec = $('#ldSec');
const recordCountEl = $('#recordCount');

// สร้าง connection เพื่อตรวจจับการปิด popup
const popupPort = chrome.runtime.connect({ name: "octolite-popup" });

function log(m) { 
    logEl.textContent += m + '\n'; 
    logEl.scrollTop = logEl.scrollHeight; // Auto-scroll
}

function clearLog() { 
    logEl.textContent = ''; 
}

function updateRecordCount(count) {
    recordCountEl.textContent = count;
}

// ฟังก์ชันเช็คว่า tab ปัจจุบันสามารถรัน content scripts ได้หรือไม่
async function canInjectContentScript(tabId) {
    try {
        const tab = await chrome.tabs.get(tabId);
        // ไม่สามารถรัน content scripts ใน chrome:// urls, extension pages, etc.
        return tab.url && !tab.url.startsWith('chrome://') && 
               !tab.url.startsWith('chrome-extension://') && 
               !tab.url.startsWith('about:');
    } catch (e) {
        console.error('Error checking tab:', e);
        return false;
    }
}

// ฟังก์ชันสำหรับทดสอบว่า content script พร้อมหรือไม่
async function isContentScriptReady(tabId) {
    try {
        // ตรวจสอบว่าสามารถรัน content script ในแท็บนี้ได้หรือไม่
        if (!await canInjectContentScript(tabId)) {
            return false;
        }

        // ส่ง ping ไปยัง content script
        const response = await chrome.tabs.sendMessage(tabId, { type: 'PING_CONTENT' })
            .catch(e => {
                // จัดการกับข้อผิดพลาดเมื่อ content script ไม่ตอบกลับ
                console.log('Content script not ready:', e);
                return null;
            });
        
        return response && response.ok;
    } catch (e) {
        console.error('Error checking content script:', e);
        return false;
    }
}

// ฟังก์ชันสำหรับตรวจสอบว่าหน้าที่เปิดสามารถใช้งาน extension ได้หรือไม่
async function checkCurrentTab() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab) {
            log('❌ ไม่พบแท็บที่กำลังใช้งาน');
            return false;
        }
        
        // ตรวจสอบว่าเป็น URL ที่สามารถรัน content script ได้หรือไม่
        if (!await canInjectContentScript(tab.id)) {
            log(`❌ ไม่สามารถใช้งาน extension ในหน้านี้ได้: ${tab.url}`);
            log('โปรดเปิด extension ในหน้าเว็บปกติ (เช่น https://, http://)');
            return false;
        }
        
        // ทดสอบติดต่อกับ content script
        const isReady = await isContentScriptReady(tab.id);
        if (!isReady) {
            log('❌ Content script ยังไม่พร้อมทำงาน');
            log('ลองรีเฟรชหน้าเว็บและเปิด extension อีกครั้ง');
            return false;
        }
        
        return true;
    } catch (e) {
        log(`❌ เกิดข้อผิดพลาด: ${e.message}`);
        console.error('Error checking current tab:', e);
        return false;
    }
}

// ตรวจจับการเปลี่ยนโหมด
modeEl.addEventListener('change', () => {
    const v = modeEl.value;
    
    // ซ่อน/แสดงส่วนต่าง ๆ ตามโหมด
    if (v === 'simple') {
        // Simple mode
        $$('.dommode-section').forEach(el => el.style.display = '');
        $$('.apimode-section').forEach(el => el.style.display = 'none');
        simpleSec.style.display = '';
        ldSec.style.display = 'none';
    } else if (v === 'listDetail') {
        // List-Detail mode
        $$('.dommode-section').forEach(el => el.style.display = '');
        $$('.apimode-section').forEach(el => el.style.display = 'none');
        simpleSec.style.display = 'none';
        ldSec.style.display = '';
    } else if (v === 'api') {
        // API mode
        $$('.dommode-section').forEach(el => el.style.display = 'none');
        $$('.apimode-section').forEach(el => el.style.display = '');
        simpleSec.style.display = 'none';
        ldSec.style.display = 'none';
    }
});

// Handle API pagination type change
$('#apiPagType').addEventListener('change', (e) => {
    const type = e.target.value;
    $('#apiCursorDiv').style.display = type === 'cursor' ? '' : 'none';
});

$('#infEnabled').addEventListener('change', (e) => {
    $('#infCfg').style.display = e.target.checked ? '' : 'none';
});

$('#pick').addEventListener('click', async () => {
    clearLog();
    
    try {
        // ตรวจสอบว่า content script พร้อมใช้งาน
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!await checkCurrentTab()) {
            return;
        }
        
        // แจ้ง background ว่าเริ่มโหมด picker
        await chrome.runtime.sendMessage({ type: 'START_PICK' });
        
        // แจ้ง content script ให้เริ่มทำงาน
        await chrome.tabs.sendMessage(tab.id, { type: 'START_PICK' })
            .catch(e => {
                log(`❌ ไม่สามารถเริ่มโหมด selector ได้: ${e.message}`);
                console.error('Error starting picker:', e);
                return;
            });
        
        log('🔍 Pick mode: เปิดโหมดเลือก selector แล้ว หากหน้าต่างนี้ปิดให้เลือกต่อได้เลย กด ESC เพื่อยกเลิก');
        log('🔔 หลังเลือกเสร็จ กรุณาเปิด popup นี้อีกครั้งเพื่อนำ selector มาใช้');
    } catch (e) {
        log(`❌ เกิดข้อผิดพลาด: ${e.message}`);
        console.error('Error in pick button handler:', e);
    }
});

// ตรวจสอบและโหลด selector ที่บันทึกไว้เมื่อเปิด popup
async function checkForSavedSelector() {
    try {
        const resp = await chrome.runtime.sendMessage({ type: 'GET_TEMP_SELECTOR' });
        if (resp && resp.selector) {
            log('พบ Selector ที่เลือกไว้: ' + resp.selector);
            
            try {
                const fields = JSON.parse($('#fields').value || '[]');
                if (fields.length) {
                    fields[0].selector = resp.selector;
                    $('#fields').value = JSON.stringify(fields, null, 2);
                    log('อัปเดต selector ในฟิลด์แรกแล้ว');
                }
            } catch (e) {
                log('Error: Invalid JSON in Fields');
            }
            
            // ล้าง selector ชั่วคราวหลังจากใช้แล้ว
            chrome.runtime.sendMessage({ type: 'CLEAR_TEMP_SELECTOR' });
        }
    } catch (e) {
        console.error('Error checking for saved selector:', e);
    }
}

// ฟังก์ชันเพื่อดึงข้อมูล XHR
$('#inspect').addEventListener('click', async () => {
    clearLog();
    
    try {
        // ตรวจสอบว่า content script พร้อมใช้งาน
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!await checkCurrentTab()) {
            // ถ้าไม่สามารถใช้งาน content script ได้
            // ลองดึงข้อมูลผลลัพธ์จาก background เพื่อแสดงจำนวน records
            try {
                const resultsResp = await chrome.runtime.sendMessage({ type: 'GET_RESULTS' });
                if (resultsResp?.ok) {
                    updateRecordCount(resultsResp.results.length);
                    log(`ข้อมูลที่บันทึกไว้: ${resultsResp.results.length} รายการ`);
                }
            } catch (e) {
                console.error('Error getting results:', e);
            }
            return;
        }
        
        // ตรวจสอบสถานะเว็บเพจและ background
        const res = await chrome.tabs.sendMessage(tab.id, { type: 'PING_CONTENT' })
            .catch(e => {
                log('❌ ไม่สามารถติดต่อกับหน้าเว็บได้');
                console.error('Error pinging content:', e);
                return null;
            });
            
        if (res?.ok) log(`📄 Page: ${res.title} — ${res.url}`);
        
        // ใช้สำหรับโหมด API: ดึงข้อมูล XHR ล่าสุดจาก console
        const xhrRes = await chrome.tabs.sendMessage(tab.id, { type: 'INSPECT_XHR' })
            .catch(e => {
                log('⚠️ ไม่สามารถดึงข้อมูล XHR ได้');
                console.error('Error inspecting XHR:', e);
                return null;
            });
            
        if (xhrRes?.ok && xhrRes.requests && xhrRes.requests.length) {
            log(`📡 พบ ${xhrRes.requests.length} XHR requests ล่าสุด`);
            
            // แสดงตัวอย่าง request แรกและเติมลงในฟอร์ม
            const firstReq = xhrRes.requests[0];
            
            // เปลี่ยนโหมดเป็น API
            $('#mode').value = 'api';
            modeEl.dispatchEvent(new Event('change'));
            
            // เติมข้อมูล
            $('#apiUrl').value = firstReq.url;
            $('#apiMethod').value = firstReq.method || 'GET';
            
            // เติม Headers
            try {
                const headers = firstReq.headers || {};
                $('#apiHeaders').value = JSON.stringify(headers, null, 2);
            } catch (e) {
                $('#apiHeaders').value = "{}";
            }
            
            // เติม Body
            try {
                if (firstReq.body) {
                    $('#apiBody').value = typeof firstReq.body === 'string' 
                        ? firstReq.body 
                        : JSON.stringify(firstReq.body, null, 2);
                }
            } catch (e) {
                $('#apiBody').value = "{}";
            }
            
            // เติม Content-Type ถ้ามี
            if (firstReq.headers && firstReq.headers['Content-Type']) {
                const contentType = firstReq.headers['Content-Type'];
                if (contentType.includes('json')) {
                    $('#apiContentType').value = 'application/json';
                } else if (contentType.includes('form')) {
                    $('#apiContentType').value = 'application/x-www-form-urlencoded';
                }
            }
            
            // ถ้ามีข้อมูลการตอบกลับ ทำการวิเคราะห์โครงสร้างข้อมูลและเสนอ mapping
            if (firstReq.response) {
                try {
                    const respData = typeof firstReq.response === 'string'
                        ? JSON.parse(firstReq.response)
                        : firstReq.response;
                    
                    // พยายามตรวจจับว่าข้อมูลหลักอยู่ที่ไหนในการตอบกลับ
                    let dataPath = '';
                    let dataObj = respData;
                    
                    // ตรวจสอบโครงสร้างข้อมูลทั่วไปที่ API มักใช้
                    const commonPaths = ['data', 'items', 'results', 'list', 'content'];
                    
                    for (const path of commonPaths) {
                        if (respData[path] && Array.isArray(respData[path])) {
                            dataPath = path;
                            dataObj = respData[path];
                            break;
                        } else if (respData[path] && typeof respData[path] === 'object') {
                            // ตรวจสอบโครงสร้างซ้อน
                            for (const nestedPath of commonPaths) {
                                if (respData[path][nestedPath] && Array.isArray(respData[path][nestedPath])) {
                                    dataPath = `${path}.${nestedPath}`;
                                    dataObj = respData[path][nestedPath];
                                    break;
                                }
                            }
                        }
                    }
                    
                    // ตั้งค่า data path
                    if (dataPath) {
                        $('#apiDataPath').value = dataPath;
                        
                        // ถ้าเป็น array ตรวจสอบ item แรกเพื่อสร้าง mapping
                        if (Array.isArray(dataObj) && dataObj.length > 0) {
                            const firstItem = dataObj[0];
                            const mapping = {};
                            
                            // ตรวจสอบฟิลด์และสร้าง mapping
                            for (const key in firstItem) {
                                // แปลงชื่อฟิลด์เป็นชื่อที่ใช้งานง่าย
                                const niceName = key.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
                                mapping[niceName] = key;
                            }
                            
                            $('#apiMapping').value = JSON.stringify(mapping, null, 2);
                            
                            // ตรวจสอบการแบ่งหน้า
                            if (typeof respData === 'object') {
                                // ตรวจสอบ pagination แบบต่าง ๆ
                                if (respData.next_page || respData.nextPage) {
                                    $('#apiPagType').value = 'page';
                                    $('#apiPagParam').value = 'page';
                                } else if (respData.next_cursor || respData.nextCursor) {
                                    $('#apiPagType').value = 'cursor';
                                    $('#apiPagParam').value = 'cursor';
                                    $('#apiCursorPath').value = respData.next_cursor ? 'next_cursor' : 'nextCursor';
                                    $('#apiCursorDiv').style.display = '';
                                } else if (respData.next || respData.next_url) {
                                    $('#apiPagType').value = 'cursor';
                                    $('#apiPagParam').value = 'url';
                                    $('#apiCursorPath').value = respData.next ? 'next' : 'next_url';
                                    $('#apiCursorDiv').style.display = '';
                                }
                            }
                        }
                    }
                } catch (e) {
                    log('ไม่สามารถแปลงข้อมูลการตอบกลับได้: ' + e.message);
                }
            }
        } else {
            log('⚠️ ไม่พบ XHR requests (อาจต้องรีเฟรชหน้าก่อน)');
        }
        
        const resultsResp = await chrome.runtime.sendMessage({ type: 'GET_RESULTS' });
        if (resultsResp?.ok) {
            updateRecordCount(resultsResp.results.length);
            log(`📊 ข้อมูลที่บันทึกไว้: ${resultsResp.results.length} รายการ`);
        }
        
        // เช็คสถานะ picker ด้วย
        const pickerResp = await chrome.runtime.sendMessage({ type: 'IS_PICKER_ACTIVE' });
        if (pickerResp?.active) {
            log('⚠️ Selector picker ยังทำงานอยู่ — คลิกที่องค์ประกอบหรือกด ESC เพื่อจบการทำงาน');
        }
    } catch (e) {
        log('❌ Error: ' + e.message);
        console.error('Error in inspect handler:', e);
    }
});

$('#addField').addEventListener('click', () => {
    try {
        const fields = JSON.parse($('#fields').value || '[]');
        fields.push({name: "new_field", selector: ".selector", attr: "text"});
        $('#fields').value = JSON.stringify(fields, null, 2);
    } catch (e) {
        log('Error: Invalid JSON in Fields');
    }
});

$('#addDetailField').addEventListener('click', () => {
    try {
        const fields = JSON.parse($('#detailFields').value || '[]');
        fields.push({name: "detail_field", selector: ".selector", attr: "text"});
        $('#detailFields').value = JSON.stringify(fields, null, 2);
    } catch (e) {
        log('Error: Invalid JSON in Detail Fields');
    }
});

$('#run').addEventListener('click', async () => {
    clearLog();
    
    try {
        // เตรียม job config ตามโหมดที่เลือก
        const mode = $('#mode').value;
        let job = { 
            mode,
            throttleMs: num($('#throttleMs').value, 0),
            dataOptions: {
                cleanData: $('#cleanData').checked,
                absoluteURLs: $('#absoluteURLs').checked
            }
        };

        // เพิ่มข้อมูลตามโหมด
        if (mode === 'simple' || mode === 'listDetail') {
            // DOM Scraping Mode
            job.fields = safeJSON($('#fields').value);
            
            if (mode === 'simple') {
                job.pagination = {
                    nextSel: $('#nextSel').value,
                    maxPages: num($('#maxPages').value, 1),
                    pauseMs: num($('#pauseMs').value, 1200)
                };
                job.infinite = $('#infEnabled').checked ? {
                    enabled: true,
                    step: num($('#infStep').value, 900),
                    pauseMs: num($('#infPause').value, 800),
                    maxSteps: num($('#infMax').value, 25)
                } : { enabled: false };
            } else if (mode === 'listDetail') {
                job.listDetail = {
                    listLinkSel: $('#listLinkSel').value,
                    detailFields: safeJSON($('#detailFields').value),
                    limit: num($('#ldLimit').value, 30),
                    backMode: $('#ldBack').value,
                    pauseMs: num($('#ldPause').value, 1200)
                };
            }
            
            // ตรวจสอบว่า content script พร้อมใช้งาน
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!await checkCurrentTab()) {
                log('❌ ไม่สามารถรันในหน้านี้ได้');
                return;
            }

            // บันทึก job config
            await chrome.runtime.sendMessage({ type: 'SET_JOB', payload: job });
            await chrome.runtime.sendMessage({ type: 'CLEAR_RESULTS' });
            updateRecordCount(0);

            log(`🔍 กำลังทำงานในโหมด ${mode}...`);
            
            // DOM scraping modes
            const res = await chrome.tabs.sendMessage(tab.id, { 
                type: 'SCRAPE_RUN', 
                payload: job
            }).catch(e => {
                log(`❌ เกิดข้อผิดพลาด: ${e.message}`);
                console.error('Error sending message to content script:', e);
                return null;
            });
            
            if (res?.ok) {
                log(`✅ Scraped: +${res.added} rows (total ${res.total}).`);
                updateRecordCount(res.total);
            } else if (res) {
                log('❌ Error: ' + (res?.error || 'unknown'));
            }
        } else if (mode === 'api') {
            // API Scraping Mode
            job.api = {
                url: $('#apiUrl').value,
                method: $('#apiMethod').value,
                contentType: $('#apiContentType').value,
                headers: safeJSON($('#apiHeaders').value),
                body: $('#apiBody').value, // ไม่แปลงเป็น JSON เพราะอาจเป็นรูปแบบอื่น
                dataPath: $('#apiDataPath').value,
                mapping: safeJSON($('#apiMapping').value),
                pagination: {
                    type: $('#apiPagType').value,
                    param: $('#apiPagParam').value,
                    start: $('#apiPagStart').value,
                    increment: $('#apiPagIncrement').value,
                    maxPages: num($('#apiMaxPages').value, 5),
                    cursorPath: $('#apiCursorPath').value
                },
                throttleMs: num($('#apiThrottleMs').value, 1000)
            };

            // บันทึก job config
            await chrome.runtime.sendMessage({ type: 'SET_JOB', payload: job });
            await chrome.runtime.sendMessage({ type: 'CLEAR_RESULTS' });
            updateRecordCount(0);

            // ทำงานในโหมด API (ใช้ background เป็นหลักเพื่อลด CORS issues)
            log(`🌐 กำลังทำงานในโหมด API...`);
            const res = await chrome.runtime.sendMessage({ 
                type: 'RUN_API_SCRAPE', 
                payload: job.api
            }).catch(e => {
                log(`❌ เกิดข้อผิดพลาดในการเรียก API: ${e.message}`);
                console.error('Error in API scrape:', e);
                return null;
            });
            
            if (res?.ok) {
                log(`✅ ดึงข้อมูล API สำเร็จ: ${res.added} รายการ`);
                updateRecordCount(res.total || res.added);
            } else if (res) {
                log('❌ เกิดข้อผิดพลาด: ' + (res?.error || 'unknown'));
                if (res?.details) {
                    log('รายละเอียด: ' + res.details);
                }
            }
        }
    } catch (e) {
        log(`❌ เกิดข้อผิดพลาด: ${e.message}`);
        console.error('Error in run handler:', e);
    }
});

$('#clear').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'CLEAR_RESULTS' });
    updateRecordCount(0);
    clearLog();
    log('ล้างข้อมูลเรียบร้อย');
});

$('#exportCsv').addEventListener('click', async () => {
    const rows = await getResults();
    if (rows.length === 0) {
        log('No data to export.');
        return;
    }
    
    try {
        const csv = toCSV(rows);
        const url = blobURL(csv, 'text/csv;charset=utf-8');
        const timestamp = new Date().toISOString().replace(/[:.-]/g, '_').replace('T', '_').split('_').slice(0, 4).join('-');
        const filename = `octolite_${timestamp}.csv`;
        
        await chrome.runtime.sendMessage({ 
            type: 'DOWNLOAD_BLOB', 
            payload: { url, filename } 
        });
        
        log(`✅ Exported CSV: ${rows.length} rows`);
    } catch (e) {
        log(`❌ Export error: ${e.message}`);
        console.error('Error exporting CSV:', e);
    }
});

$('#exportJson').addEventListener('click', async () => {
    const rows = await getResults();
    if (rows.length === 0) {
        log('No data to export.');
        return;
    }
    
    try {
        const url = blobURL(JSON.stringify(rows, null, 2), 'application/json;charset=utf-8');
        const timestamp = new Date().toISOString().replace(/[:.-]/g, '_').replace('T', '_').split('_').slice(0, 4).join('-');
        const filename = `octolite_${timestamp}.json`;
        
        await chrome.runtime.sendMessage({ 
            type: 'DOWNLOAD_BLOB', 
            payload: { url, filename } 
        });
        
        log(`✅ Exported JSON: ${rows.length} rows`);
    } catch (e) {
        log(`❌ Export error: ${e.message}`);
        console.error('Error exporting JSON:', e);
    }
});

$('#exportTxt').addEventListener('click', async () => {
    const rows = await getResults();
    if (rows.length === 0) {
        log('No data to export.');
        return;
    }
    
    try {
        // TSV format
        const headers = Array.from(rows.reduce((set, r) => { 
            Object.keys(r).forEach(k => set.add(k)); 
            return set; 
        }, new Set()));
        
        const lines = [headers.join('\t')];
        for (const r of rows) {
            lines.push(headers.map(h => r[h] != null ? String(r[h]).replace(/\t/g, ' ') : '').join('\t'));
        }
        
        const url = blobURL(lines.join('\n'), 'text/plain;charset=utf-8');
        const timestamp = new Date().toISOString().replace(/[:.-]/g, '_').replace('T', '_').split('_').slice(0, 4).join('-');
        const filename = `octolite_${timestamp}.txt`;
        
        await chrome.runtime.sendMessage({ 
            type: 'DOWNLOAD_BLOB', 
            payload: { url, filename } 
        });
        
        log(`✅ Exported TXT (TSV): ${rows.length} rows`);
    } catch (e) {
        log(`❌ Export error: ${e.message}`);
        console.error('Error exporting TXT:', e);
    }
});

$('#exportSql').addEventListener('click', async () => {
    const rows = await getResults();
    if (rows.length === 0) {
        log('No data to export.');
        return;
    }
    
    try {
        const tableName = 'scraped_data';
        
        // Create table schema
        const columns = Array.from(rows.reduce((set, r) => { 
            Object.keys(r).forEach(k => set.add(k)); 
            return set; 
        }, new Set()));
        
        let sql = `CREATE TABLE IF NOT EXISTS ${tableName} (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n`;
        sql += columns.map(col => {
            let type = 'TEXT';
            if (col === 'scraped_at') type = 'DATETIME';
            if (col === 'posted_at') type = 'DATE';
            if (col === 'price' && rows.some(r => !isNaN(parseFloat(r[col]?.replace(/[^\d.,]/g, ''))))) type = 'NUMERIC';
            return `  ${col} ${type}`;
        }).join(',\n');
        sql += '\n);\n\n';
        
        // Generate INSERT statements
        sql += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES\n`;
        
        const escapeSQL = (val) => {
            if (val == null) return 'NULL';
            return "'" + String(val).replace(/'/g, "''") + "'";
        };
        
        sql += rows.map(row => {
            return `(${columns.map(col => escapeSQL(row[col])).join(', ')})`;
        }).join(',\n');
        
        sql += ';';
        
        const url = blobURL(sql, 'text/plain;charset=utf-8');
        const timestamp = new Date().toISOString().replace(/[:.-]/g, '_').replace('T', '_').split('_').slice(0, 4).join('-');
        const filename = `octolite_${timestamp}.sql`;
        
        await chrome.runtime.sendMessage({ 
            type: 'DOWNLOAD_BLOB', 
            payload: { url, filename } 
        });
        
        log(`✅ Exported SQL: ${rows.length} rows`);
    } catch (e) {
        log(`❌ Export error: ${e.message}`);
        console.error('Error exporting SQL:', e);
    }
});

function num(v, d) { 
    const n = Number(v); 
    return Number.isFinite(n) ? n : d; 
}

function safeJSON(s) { 
    try { 
        return JSON.parse(s || '[]'); 
    } catch (e) { 
        log(`⚠️ Invalid JSON: ${e.message}`);
        return []; 
    } 
}

async function getResults() {
    try {
        const res = await chrome.runtime.sendMessage({ type: 'GET_RESULTS' });
        return res?.results || [];
    } catch (e) {
        console.error('Error getting results:', e);
        return [];
    }
}

function blobURL(text, mime) {
    const blob = new Blob([text], { type: mime });
    return URL.createObjectURL(blob);
}

function toCSV(rows) {
    if (!rows.length) return '';
    const headers = Array.from(rows.reduce((set, r) => { 
        Object.keys(r).forEach(k => set.add(k)); 
        return set; 
    }, new Set()));
    
    const esc = (s) => (s == null ? '' : String(s).replace(/"/g, '""'));
    const lines = [headers.map(h => `"${h}"`).join(',')];
    
    for (const r of rows) {
        lines.push(headers.map(h => `"${esc(r[h])}"`).join(','));
    }
    
    return lines.join('\n');
}

// โหลด job เดิมกลับเข้าฟอร์ม (optional)
async function initFromJob(){
    try {
        const resp = await chrome.runtime.sendMessage({ type: 'GET_JOB' });
        const job = resp?.job;
        if (!job) return;
        
        $('#mode').value = job.mode || 'simple';
        
        if (job.mode === 'simple' || job.mode === 'listDetail') {
            $('#fields').value = JSON.stringify(job.fields || [], null, 2);
            
            if (job.mode === 'simple') {
                $('#nextSel').value = job.pagination?.nextSel || '';
                $('#maxPages').value = job.pagination?.maxPages ?? 1;
                $('#pauseMs').value = job.pagination?.pauseMs ?? 1200;
                $('#throttleMs').value = job.throttleMs ?? 0;

                $('#infEnabled').checked = !!job.infinite?.enabled;
                $('#infStep').value = job.infinite?.step ?? 900;
                $('#infPause').value = job.infinite?.pauseMs ?? 800;
                $('#infMax').value = job.infinite?.maxSteps ?? 25;
                $('#infCfg').style.display = $('#infEnabled').checked ? '' : 'none';
            } else if (job.mode === 'listDetail') {
                $('#listLinkSel').value = job.listDetail?.listLinkSel || '';
                $('#detailFields').value = JSON.stringify(job.listDetail?.detailFields || [], null, 2);
                $('#ldLimit').value = job.listDetail?.limit ?? 30;
                $('#ldBack').value = job.listDetail?.backMode || 'history';
                $('#ldPause').value = job.listDetail?.pauseMs ?? 1200;
            }
        } else if (job.mode === 'api' && job.api) {
            // โหลดการตั้งค่า API
            $('#apiUrl').value = job.api.url || '';
            $('#apiMethod').value = job.api.method || 'GET';
            $('#apiContentType').value = job.api.contentType || 'application/json';
            $('#apiHeaders').value = JSON.stringify(job.api.headers || {}, null, 2);
            $('#apiBody').value = job.api.body || '';
            $('#apiDataPath').value = job.api.dataPath || '';
            $('#apiMapping').value = JSON.stringify(job.api.mapping || {}, null, 2);
            
            // โหลดการตั้งค่าแบ่งหน้า
            if (job.api.pagination) {
                $('#apiPagType').value = job.api.pagination.type || 'page';
                $('#apiPagParam').value = job.api.pagination.param || 'page';
                $('#apiPagStart').value = job.api.pagination.start || '1';
                $('#apiPagIncrement').value = job.api.pagination.increment || '1';
                $('#apiMaxPages').value = job.api.pagination.maxPages || 5;
                $('#apiCursorPath').value = job.api.pagination.cursorPath || '';
                $('#apiCursorDiv').style.display = job.api.pagination.type === 'cursor' ? '' : 'none';
            }
            
            $('#apiThrottleMs').value = job.api.throttleMs || 1000;
        }
        
        if (job.dataOptions) {
            $('#cleanData').checked = job.dataOptions.cleanData ?? true;
            $('#absoluteURLs').checked = job.dataOptions.absoluteURLs ?? true;
        }

        // อัปเดต UI ตามโหมด
        modeEl.dispatchEvent(new Event('change'));
    } catch (e) {
        console.error('Error initializing from job:', e);
    }
    
    // อัปเดต record count
    try {
        const resultsResp = await chrome.runtime.sendMessage({ type: 'GET_RESULTS' });
        if (resultsResp?.ok) {
            updateRecordCount(resultsResp.results.length);
        }
    } catch (e) {
        console.error('Error updating record count:', e);
    }
}

// เมื่อโหลดหน้า
document.addEventListener('DOMContentLoaded', async () => {
    try {
        clearLog();
        log('🔄 กำลังโหลด OctoLite Scraper...');
        
        // โหลด job เดิม
        await initFromJob();
        
        // ตรวจสอบ selector ที่บันทึกไว้
        await checkForSavedSelector();
        
        // ตรวจสอบสถานะ picker
        const pickerResp = await chrome.runtime.sendMessage({ type: 'IS_PICKER_ACTIVE' });
        if (pickerResp?.active) {
            log('⚠️ Selector picker กำลังทำงานอยู่ในแท็บนี้');
            log('คลิกที่องค์ประกอบหรือกด ESC เพื่อจบการทำงาน');
        }
        
        // ตรวจสอบสถานะแท็บ
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            log('❌ ไม่พบแท็บที่กำลังใช้งาน');
            return;
        }
        
        if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://'))) {
            log('⚠️ ไม่สามารถใช้งาน Selector หรือ DOM Scraping ในหน้านี้ได้');
            log('โปรดเปิด extension ในหน้าเว็บปกติ (https://, http://)');
            log('คุณยังสามารถใช้โหมด API ได้');
        } else {
            // ทดสอบติดต่อกับ content script
            const isReady = await isContentScriptReady(tab.id);
            if (!isReady) {
                log('⚠️ Content script ยังไม่พร้อมทำงาน');
                log('คุณอาจต้องรีเฟรชหน้าเว็บและเปิด extension อีกครั้ง');
                log('คุณยังสามารถใช้โหมด API ได้');
            } else {
                log('✅ พร้อมใช้งานแล้ว');
            }
        }
    } catch (e) {
        log(`❌ เกิดข้อผิดพลาดในการเริ่มต้น: ${e.message}`);
        console.error('Error in DOMContentLoaded:', e);
    }
});