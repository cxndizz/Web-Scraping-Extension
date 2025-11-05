// OctoLite Scraper — content.js
// โหมดไฮไลต์เลือก selector, ดึงข้อมูล (fields), pagination, infinite scroll, list→detail

let picking = false;
let overlay;
let tooltip;

// ช่วยเรื่องการ clean ข้อมูล
function cleanPrice(text) {
    if (!text) return text;
    return text.replace(/[^\d.,]/g, '').trim();
}

function tryParseDate(text) {
    if (!text) return text;
    // แปลงรูปแบบวันที่มาตรฐานต่าง ๆ เป็น ISO 8601 หากทำได้
    const date = new Date(text);
    return !isNaN(date) ? date.toISOString().split('T')[0] : text;
}

function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'octolite-overlay';
    Object.assign(overlay.style, {
        position: 'absolute',
        pointerEvents: 'none',
        border: '2px dashed #00b894',
        background: 'rgba(0, 184, 148, 0.08)',
        zIndex: 2147483647,
        display: 'none'
    });
    document.documentElement.appendChild(overlay);
}

function ensureTooltip() {
    if (tooltip) return;
    tooltip = document.createElement('div');
    tooltip.id = 'octolite-tooltip';
    Object.assign(tooltip.style, {
        position: 'fixed',
        padding: '6px 10px',
        background: '#111',
        color: '#fff',
        fontSize: '12px',
        borderRadius: '6px',
        zIndex: 2147483647,
        pointerEvents: 'none',
        display: 'none'
    });
    tooltip.textContent = 'คลิกเพื่อเลือก selector นี้ — กด ESC เพื่อยกเลิก';
    document.documentElement.appendChild(tooltip);
}

function updateOverlay(target) {
    const r = target.getBoundingClientRect();
    Object.assign(overlay.style, {
        top: `${window.scrollY + r.top}px`,
        left: `${window.scrollX + r.left}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
        display: 'block'
    });
}

function updateTooltip(x, y) {
    Object.assign(tooltip.style, {
        left: `${x + 12}px`,
        top: `${y + 12}px`,
        display: 'block'
    });
}

function stopPicking() {
    picking = false;
    if (overlay) overlay.style.display = 'none';
    if (tooltip) tooltip.style.display = 'none';
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
}

function cssPath(el) {
    if (!(el instanceof Element)) return '';
    const path = [];
    while (el && el.nodeType === 1 && el !== document.body) {
        let selector = el.nodeName.toLowerCase();
        if (el.id) { 
            selector += `#${el.id}`; 
            path.unshift(selector); 
            break; 
        }
        // เพิ่ม class (อย่างปลอดภัย) ถ้ามี
        if (el.classList && el.classList.length && el.classList.length < 4) {
            const classList = Array.from(el.classList)
                .filter(c => !c.includes(' ') && !c.includes('.'))
                .slice(0, 3);
            
            if (classList.length > 0) {
                selector += '.' + classList.join('.');
            }
        }
        const sib = Array.from(el.parentNode.children).filter(e => e.nodeName === el.nodeName);
        if (sib.length > 1) selector += `:nth-of-type(${sib.indexOf(el)+1})`;
        path.unshift(selector);
        el = el.parentElement;
    }
    return path.join(' > ');
}

function onMove(e) {
    if (!picking) return;
    ensureOverlay();
    ensureTooltip();
    updateOverlay(e.target);
    updateTooltip(e.clientX, e.clientY);
}

function onClick(e) {
    if (!picking) return;
    e.preventDefault(); e.stopPropagation();
    const sel = cssPath(e.target);
    stopPicking();
    chrome.runtime.sendMessage({ type: "SELECTOR_PICKED", selector: sel });
}

function onKey(e) {
    if (e.key === 'Escape') {
        stopPicking();
    }
}

async function wait(ms) {
    await new Promise(r => setTimeout(r, ms));
}

function getVal(el, attr) {
    if (!el) return null;
    if (!attr || attr === 'text') return (el.textContent || '').trim();
    if (attr === 'html') return el.innerHTML;
    if (attr === 'outerHTML') return el.outerHTML;
    // สำหรับการเก็บค่า data-* attribute
    if (attr.startsWith('data-')) return el.getAttribute(attr);
    return el.getAttribute(attr);
}

function toAbsoluteURL(url) {
    if (!url) return url;
    // ไม่แปลงหาก URL สมบูรณ์แล้ว
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    // แปลงจาก relative เป็น absolute
    try {
        return new URL(url, window.location.href).href;
    } catch (e) {
        console.error('Error converting URL:', e);
        return url;
    }
}

async function autoScrollLoop({ step = 800, pauseMs = 600, maxSteps = 30 }) {
    let last = 0;
    for (let i = 0; i < maxSteps; i++) {
        window.scrollBy(0, step);
        await wait(pauseMs);
        const cur = document.body.scrollHeight;
        if (cur === last) break;
        last = cur;
    }
    // กลับไปด้านบนของหน้าเพื่อเริ่มเก็บข้อมูล
    window.scrollTo(0, 0);
    await wait(pauseMs);
}

async function scrapeCurrentPage(fields, options = {}) {
    const { cleanData = true, absoluteURLs = true } = options;
    
    // จัดแนวให้เป็นแบบแถว
    const counts = fields.map(f => document.querySelectorAll(f.selector).length);
    const rowMax = Math.max(0, ...counts);
    const rows = [];
    
    if (rowMax === 0) {
        // ไม่มีรายการซ้ำ ใช้แบบฟิลด์เดี่ยว ๆ
        const row = {};
        for (const f of fields) {
            let val = getVal(document.querySelector(f.selector), f.attr);
            
            // ทำความสะอาดข้อมูลถ้าเปิดใช้งาน
            if (cleanData && val) {
                if (f.name.includes('price')) val = cleanPrice(val);
                if (f.name.includes('date') || f.name.includes('posted_at')) val = tryParseDate(val);
                if ((f.name.includes('link') || f.name.includes('url') || f.attr === 'href' || f.attr === 'src') && absoluteURLs) {
                    val = toAbsoluteURL(val);
                }
            }
            
            row[f.name] = val;
        }
        rows.push(row);
        return rows;
    }
    
    for (let i = 0; i < rowMax; i++) {
        const row = {};
        for (const f of fields) {
            const list = Array.from(document.querySelectorAll(f.selector));
            const el = list[i] || list[0] || null;
            let val = getVal(el, f.attr);
            
            // ทำความสะอาดข้อมูลถ้าเปิดใช้งาน
            if (cleanData && val) {
                if (f.name.includes('price')) val = cleanPrice(val);
                if (f.name.includes('date') || f.name.includes('posted_at')) val = tryParseDate(val);
                if ((f.name.includes('link') || f.name.includes('url') || f.attr === 'href' || f.attr === 'src') && absoluteURLs) {
                    val = toAbsoluteURL(val);
                }
            }
            
            row[f.name] = val;
        }
        rows.push(row);
    }
    
    return rows;
}

async function runPagination({ nextSel, maxPages = 1, pauseMs = 1200, fields, throttleMs = 0, collectPerPage = true, options = {} }) {
    const all = [];
    let page = 0;
    while (true) {
        if (collectPerPage) {
            const rows = await scrapeCurrentPage(fields, options);
            all.push(...rows);
        }
        page++;
        if (!nextSel || page >= maxPages) break;
        const nextBtn = document.querySelector(nextSel);
        if (!nextBtn) break;
        nextBtn.click();
        await wait(pauseMs);
        if (throttleMs) await wait(throttleMs);
    }
    // ถ้า collectPerPage=false ให้เก็บครั้งเดียวหลังจบ
    if (!collectPerPage) {
        const rows = await scrapeCurrentPage(fields, options);
        all.push(...rows);
    }
    return all;
}

async function runListDetail({ listLinkSel, detailFields, fields = [], limit = 50, backMode = 'history', pauseMs = 1000, options = {} }) {
    const links = Array.from(document.querySelectorAll(listLinkSel)).slice(0, limit);
    const data = [];
    
    // เก็บข้อมูลจากหน้า list ก่อน
    if (fields && fields.length) {
        const listData = await scrapeCurrentPage(fields, options);
        
        // ถ้ามีข้อมูลใน list page มากกว่าจำนวน links ที่จะเข้าไปดู ให้ตัดให้เท่ากัน
        data.push(...listData.slice(0, links.length));
    }
    
    for (let i = 0; i < links.length; i++) {
        const a = links[i];
        const href = a.getAttribute('href');
        if (!href) continue;
        
        // บันทึก URL ของหน้าหลักไว้ใช้ในกรณี history.back() ไม่ทำงาน
        const currentURL = window.location.href;
        
        // เปิดในแท็บเดียว (navigate) แล้ว back
        a.click();
        await wait(pauseMs);
        
        // กรณี SPA อาจต้องรอ DOM เปลี่ยนแปลงเล็กน้อย
        await wait(500);
        
        // เก็บข้อมูลจากหน้า detail
        const detailRow = {};
        for (const f of detailFields) {
            let val = getVal(document.querySelector(f.selector), f.attr);
            
            // ทำความสะอาดข้อมูลถ้าเปิดใช้งาน
            if (options.cleanData && val) {
                if (f.name.includes('price')) val = cleanPrice(val);
                if (f.name.includes('date') || f.name.includes('posted_at')) val = tryParseDate(val);
                if ((f.name.includes('link') || f.name.includes('url') || f.attr === 'href' || f.attr === 'src') && options.absoluteURLs) {
                    val = toAbsoluteURL(val);
                }
            }
            
            detailRow[f.name] = val;
        }
        
        // หากมีข้อมูลจากหน้า list ก่อนหน้า ให้รวมกับข้อมูลจากหน้า detail
        if (i < data.length) {
            Object.assign(data[i], detailRow);
        } else {
            data.push(detailRow);
        }
        
        if (backMode === 'history') {
            history.back();
            
            // เพิ่ม fallback กรณี history.back() ไม่ทำงาน
            setTimeout(() => {
                if (window.location.href !== currentURL) {
                    window.location.href = currentURL;
                }
            }, pauseMs / 2);
            
            await wait(pauseMs);
        } else if (backMode === 'url') {
            window.location.href = currentURL;
            await wait(pauseMs * 1.5); // ให้เวลาโหลดมากขึ้น
        }
    }
    return data;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
        try {
            if (msg.type === 'START_PICK') {
                picking = true;
                ensureOverlay();
                ensureTooltip();
                document.addEventListener('mousemove', onMove, true);
                document.addEventListener('click', onClick, true);
                document.addEventListener('keydown', onKey, true);
                sendResponse({ ok: true });
                return;
            }

            if (msg.type === 'SCRAPE_RUN') {
                const { 
                    mode, 
                    fields = [], 
                    pagination = {}, 
                    infinite = {}, 
                    listDetail = {}, 
                    throttleMs = 0,
                    dataOptions = { 
                        cleanData: true, 
                        absoluteURLs: true 
                    }
                } = msg.payload || {};
                
                const results = [];
                
                // เก็บ source URL ก่อน
                await chrome.runtime.sendMessage({ 
                    type: 'STORE_SOURCE', 
                    payload: window.location.href 
                });

                if (infinite?.enabled) {
                    await autoScrollLoop({ 
                        step: infinite.step || 900, 
                        pauseMs: infinite.pauseMs || 800, 
                        maxSteps: infinite.maxSteps || 25 
                    });
                }

                if (mode === 'simple') {
                    const rows = await runPagination({
                        nextSel: pagination.nextSel,
                        maxPages: pagination.maxPages || 1,
                        pauseMs: pagination.pauseMs || 1200,
                        fields,
                        throttleMs: throttleMs || 0,
                        collectPerPage: true,
                        options: dataOptions
                    });
                    results.push(...rows);
                } else if (mode === 'listDetail') {
                    const det = await runListDetail({
                        listLinkSel: listDetail.listLinkSel,
                        fields: fields,
                        detailFields: listDetail.detailFields || [],
                        limit: listDetail.limit || 50,
                        backMode: listDetail.backMode || 'history',
                        pauseMs: listDetail.pauseMs || 1200,
                        options: dataOptions
                    });
                    results.push(...det);
                }

                chrome.runtime.sendMessage({ type: 'STORE_RESULTS', payload: results }, (resp) => {
                    sendResponse({ ok: true, added: results.length, total: resp?.count || 0 });
                });
                return;
            }

            if (msg.type === 'PING_CONTENT') {
                sendResponse({ ok: true, title: document.title, url: location.href });
                return;
            }
        } catch (e) {
            console.error(e);
            sendResponse({ ok: false, error: String(e) });
        }
    })();
    return true;
});