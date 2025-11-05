// OctoLite Scraper — options.js
function $(q) { return document.querySelector(q) }
const KEY_PRESETS = 'octolite_presets';
const KEY_SETTINGS = 'octolite_settings';

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
        showNotification: true
    };
    const obj = (await chrome.storage.local.get(KEY_SETTINGS))[KEY_SETTINGS] || defaultSettings;
    return obj;
}

async function setSettings(s) {
    await chrome.storage.local.set({ [KEY_SETTINGS]: s });
}

$('#save').addEventListener('click', async () => {
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
    msg('บันทึก preset สำหรับ ' + d + ' เรียบร้อย');
    
    // รีเฟรชรายการ presets
    renderPresetList();
});

$('#load').addEventListener('click', async () => {
    const d = $('#domain').value.trim();
    if (!d) return msg('กรุณากรอก domain');
    
    const m = await getPresets();
    const job = m[d];
    if (!job) return msg('ไม่พบ preset สำหรับโดเมนนี้');
    
    $('#job').value = JSON.stringify(job, null, 2);
    msg('โหลด preset สำหรับ ' + d + ' แล้ว');
});

$('#clear').addEventListener('click', async () => {
    const d = $('#domain').value.trim();
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
        showNotification: $('#showNotification').checked
    };
    
    await setSettings(settings);
    msg('บันทึกการตั้งค่าเรียบร้อย');
});

$('#resetSettings').addEventListener('click', async () => {
    const defaultSettings = {
        defaultExport: 'csv',
        autoClean: true,
        showNotification: true
    };
    
    await setSettings(defaultSettings);
    loadSettings();
    msg('รีเซ็ตการตั้งค่าเป็นค่าเริ่มต้น');
});

function msg(s) { 
    $('#msg').textContent = s; 
    setTimeout(() => {
        $('#msg').textContent = '';
    }, 3000);
}

async function loadSettings() {
    const settings = await getSettings();
    $('#defaultExport').value = settings.defaultExport || 'csv';
    $('#autoClean').checked = settings.autoClean !== false;
    $('#showNotification').checked = settings.showNotification !== false;
}

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
        const itemEl = document.createElement('div');
        itemEl.className = 'preset-item';
        
        const domainEl = document.createElement('div');
        domainEl.className = 'preset-domain';
        domainEl.textContent = domain;
        
        const actionsEl = document.createElement('div');
        actionsEl.className = 'preset-actions';
        
        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'โหลด';
        loadBtn.addEventListener('click', () => {
            $('#domain').value = domain;
            $('#job').value = JSON.stringify(presets[domain], null, 2);
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