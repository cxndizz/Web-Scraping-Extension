// OctoLite Scraper — popup.js
const $ = (q) => document.querySelector(q);
const logEl = $('#log');
const modeEl = $('#mode');
const simpleSec = $('#simpleSec');
const ldSec = $('#ldSec');

function log(m) { logEl.textContent += m + '\n'; }
function clearLog() { logEl.textContent = ''; }

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
  await chrome.tabs.sendMessage(tab.id, { type: 'START_PICK' });
  log('Pick mode: ชี้องค์ประกอบแล้วคลิก เพื่อคัดลอก selector → ฟิลด์แรกจะถูกอัปเดตอัตโนมัติ');
  const handler = (msg) => {
    if (msg.type === 'SELECTOR_PICKED') {
      try {
        const fields = JSON.parse($('#fields').value || '[]');
        if (fields.length) fields[0].selector = msg.selector;
        $('#fields').value = JSON.stringify(fields, null, 2);
        log('Picked: ' + msg.selector);
      } catch (e) {
        log('Invalid JSON in Fields');
      }
      chrome.runtime.onMessage.removeListener(handler);
    }
  };
  chrome.runtime.onMessage.addListener(handler);
});

$('#inspect').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const res = await chrome.tabs.sendMessage(tab.id, { type: 'PING_CONTENT' });
  if (res?.ok) log(`Page: ${res.title} — ${res.url}`);
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
    }
  };

  await chrome.runtime.sendMessage({ type: 'SET_JOB', payload: job });
  await chrome.runtime.sendMessage({ type: 'CLEAR_RESULTS' });

  const res = await chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_RUN', payload: job });
  if (res?.ok) log(`Scraped: +${res.added} rows (total ${res.total}).`);
  else log('Error: ' + (res?.error || 'unknown'));
});

$('#clear').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'CLEAR_RESULTS' });
  log('Cleared results.');
});

$('#exportCsv').addEventListener('click', async () => {
  const rows = await getResults();
  const csv = toCSV(rows);
  const url = blobURL(csv, 'text/csv');
  await chrome.runtime.sendMessage({ type: 'DOWNLOAD_BLOB', payload: { url, filename: 'octolite.csv' } });
});

$('#exportJson').addEventListener('click', async () => {
  const rows = await getResults();
  const url = blobURL(JSON.stringify(rows, null, 2), 'application/json');
  await chrome.runtime.sendMessage({ type: 'DOWNLOAD_BLOB', payload: { url, filename: 'octolite.json' } });
});

function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function safeJSON(s) { try { return JSON.parse(s || '[]'); } catch { return []; } }

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
  const headers = Array.from(rows.reduce((set, r) => { Object.keys(r).forEach(k => set.add(k)); return set; }, new Set()));
  const esc = (s) => (s==null ? '' : String(s).replace(/"/g,'""'));
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map(h => `"${esc(r[h])}"`).join(','));
  }
  return lines.join('\n');
}

// โหลด job เดิมกลับเข้าฟอร์ม (optional)
(async function initFromJob(){
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

  modeEl.dispatchEvent(new Event('change'));
})();