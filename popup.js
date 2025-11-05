// OctoLite Scraper — popup.js
const $ = (q) => document.querySelector(q);
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

modeEl.addEventListener('change', () => {
    const v = modeEl.value;
    simpleSec.style.display = (v === 'simple') ? '' : 'none';
    ldSec.style.display = (v === 'listDetail') ? '' : 'none';
});

$('#infEnabled').addEventListener('change', (e) => {
    $('#infCfg').style.display = e.target.checked ? '' : 'none';
});

$('#pick').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // แจ้ง background ว่าเริ่มโหมด picker
    await chrome.runtime.sendMessage({ type: 'START_PICK' });
    
    // แจ้ง content script ให้เริ่มทำงาน
    await chrome.tabs.sendMessage(tab.id, { type: 'START_PICK' });
    
    log('Pick mode: เปิดโหมดเลือก selector แล้ว หากหน้าต่างนี้ปิดให้เลือกต่อได้เลย กด ESC เพื่อยกเลิก');
    
    // เพิ่มคำแนะนำเพื่อให้ผู้ใช้รู้ว่าทำอะไรต่อ
    log('🔔 หลังเลือกเสร็จ กรุณาเปิด popup นี้อีกครั้งเพื่อนำ selector มาใช้');
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

$('#inspect').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'PING_CONTENT' });
    if (res?.ok) log(`Page: ${res.title} — ${res.url}`);
    
    const resultsResp = await chrome.runtime.sendMessage({ type: 'GET_RESULTS' });
    if (resultsResp?.ok) {
        updateRecordCount(resultsResp.results.length);
    }
    
    // เช็คสถานะ picker ด้วย
    const pickerResp = await chrome.runtime.sendMessage({ type: 'IS_PICKER_ACTIVE' });
    if (pickerResp?.active) {
        log('⚠️ Selector picker ยังทำงานอยู่ — คลิกที่องค์ประกอบหรือกด ESC เพื่อจบการทำงาน');
    }
});

$('#run').addEventListener('click', async () => {
    clearLog();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // เก็บ job config เพื่อโหลดซ้ำง่าย ๆ
    const job = {
        mode: $('#mode').value,
        fields: safeJSON($('#fields').value),
        pagination: {
            nextSel: $('#nextSel').value,
            maxPages: num($('#maxPages').value, 1),
            pauseMs: num($('#pauseMs').value, 1200)
        },
        infinite: $('#infEnabled').checked ? {
            enabled: true,
            step: num($('#infStep').value, 900),
            pauseMs: num($('#infPause').value, 800),
            maxSteps: num($('#infMax').value, 25)
        } : { enabled: false },
        throttleMs: num($('#throttleMs').value, 0),
        listDetail: {
            listLinkSel: $('#listLinkSel').value,
            detailFields: safeJSON($('#detailFields').value),
            limit: num($('#ldLimit').value, 30),
            backMode: $('#ldBack').value,
            pauseMs: num($('#ldPause').value, 1200)
        },
        dataOptions: {
            cleanData: $('#cleanData').checked,
            absoluteURLs: $('#absoluteURLs').checked
        }
    };

    await chrome.runtime.sendMessage({ type: 'SET_JOB', payload: job });
    await chrome.runtime.sendMessage({ type: 'CLEAR_RESULTS' });
    updateRecordCount(0);

    log('Starting scrape...');
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_RUN', payload: job });
    if (res?.ok) {
        log(`✓ Scraped: +${res.added} rows (total ${res.total}).`);
        updateRecordCount(res.total);
    } else {
        log('✘ Error: ' + (res?.error || 'unknown'));
    }
});

$('#clear').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'CLEAR_RESULTS' });
    updateRecordCount(0);
    log('Cleared results.');
});

$('#exportCsv').addEventListener('click', async () => {
    const rows = await getResults();
    if (rows.length === 0) {
        log('No data to export.');
        return;
    }
    
    const csv = toCSV(rows);
    const url = blobURL(csv, 'text/csv;charset=utf-8');
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '_').replace('T', '_').split('_').slice(0, 4).join('-');
    const filename = `octolite_${timestamp}.csv`;
    
    await chrome.runtime.sendMessage({ 
        type: 'DOWNLOAD_BLOB', 
        payload: { url, filename } 
    });
    
    log(`Exported CSV: ${rows.length} rows`);
});

$('#exportJson').addEventListener('click', async () => {
    const rows = await getResults();
    if (rows.length === 0) {
        log('No data to export.');
        return;
    }
    
    const url = blobURL(JSON.stringify(rows, null, 2), 'application/json;charset=utf-8');
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '_').replace('T', '_').split('_').slice(0, 4).join('-');
    const filename = `octolite_${timestamp}.json`;
    
    await chrome.runtime.sendMessage({ 
        type: 'DOWNLOAD_BLOB', 
        payload: { url, filename } 
    });
    
    log(`Exported JSON: ${rows.length} rows`);
});

$('#exportTxt').addEventListener('click', async () => {
    const rows = await getResults();
    if (rows.length === 0) {
        log('No data to export.');
        return;
    }
    
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
    
    log(`Exported TXT (TSV): ${rows.length} rows`);
});

$('#exportSql').addEventListener('click', async () => {
    const rows = await getResults();
    if (rows.length === 0) {
        log('No data to export.');
        return;
    }
    
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
    
    log(`Exported SQL: ${rows.length} rows`);
});

function num(v, d) { 
    const n = Number(v); 
    return Number.isFinite(n) ? n : d; 
}

function safeJSON(s) { 
    try { 
        return JSON.parse(s || '[]'); 
    } catch { 
        return []; 
    } 
}

async function getResults() {
    const res = await chrome.runtime.sendMessage({ type: 'GET_RESULTS' });
    return res?.results || [];
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
    const resp = await chrome.runtime.sendMessage({ type: 'GET_JOB' });
    const job = resp?.job;
    if (!job) return;
    
    $('#mode').value = job.mode || 'simple';
    $('#fields').value = JSON.stringify(job.fields || [], null, 2);
    $('#nextSel').value = job.pagination?.nextSel || '';
    $('#maxPages').value = job.pagination?.maxPages ?? 1;
    $('#pauseMs').value = job.pagination?.pauseMs ?? 1200;
    $('#throttleMs').value = job.throttleMs ?? 0;

    $('#infEnabled').checked = !!job.infinite?.enabled;
    $('#infStep').value = job.infinite?.step ?? 900;
    $('#infPause').value = job.infinite?.pauseMs ?? 800;
    $('#infMax').value = job.infinite?.maxSteps ?? 25;
    $('#infCfg').style.display = $('#infEnabled').checked ? '' : 'none';

    $('#listLinkSel').value = job.listDetail?.listLinkSel || '';
    $('#detailFields').value = JSON.stringify(job.listDetail?.detailFields || [], null, 2);
    $('#ldLimit').value = job.listDetail?.limit ?? 30;
    $('#ldBack').value = job.listDetail?.backMode || 'history';
    $('#ldPause').value = job.listDetail?.pauseMs ?? 1200;
    
    if (job.dataOptions) {
        $('#cleanData').checked = job.dataOptions.cleanData ?? true;
        $('#absoluteURLs').checked = job.dataOptions.absoluteURLs ?? true;
    }

    modeEl.dispatchEvent(new Event('change'));
    
    // อัปเดต record count
    const resultsResp = await chrome.runtime.sendMessage({ type: 'GET_RESULTS' });
    if (resultsResp?.ok) {
        updateRecordCount(resultsResp.results.length);
    }
}

// เมื่อโหลดหน้า
document.addEventListener('DOMContentLoaded', async () => {
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
});