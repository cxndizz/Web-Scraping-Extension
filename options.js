// OctoLite Scraper — options.js
function $(q) { return document.querySelector(q) }
function $$(q) { return document.querySelectorAll(q) }
const KEY_PRESETS = 'octolite_presets';
const KEY_SETTINGS = 'octolite_settings';
const CURRENT_TAB = {tab: 'dom'};

async function getPresets() {
    const obj = (await chrome.storage.local.get(KEY_PRESETS))[KEY_PRESETS] || {};
    return obj;
}

async function setPresets(m) {
    await chrome.storage.local.set({ [KEY_PRESETS]: m });
}

async function getSettings() {
    const defaultSettings = {
        defaultExport: 'csv',
        autoClean: true,
        showNotification: true,
        captureXhr: true
    };
    const obj = (await chrome.storage.local.get(KEY_SETTINGS))[KEY_SETTINGS] || defaultSettings;
    return obj;
}

async function setSettings(s) {
    await chrome.storage.local.set({ [KEY_SETTINGS]: s });
}

$('#save').addEventListener('click', async () => {
    if (CURRENT_TAB.tab === 'dom') {
        const d = $('#domain').value.trim();
        if (!d) return msg('กรุณากรอก domain');
        
        let job;
        try { 
            job = JSON.parse($('#job').value || '{}'); 
        } catch { 
            return msg('Job JSON ไม่ถูกต้อง'); 
        }
        
        const m = await getPresets();
        m[d] = job;
        await setPresets(m);
        msg('บันทึก preset DOM mode สำหรับ ' + d + ' เรียบร้อย');
    } else if (CURRENT_TAB.tab === 'api') {
        const d = $('#apiDomain').value.trim();
        if (!d) return msg('กรุณากรอก domain สำหรับ API');
        
        // สร้าง API job object
        const apiJob = {
            mode: 'api',
            api: {
                url: $('#apiUrl').value,
                method: $('#apiMethod').value,
                contentType: $('#apiContentType').value,
                headers: safeJSON($('#apiHeaders').value),
                body: $('#apiBody').value,
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
            },
            dataOptions: {
                cleanData: true,
                absoluteURLs: true
            }
        };
        
        const m = await getPresets();
        m[d] = apiJob;
        await setPresets(m);
        msg('บันทึก preset API mode สำหรับ ' + d + ' เรียบร้อย');
    }
    
    // รีเฟรชรายการ presets
    renderPresetList();
});

$('#load').addEventListener('click', async () => {
    if (CURRENT_TAB.tab === 'dom') {
        const d = $('#domain').value.trim();
        if (!d) return msg('กรุณากรอก domain');
        
        const m = await getPresets();
        const job = m[d];
        if (!job) return msg('ไม่พบ preset สำหรับโดเมนนี้');
        
        // ถ้าเป็น API job ให้เปลี่ยนแท็บ
        if (job.mode === 'api' && job.api) {
            switchTab('api');
            loadApiPreset(job);
            msg('โหลด preset API สำหรับ ' + d + ' แล้ว');
            return;
        }
        
        $('#job').value = JSON.stringify(job, null, 2);
        msg('โหลด preset สำหรับ ' + d + ' แล้ว');
    } else if (CURRENT_TAB.tab === 'api') {
        const d = $('#apiDomain').value.trim();
        if (!d) return msg('กรุณากรอก domain');
        
        const m = await getPresets();
        const job = m[d];
        if (!job) return msg('ไม่พบ preset สำหรับโดเมนนี้');
        
        // ถ้าไม่ใช่ API job ให้เปลี่ยนแท็บและโหลด
        if (job.mode !== 'api') {
            switchTab('dom');
            $('#domain').value = d;
            $('#job').value = JSON.stringify(job, null, 2);
            msg('โหลด preset DOM สำหรับ ' + d + ' แล้ว');
            return;
        }
        
        loadApiPreset(job);
        msg('โหลด preset API สำหรับ ' + d + ' แล้ว');
    }
});

$('#clear').addEventListener('click', async () => {
    let d;
    if (CURRENT_TAB.tab === 'dom') {
        d = $('#domain').value.trim();
    } else {
        d = $('#apiDomain').value.trim();
    }
    
    if (!d) return msg('กรุณากรอก domain');
    
    const m = await getPresets();
    if (!m[d]) return msg('ไม่พบ preset สำหรับโดเมนนี้');
    
    delete m[d];
    await setPresets(m);
    msg('ลบ preset สำหรับ ' + d + ' แล้ว');
    
    // รีเฟรชรายการ presets
    renderPresetList();
});

$('#saveSettings').addEventListener('click', async () => {
    const settings = {
        defaultExport: $('#defaultExport').value,
        autoClean: $('#autoClean').checked,
        showNotification: $('#showNotification').checked,
        captureXhr: $('#captureXhr').checked
    };
    
    await setSettings(settings);
    msg('บันทึกการตั้งค่าเรียบร้อย');
});

$('#resetSettings').addEventListener('click', async () => {
    const defaultSettings = {
        defaultExport: 'csv',
        autoClean: true,
        showNotification: true,
        captureXhr: true
    };
    
    await setSettings(defaultSettings);
    loadSettings();
    msg('รีเซ็ตการตั้งค่าเป็นค่าเริ่มต้น');
});

$('#apiPagType').addEventListener('change', () => {
    $('#apiCursorDiv').style.display = $('#apiPagType').value === 'cursor' ? 'block' : 'none';
});

function loadApiPreset(job) {
    if (!job || !job.api) return;
    
    $('#apiDomain').value = $('#domain').value; // ใช้ค่าจากแท็บ DOM
    $('#apiUrl').value = job.api.url || '';
    $('#apiMethod').value = job.api.method || 'GET';
    $('#apiContentType').value = job.api.contentType || 'application/json';
    $('#apiHeaders').value = JSON.stringify(job.api.headers || {}, null, 2);
    $('#apiBody').value = job.api.body || '';
    $('#apiDataPath').value = job.api.dataPath || '';
    $('#apiMapping').value = JSON.stringify(job.api.mapping || {}, null, 2);
    
    // ตั้งค่า pagination
    if (job.api.pagination) {
        $('#apiPagType').value = job.api.pagination.type || 'page';
        $('#apiPagParam').value = job.api.pagination.param || 'page';
        $('#apiPagStart').value = job.api.pagination.start || '1';
        $('#apiPagIncrement').value = job.api.pagination.increment || '1';
        $('#apiMaxPages').value = job.api.pagination.maxPages || 5;
        $('#apiCursorPath').value = job.api.pagination.cursorPath || '';
        $('#apiCursorDiv').style.display = job.api.pagination.type === 'cursor' ? 'block' : 'none';
    }
    
    $('#apiThrottleMs').value = job.api.throttleMs || 1000;
}

function msg(s) { 
    $('#msg').textContent = s; 
    setTimeout(() => {
        $('#msg').textContent = '';
    }, 3000);
}

function num(v, d) { 
    const n = Number(v); 
    return Number.isFinite(n) ? n : d; 
}

function safeJSON(s) { 
    try { 
        return JSON.parse(s || '{}'); 
    } catch { 
        return {}; 
    } 
}

async function loadSettings() {
    const settings = await getSettings();
    $('#defaultExport').value = settings.defaultExport || 'csv';
    $('#autoClean').checked = settings.autoClean !== false;
    $('#showNotification').checked = settings.showNotification !== false;
    $('#captureXhr').checked = settings.captureXhr !== false;
}

// Tab switching
function switchTab(tab) {
    CURRENT_TAB.tab = tab;
    
    // ปรับ UI ของแท็บ
    $$('.tab').forEach(el => el.classList.remove('active'));
    $$(`[data-tab="${tab}"]`).forEach(el => el.classList.add('active'));
    
    // แสดงเนื้อหาแท็บที่เลือก ซ่อนแท็บอื่น
    $$('.tab-content').forEach(el => el.classList.remove('active'));
    $$(`[data-tab-content="${tab}"]`).forEach(el => el.classList.add('active'));
}

// Setup tab switching
$$('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        switchTab(tab.dataset.tab);
    });
});

async function renderPresetList() {
    const presets = await getPresets();
    const listEl = $('#presetList');
    listEl.innerHTML = '';
    
    const domains = Object.keys(presets).sort();
    
    if (domains.length === 0) {
        listEl.innerHTML = '<div class="preset-item">ไม่มี preset ที่บันทึกไว้</div>';
        return;
    }
    
    domains.forEach(domain => {
        const preset = presets[domain];
        const isApiPreset = preset && preset.mode === 'api';
        
        const itemEl = document.createElement('div');
        itemEl.className = 'preset-item';
        
        const domainEl = document.createElement('div');
        domainEl.className = 'preset-domain';
        domainEl.textContent = domain;
        
        if (isApiPreset) {
            const badgeEl = document.createElement('span');
            badgeEl.className = 'preset-badge api';
            badgeEl.textContent = 'API';
            domainEl.appendChild(badgeEl);
        } else {
            const badgeEl = document.createElement('span');
            badgeEl.className = 'preset-badge';
            badgeEl.textContent = preset?.mode || 'DOM';
            domainEl.appendChild(badgeEl);
        }
        
        const actionsEl = document.createElement('div');
        actionsEl.className = 'preset-actions';
        
        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'โหลด';
        loadBtn.addEventListener('click', () => {
            // เลือกแท็บตามประเภท preset
            if (isApiPreset) {
                switchTab('api');
                $('#apiDomain').value = domain;
                loadApiPreset(preset);
            } else {
                switchTab('dom');
                $('#domain').value = domain;
                $('#job').value = JSON.stringify(presets[domain], null, 2);
            }
            msg('โหลด preset สำหรับ ' + domain + ' แล้ว');
        });
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'ลบ';
        deleteBtn.className = 'secondary';
        deleteBtn.addEventListener('click', async () => {
            if (confirm(`ยืนยันการลบ preset สำหรับ ${domain}?`)) {
                const m = await getPresets();
                delete m[domain];
                await setPresets(m);
                renderPresetList();
                msg('ลบ preset สำหรับ ' + domain + ' แล้ว');
            }
        });
        
        actionsEl.appendChild(loadBtn);
        actionsEl.appendChild(deleteBtn);
        
        itemEl.appendChild(domainEl);
        itemEl.appendChild(actionsEl);
        
        listEl.appendChild(itemEl);
    });
}

// โหลด UI เมื่อเปิดหน้า
document.addEventListener('DOMContentLoaded', async () => {
    renderPresetList();
    loadSettings();
});