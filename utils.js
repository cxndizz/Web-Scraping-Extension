// BrowserHarvest Export Format Utilities
// File Format Functions

/**
 * แปลง Data เป็น CSV Format
 * @param {Array} data - Array ของ records
 * @param {Array} fields - ชื่อคอลัมน์ที่ต้องการ (optional)
 * @returns {string} - CSV formatted string
 */
function toCSV(data, fields = null) {
  if (!data || !data.length) return '';
  
  // ถ้าไม่ได้ระบุ fields ให้ใช้ keys ทั้งหมดจาก records
  if (!fields) {
    const fieldSet = new Set();
    data.forEach(item => {
      Object.keys(item).forEach(key => {
        // ไม่รวม fields ที่เป็น metadata (ขึ้นต้นด้วย _)
        if (!key.startsWith('_')) {
          fieldSet.add(key);
        }
      });
    });
    fields = Array.from(fieldSet);
  }
  
  // สร้าง header row
  let csv = fields.map(field => `"${field}"`).join(',') + '\n';
  
  // สร้าง data rows
  data.forEach(item => {
    const row = fields.map(field => {
      const value = item[field] !== undefined ? String(item[field]).replace(/"/g, '""') : '';
      return `"${value}"`;
    }).join(',');
    
    csv += row + '\n';
  });
  
  return csv;
}

/**
 * แปลง Data เป็น JSON Format
 * @param {Array} data - Array ของ records 
 * @param {boolean} pretty - ต้องการ format ให้อ่านง่ายหรือไม่
 * @returns {string} - JSON formatted string
 */
function toJSON(data, pretty = true) {
  if (!data || !data.length) return '[]';
  
  // คัดกรอง metadata ออก
  const cleanData = data.map(item => {
    const cleanItem = {};
    Object.entries(item).forEach(([key, value]) => {
      if (!key.startsWith('_')) {
        cleanItem[key] = value;
      }
    });
    return cleanItem;
  });
  
  return pretty ? JSON.stringify(cleanData, null, 2) : JSON.stringify(cleanData);
}

/**
 * แปลง Data เป็น SQL Format (ทั้ง CREATE TABLE และ INSERT statements)
 * @param {Array} data - Array ของ records
 * @param {string} tableName - ชื่อตาราง
 * @returns {string} - SQL statements
 */
function toSQL(data, tableName = 'scraped_data') {
  if (!data || !data.length) return '';
  
  // หา fields ที่ไม่ใช่ metadata
  const fieldSet = new Set();
  data.forEach(item => {
    Object.keys(item).forEach(key => {
      if (!key.startsWith('_')) {
        fieldSet.add(key);
      }
    });
  });
  const fields = Array.from(fieldSet);
  
  // ลองเดา data type จากค่าในข้อมูล
  const fieldTypes = {};
  fields.forEach(field => {
    fieldTypes[field] = guessFieldType(data, field);
  });
  
  // สร้าง CREATE TABLE statement
  let sql = `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
  sql += `  id INTEGER PRIMARY KEY AUTOINCREMENT,\n`;
  
  sql += fields.map(field => {
    return `  ${field} ${fieldTypes[field]}`;
  }).join(',\n');
  
  sql += '\n);\n\n';
  
  // สร้าง INSERT statements
  sql += `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES\n`;
  
  sql += data.map((item, index) => {
    const values = fields.map(field => {
      const value = item[field];
      
      if (value === null || value === undefined) {
        return 'NULL';
      }
      
      if (fieldTypes[field] === 'INTEGER' || fieldTypes[field] === 'REAL') {
        return isNaN(parseFloat(value)) ? 'NULL' : value;
      } else {
        return `'${String(value).replace(/'/g, "''")}'`;
      }
    }).join(', ');
    
    return `(${values})${index < data.length - 1 ? ',' : ';'}`;
  }).join('\n');
  
  return sql;
}

/**
 * แปลง Data เป็น TSV Format (Tab-separated values)
 * @param {Array} data - Array ของ records 
 * @param {Array} fields - ชื่อคอลัมน์ที่ต้องการ (optional)
 * @returns {string} - TSV formatted string
 */
function toTSV(data, fields = null) {
  if (!data || !data.length) return '';
  
  // ถ้าไม่ได้ระบุ fields ให้ใช้ keys ทั้งหมดจาก records
  if (!fields) {
    const fieldSet = new Set();
    data.forEach(item => {
      Object.keys(item).forEach(key => {
        if (!key.startsWith('_')) {
          fieldSet.add(key);
        }
      });
    });
    fields = Array.from(fieldSet);
  }
  
  // สร้าง header row
  let tsv = fields.join('\t') + '\n';
  
  // สร้าง data rows
  data.forEach(item => {
    const row = fields.map(field => {
      const value = item[field] !== undefined ? String(item[field]).replace(/\t/g, ' ') : '';
      return value;
    }).join('\t');
    
    tsv += row + '\n';
  });
  
  return tsv;
}

/**
 * ทำนายประเภทข้อมูลของฟิลด์จากข้อมูลที่มี
 * @param {Array} data - Array ของ records
 * @param {string} field - ชื่อฟิลด์ที่ต้องการทำนาย
 * @returns {string} - SQL data type (TEXT, INTEGER, REAL, DATE, DATETIME)
 */
function guessFieldType(data, field) {
  // ดึงค่าที่ไม่ใช่ null/undefined ออกมา
  const values = data
    .map(item => item[field])
    .filter(val => val !== null && val !== undefined);
  
  if (values.length === 0) return 'TEXT';
  
  // ตรวจสอบประเภทของข้อมูล
  let allIntegers = true;
  let allNumbers = true;
  let allDates = true;
  
  for (const value of values) {
    const strVal = String(value).trim();
    
    // ตรวจสอบว่าเป็นตัวเลขหรือไม่
    const numVal = parseFloat(strVal.replace(/[^\d.-]/g, ''));
    if (isNaN(numVal)) {
      allIntegers = false;
      allNumbers = false;
    } else {
      if (numVal !== Math.floor(numVal)) {
        allIntegers = false;
      }
    }
    
    // ตรวจสอบว่าเป็นวันที่หรือไม่
    const dateVal = new Date(strVal);
    if (isNaN(dateVal.getTime())) {
      allDates = false;
    }
  }
  
  // ชื่อฟิลด์บ่งบอกประเภทข้อมูล
  const fieldLower = field.toLowerCase();
  
  if (fieldLower.includes('date') || fieldLower.includes('time') || fieldLower.includes('created') || fieldLower.includes('updated')) {
    if (allDates) {
      return fieldLower.includes('time') ? 'DATETIME' : 'DATE';
    }
  }
  
  if (fieldLower.includes('price') || fieldLower.includes('amount') || fieldLower.includes('total') || 
      fieldLower.includes('cost') || fieldLower.includes('fee') || fieldLower.includes('rate')) {
    if (allNumbers) {
      return 'REAL';
    }
  }
  
  if (fieldLower.includes('id') || fieldLower.includes('count') || fieldLower.includes('number') || 
      fieldLower.includes('qty') || fieldLower.includes('age')) {
    if (allIntegers) {
      return 'INTEGER';
    }
  }
  
  // ตรวจสอบประเภทจากข้อมูล
  if (allIntegers) return 'INTEGER';
  if (allNumbers) return 'REAL';
  if (allDates) {
    // ตรวจสอบว่าค่ามีเวลาด้วยหรือไม่
    if (values.some(v => String(v).includes(':'))) {
      return 'DATETIME';
    } else {
      return 'DATE';
    }
  }
  
  return 'TEXT';
}

module.exports = {
  toCSV,
  toJSON,
  toSQL,
  toTSV
};