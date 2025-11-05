// BrowserHarvest - renderer.js
const { ipcRenderer } = require('electron');

// DOM Elements
const targetUrlInput = document.getElementById('target-url');
const openUrlBtn = document.getElementById('open-url-btn');
const refreshPageBtn = document.getElementById('refresh-page-btn');
const closeBrowserBtn = document.getElementById('close-browser-btn');
const selectItemBtn = document.getElementById('select-item-btn');
const selectPaginationBtn = document.getElementById('select-pagination-btn');
const addFieldBtn = document.getElementById('add-field-btn');
const startHarvestBtn = document.getElementById('start-harvest-btn');
const clearDataBtn = document.getElementById('clear-data-btn');
const fieldItems = document.getElementById('field-items');
const paginationSelector = document.getElementById('pagination-selector');
const maxPages = document.getElementById('max-pages');
const recordLimit = document.getElementById('record-limit');
const harvestState = document.getElementById('harvest-state');
const currentPage = document.getElementById('current-page');
const totalRecords = document.getElementById('total-records');
const harvestProgress = document.getElementById('harvest-progress');
const resultsTable = document.getElementById('results-table');
const exportCsvBtn = document.getElementById('export-csv-btn');
const exportJsonBtn = document.getElementById('export-json-btn');
const exportSqlBtn = document.getElementById('export-sql-btn');
const aboutLink = document.getElementById('about-link');
const helpLink = document.getElementById('help-link');

// Modal Elements
const fieldModal = document.getElementById('field-modal');
const modalTitle = document.getElementById('modal-title');
const fieldName = document.getElementById('field-name');
const fieldSelector = document.getElementById('field-selector');
const fieldAttribute = document.getElementById('field-attribute');
const customAttributeGroup = document.getElementById('custom-attribute-group');
const customAttribute = document.getElementById('custom-attribute');
const fieldPreview = document.getElementById('field-preview');
const pickSelectorBtn = document.getElementById('pick-selector-btn');
const saveFieldBtn = document.getElementById('save-field-btn');
const cancelFieldBtn = document.getElementById('cancel-field-btn');
const modalClose = document.querySelector('.modal-close');

// State
let browserOpen = false;
let currentUrl = '';
let fields = [];
let harvesting = false;
let harvestData = [];
let editingFieldIndex = -1;
let paginationConfig = {
  selector: '',
  maxPages: 1
};

// Initialize UI
function init() {
  updateUI();
  setupEventListeners();
}

// Update UI based on current state
function updateUI() {
  // Update button states
  selectItemBtn.disabled = !browserOpen;
  selectPaginationBtn.disabled = !browserOpen;
  startHarvestBtn.disabled = !browserOpen || fields.length === 0;
  
  // Update selectors container visibility
  document.getElementById('selectors-container').style.display = fields.length > 0 ? 'block' : 'none';
  
  // Update pagination config visibility
  document.getElementById('pagination-config').style.display = paginationConfig.selector ? 'block' : 'none';
  
  // Update browser preview visibility
  document.getElementById('browser-preview').style.display = browserOpen ? 'block' : 'none';
  
  // Update harvest status visibility
  document.getElementById('harvest-status').style.display = 
    (harvestData.length > 0 || harvesting) ? 'block' : 'none';
  
  // Update export buttons
  exportCsvBtn.disabled = harvestData.length === 0;
  exportJsonBtn.disabled = harvestData.length === 0;
  exportSqlBtn.disabled = harvestData.length === 0;
  
  // Update clear data button
  clearDataBtn.disabled = harvestData.length === 0;
}

// Setup all event listeners
function setupEventListeners() {
  // URL input and browser control
  openUrlBtn.addEventListener('click', openWebsite);
  refreshPageBtn.addEventListener('click', refreshBrowser);
  closeBrowserBtn.addEventListener('click', closeBrowser);
  
  // Field selection
  selectItemBtn.addEventListener('click', () => selectElement('item'));
  selectPaginationBtn.addEventListener('click', () => selectElement('pagination'));
  addFieldBtn.addEventListener('click', openAddFieldModal);
  
  // Harvest control
  startHarvestBtn.addEventListener('click', startHarvest);
  clearDataBtn.addEventListener('click', clearData);
  
  // Export
  exportCsvBtn.addEventListener('click', () => exportData('csv'));
  exportJsonBtn.addEventListener('click', () => exportData('json'));
  exportSqlBtn.addEventListener('click', () => exportData('sql'));
  
  // Modal events
  modalClose.addEventListener('click', closeModal);
  cancelFieldBtn.addEventListener('click', closeModal);
  saveFieldBtn.addEventListener('click', saveField);
  pickSelectorBtn.addEventListener('click', () => pickFieldSelector());
  
  // Field attribute change
  fieldAttribute.addEventListener('change', () => {
    if (fieldAttribute.value === 'custom') {
      customAttributeGroup.style.display = 'block';
    } else {
      customAttributeGroup.style.display = 'none';
    }
  });
  
  // About and help links
  aboutLink.addEventListener('click', showAbout);
  helpLink.addEventListener('click', showHelp);
}

// Open website in browser
async function openWebsite() {
  const url = targetUrlInput.value.trim();
  if (!url) {
    showToast('กรุณาใส่ URL ก่อน', 'error');
    return;
  }
  
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    targetUrlInput.value = 'https://' + url;
  }
  
  harvestState.textContent = 'กำลังโหลด...';
  
  try {
    const result = await ipcRenderer.invoke('open-website', targetUrlInput.value);
    
    if (result.success) {
      browserOpen = true;
      currentUrl = targetUrlInput.value;
      showToast('เปิดเว็บไซต์สำเร็จ', 'success');
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
  }
  
  updateUI();
}

// Refresh browser
async function refreshBrowser() {
  try {
    const result = await ipcRenderer.invoke('open-website', currentUrl);
    if (result.success) {
      showToast('รีเฟรชเว็บไซต์สำเร็จ', 'success');
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
  }
}

// Close browser
async function closeBrowser() {
  try {
    browserOpen = false;
    document.getElementById('browser-preview').style.display = 'none';
    showToast('ปิด Browser สำเร็จ', 'success');
    updateUI();
  } catch (error) {
    showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
  }
}

// Select element
async function selectElement(type) {
  try {
    showToast('กำลังเข้าสู่โหมดเลือก - กรุณาคลิกที่องค์ประกอบบนหน้าเว็บ', 'info', 5000);
    
    const result = await ipcRenderer.invoke('select-element', type);
    
    if (result.success) {
      if (type === 'pagination') {
        paginationConfig.selector = result.selector;
        paginationSelector.value = result.selector;
        document.getElementById('pagination-config').style.display = 'block';
        showToast('เลือกปุ่มเลื่อนหน้าสำเร็จ', 'success');
      } else if (type === 'item') {
        // Open modal with selector already filled
        openAddFieldModal(result.selector, result.text, result.attributes);
      }
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
  }
  
  updateUI();
}

// Pick field selector for a specific field
async function pickFieldSelector() {
  closeModal();
  
  try {
    showToast('กำลังเข้าสู่โหมดเลือก - กรุณาคลิกที่องค์ประกอบบนหน้าเว็บ', 'info', 5000);
    
    const result = await ipcRenderer.invoke('select-element', 'field');
    
    if (result.success) {
      openAddFieldModal(result.selector, result.text, result.attributes);
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
  }
}

// Open modal to add a field
function openAddFieldModal(selector = '', previewText = '', attributes = {}) {
  // Reset modal
  modalTitle.textContent = editingFieldIndex >= 0 ? 'แก้ไขฟิลด์' : 'เพิ่มฟิลด์';
  
  if (editingFieldIndex >= 0) {
    const field = fields[editingFieldIndex];
    fieldName.value = field.name;
    fieldSelector.value = field.selector;
    
    if (field.attribute === 'text' || field.attribute === 'html' || 
        field.attribute === 'href' || field.attribute === 'src' || 
        field.attribute === 'data-id' || field.attribute === 'data-price' || 
        field.attribute === 'data-url' || field.attribute === 'title' || 
        field.attribute === 'alt' || field.attribute === 'value') {
      fieldAttribute.value = field.attribute;
      customAttributeGroup.style.display = 'none';
    } else {
      fieldAttribute.value = 'custom';
      customAttribute.value = field.attribute;
      customAttributeGroup.style.display = 'block';
    }
  } else {
    fieldName.value = '';
    fieldSelector.value = selector || '';
    fieldAttribute.value = 'text';
    customAttribute.value = '';
    customAttributeGroup.style.display = 'none';
  }
  
  // Show preview if available
  if (previewText) {
    fieldPreview.innerHTML = `<strong>ข้อความ:</strong> ${previewText}`;
    
    if (Object.keys(attributes).length) {
      fieldPreview.innerHTML += '<hr>';
      fieldPreview.innerHTML += '<strong>คุณสมบัติ:</strong><br>';
      
      for (const [key, value] of Object.entries(attributes)) {
        fieldPreview.innerHTML += `<code>${key}</code>: ${value}<br>`;
      }
    }
  } else {
    fieldPreview.innerHTML = '<div class="preview-placeholder">คลิก "เลือก" เพื่อดูตัวอย่าง</div>';
  }
  
  // Show modal
  fieldModal.style.display = 'block';
}

// Save field from modal
function saveField() {
  const name = fieldName.value.trim();
  const selector = fieldSelector.value.trim();
  const attributeValue = fieldAttribute.value === 'custom' ? 
    customAttribute.value.trim() : fieldAttribute.value;
  
  if (!name) {
    showToast('กรุณาระบุชื่อฟิลด์', 'error');
    return;
  }
  
  if (!selector) {
    showToast('กรุณาเลือก Selector ก่อน', 'error');
    return;
  }
  
  if (fieldAttribute.value === 'custom' && !customAttribute.value.trim()) {
    showToast('กรุณาระบุชื่อคุณสมบัติ', 'error');
    return;
  }
  
  const newField = {
    name: name,
    selector: selector,
    attribute: attributeValue
  };
  
  if (editingFieldIndex >= 0) {
    // Editing existing field
    fields[editingFieldIndex] = newField;
    showToast('แก้ไขฟิลด์สำเร็จ', 'success');
  } else {
    // Adding new field
    fields.push(newField);
    showToast('เพิ่มฟิลด์สำเร็จ', 'success');
  }
  
  closeModal();
  renderFields();
  updateUI();
}

// Close field modal
function closeModal() {
  fieldModal.style.display = 'none';
  editingFieldIndex = -1;
}

// Render fields in the list
function renderFields() {
  fieldItems.innerHTML = '';
  
  fields.forEach((field, index) => {
    const fieldItem = document.createElement('div');
    fieldItem.className = 'field-item';
    
    const nameEl = document.createElement('div');
    nameEl.className = 'field-name';
    nameEl.textContent = field.name;
    
    const selectorEl = document.createElement('div');
    selectorEl.className = 'field-selector';
    selectorEl.title = field.selector;
    selectorEl.textContent = field.selector;
    
    const attrEl = document.createElement('div');
    attrEl.className = 'field-attribute';
    attrEl.textContent = field.attribute;
    
    const actionsEl = document.createElement('div');
    actionsEl.className = 'field-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'field-action-btn';
    editBtn.innerHTML = '<i class="fas fa-pen"></i>';
    editBtn.title = 'แก้ไข';
    editBtn.addEventListener('click', () => editField(index));
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'field-action-btn';
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.title = 'ลบ';
    deleteBtn.addEventListener('click', () => deleteField(index));
    
    actionsEl.appendChild(editBtn);
    actionsEl.appendChild(deleteBtn);
    
    fieldItem.appendChild(nameEl);
    fieldItem.appendChild(selectorEl);
    fieldItem.appendChild(attrEl);
    fieldItem.appendChild(actionsEl);
    
    fieldItems.appendChild(fieldItem);
  });
}

// Edit field
function editField(index) {
  editingFieldIndex = index;
  openAddFieldModal();
}

// Delete field
function deleteField(index) {
  if (confirm('ยืนยันการลบฟิลด์นี้?')) {
    fields.splice(index, 1);
    renderFields();
    showToast('ลบฟิลด์สำเร็จ', 'success');
    updateUI();
  }
}

// Start harvesting data
async function startHarvest() {
  if (harvesting) return;
  if (fields.length === 0) {
    showToast('กรุณาเพิ่มฟิลด์ก่อนเก็บข้อมูล', 'error');
    return;
  }
  
  try {
    harvesting = true;
    harvestState.textContent = 'กำลังเก็บข้อมูล...';
    updateUI();
    
    const config = {
      fields: fields,
      paginationConfig: {
        selector: paginationConfig.selector,
        maxPages: parseInt(maxPages.value) || 1,
        currentPage: 1
      },
      recordLimit: parseInt(recordLimit.value) || 100
    };
    
    // Clear previous data
    harvestData = [];
    renderResults();
    currentPage.textContent = '1';
    totalRecords.textContent = '0';
    harvestProgress.style.width = '0%';
    
    const result = await ipcRenderer.invoke('harvest-data', config);
    
    if (result.success) {
      harvestData = result.records;
      harvestState.textContent = 'เสร็จสมบูรณ์';
      currentPage.textContent = result.lastPage;
      totalRecords.textContent = result.totalRecords;
      harvestProgress.style.width = '100%';
      
      renderResults();
      showToast(`เก็บข้อมูลสำเร็จ ${result.totalRecords} รายการ`, 'success');
    } else {
      harvestState.textContent = 'เกิดข้อผิดพลาด';
      showToast(result.message, 'error');
    }
  } catch (error) {
    harvestState.textContent = 'เกิดข้อผิดพลาด';
    showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
  } finally {
    harvesting = false;
    updateUI();
  }
}

// Update harvest progress
function updateHarvestProgress(currentPage, maxPages, currentCount) {
  const progressPercent = Math.min(100, Math.round((currentPage / maxPages) * 100));
  harvestProgress.style.width = `${progressPercent}%`;
  document.getElementById('current-page').textContent = currentPage;
  document.getElementById('total-records').textContent = currentCount;
}

// Clear harvested data
function clearData() {
  if (confirm('ยืนยันการล้างข้อมูลทั้งหมด?')) {
    harvestData = [];
    renderResults();
    harvestState.textContent = 'พร้อม';
    currentPage.textContent = '0';
    totalRecords.textContent = '0';
    harvestProgress.style.width = '0%';
    showToast('ล้างข้อมูลสำเร็จ', 'success');
    updateUI();
  }
}

// Render harvested results
function renderResults() {
  if (!harvestData || harvestData.length === 0) {
    resultsTable.innerHTML = `
      <thead>
        <tr>
          <th>ลำดับ</th>
          <th>ยังไม่มีข้อมูล</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td colspan="2">ยังไม่มีข้อมูล กรุณากดปุ่ม "เริ่มเก็บข้อมูล"</td>
        </tr>
      </tbody>
    `;
    return;
  }
  
  // Get all unique fields from data
  const allFields = new Set();
  harvestData.forEach(item => {
    Object.keys(item).forEach(key => {
      // Skip metadata fields that start with _
      if (!key.startsWith('_')) {
        allFields.add(key);
      }
    });
  });
  
  // Create table header
  let headerHTML = '<tr><th>ลำดับ</th>';
  allFields.forEach(field => {
    headerHTML += `<th>${field}</th>`;
  });
  headerHTML += '</tr>';
  
  // Create table body
  let bodyHTML = '';
  harvestData.forEach((item, index) => {
    bodyHTML += `<tr><td>${index + 1}</td>`;
    
    allFields.forEach(field => {
      const value = item[field] !== undefined ? item[field] : '';
      bodyHTML += `<td>${value}</td>`;
    });
    
    bodyHTML += '</tr>';
  });
  
  // Update table
  resultsTable.innerHTML = `
    <thead>${headerHTML}</thead>
    <tbody>${bodyHTML}</tbody>
  `;
}

// Export data
async function exportData(format) {
  if (harvestData.length === 0) {
    showToast('ไม่มีข้อมูลให้ส่งออก', 'error');
    return;
  }
  
  try {
    let content = '';
    let defaultFilename = `browserharvest_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    
    if (format === 'csv') {
      content = convertToCSV(harvestData);
      defaultFilename += '.csv';
    } else if (format === 'json') {
      content = JSON.stringify(harvestData, null, 2);
      defaultFilename += '.json';
    } else if (format === 'sql') {
      content = convertToSQL(harvestData);
      defaultFilename += '.sql';
    }
    
    const saveResult = await ipcRenderer.invoke('save-file', {
      content: content,
      fileType: format,
      defaultPath: defaultFilename
    });
    
    if (saveResult.success) {
      showToast(`บันทึกไฟล์ ${format.toUpperCase()} สำเร็จ`, 'success');
    } else {
      showToast(saveResult.message, 'warning');
    }
  } catch (error) {
    showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
  }
}

// Convert data to CSV
function convertToCSV(data) {
  if (!data || !data.length) return '';
  
  // Get all fields (excluding metadata fields)
  const fields = new Set();
  data.forEach(item => {
    Object.keys(item).forEach(key => {
      if (!key.startsWith('_')) {
        fields.add(key);
      }
    });
  });
  
  const fieldsList = Array.from(fields);
  
  // Create CSV header
  let csv = fieldsList.map(field => `"${field}"`).join(',') + '\n';
  
  // Create rows
  data.forEach(item => {
    const row = fieldsList.map(field => {
      const value = item[field] !== undefined ? String(item[field]).replace(/"/g, '""') : '';
      return `"${value}"`;
    }).join(',');
    
    csv += row + '\n';
  });
  
  return csv;
}

// Convert data to SQL
function convertToSQL(data) {
  if (!data || !data.length) return '';
  
  // Get all fields (excluding metadata fields)
  const fields = new Set();
  data.forEach(item => {
    Object.keys(item).forEach(key => {
      if (!key.startsWith('_')) {
        fields.add(key);
      }
    });
  });
  
  const fieldsList = Array.from(fields);
  const tableName = 'harvested_data';
  
  // Create table
  let sql = `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
  sql += '  id INTEGER PRIMARY KEY AUTOINCREMENT,\n';
  sql += fieldsList.map(field => `  ${field} TEXT`).join(',\n');
  sql += '\n);\n\n';
  
  // Create INSERT statements
  sql += `INSERT INTO ${tableName} (${fieldsList.join(', ')}) VALUES\n`;
  
  const rows = data.map(item => {
    const values = fieldsList.map(field => {
      const value = item[field] !== undefined ? String(item[field]).replace(/'/g, "''") : '';
      return `'${value}'`;
    }).join(', ');
    
    return `(${values})`;
  }).join(',\n');
  
  sql += rows + ';';
  
  return sql;
}

// Show toast notification
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = '';
  switch (type) {
    case 'success':
      icon = '<i class="fas fa-check-circle toast-icon"></i>';
      break;
    case 'error':
      icon = '<i class="fas fa-exclamation-circle toast-icon"></i>';
      break;
    case 'warning':
      icon = '<i class="fas fa-exclamation-triangle toast-icon"></i>';
      break;
    default:
      icon = '<i class="fas fa-info-circle toast-icon"></i>';
  }
  
  toast.innerHTML = `
    ${icon}
    <div class="toast-message">${message}</div>
  `;
  
  const container = document.getElementById('toast-container');
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);
}

// Show about dialog
function showAbout(e) {
  e.preventDefault();
  alert(`BrowserHarvest v1.0.0\n\nเครื่องมือดึงข้อมูลเว็บอัตโนมัติ ที่ใช้งานง่ายและยืดหยุ่น\n\nพัฒนาโดยใช้ Electron และ Playwright สำหรับการควบคุม Browser`);
}

// Show help dialog
function showHelp(e) {
  e.preventDefault();
  ipcRenderer.invoke('open-external-url', 'https://github.com/example/browserharvest/wiki');
}

// Event listeners for IPC
ipcRenderer.on('page-loaded', (event, data) => {
  // Update browser preview
  document.getElementById('browser-preview').style.display = 'block';
  document.querySelector('.preview-url').textContent = data.title || data.url;
  if (data.screenshot) {
    document.getElementById('page-screenshot').src = `data:image/jpeg;base64,${data.screenshot}`;
  }
  harvestState.textContent = 'พร้อม';
  browserOpen = true;
  updateUI();
});

ipcRenderer.on('selection-mode-active', (event, data) => {
  showToast(`กำลังเลือก${data.type === 'pagination' ? 'ปุ่มเลื่อนหน้า' : 'องค์ประกอบ'} คลิกที่องค์ประกอบบนหน้าเว็บ`, 'info', 3000);
});

ipcRenderer.on('harvested-page', (event, data) => {
  // Update progress
  updateHarvestProgress(data.page, parseInt(maxPages.value) || 1, data.totalRecords);
  showToast(`เก็บข้อมูลหน้า ${data.page} สำเร็จ: ${data.records.length} รายการ`, 'success', 2000);
});

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', init);