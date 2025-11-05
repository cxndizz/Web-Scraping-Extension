function $(q) { return document.querySelector(q) }
const KEY = 'octolite_presets';

async function getMap() {
    const obj = (await chrome.storage.local.get(KEY))[KEY] || {};
    return obj;
}
async function setMap(m) {
    await chrome.storage.local.set({ [KEY]: m });
}

$('#save').addEventListener('click', async () => {
    const d = $('#domain').value.trim();
    if (!d) return msg('กรุณากรอก domain');
    let job;
    try { job = JSON.parse($('#job').value || '{}'); } catch { return msg('Job JSON ไม่ถูกต้อง'); }
    const m = await getMap();
    m[d] = job;
    await setMap(m);
    msg('บันทึกเรียบร้อย');
});

$('#load').addEventListener('click', async () => {
    const d = $('#domain').value.trim();
    if (!d) return msg('กรุณากรอก domain');
    const m = await getMap();
    const job = m[d];
    if (!job) return msg('ไม่พบ preset สำหรับโดเมนนี้');
    $('#job').value = JSON.stringify(job, null, 2);
    msg('โหลด preset แล้ว');
});

$('#clear').addEventListener('click', async () => {
    const d = $('#domain').value.trim();
    if (!d) return msg('กรุณากรอก domain');
    const m = await getMap();
    delete m[d];
    await setMap(m);
    msg('ลบ preset แล้ว');
});

function msg(s) { $('#msg').textContent = s; }