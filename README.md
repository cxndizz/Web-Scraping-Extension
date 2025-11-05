# OctoLite Scraper (MV3)

## ติดตั้งแบบ Load unpacked

1. ดาวน์โหลดโฟลเดอร์ `octolite-scraper`
2. เปิด Chrome/Edge → `chrome://extensions` → เปิด **Developer mode**
3. คลิก **Load unpacked** → เลือกโฟลเดอร์นี้
4. ปักหมุดไอคอน OctoLite บน toolbar

## ใช้งานเร็ว (Quick Start)

### DOM Scraping
1. เปิดหน้าเว็บเป้าหมาย
2. เปิด popup → กด **เลือก Selector** แล้วคลิกองค์ประกอบที่อยากเก็บ
3. ปรับ **Fields JSON** ให้ครบฟิลด์ (name/selector/attr)
4. (ถ้ามี) ใส่ selector ของปุ่ม **Next** และจำนวน **Max pages**
5. (ตัวเลือก) เปิด **Infinite scroll**
6. กด **Run** → ดู Log → Export CSV/JSON

### API Scraping (ใหม่!)
1. เปิดหน้าเว็บที่ใช้ API/XHR โหลดข้อมูล
2. กดปุ่ม **สถานะหน้า** เพื่อจับ XHR requests ล่าสุด
3. ระบบจะดึง URL, Headers, Body จาก request
4. ปรับ **Data Path** ไปยังอาร์เรย์ข้อมูลหลัก (เช่น "data.items")
5. ปรับ **Field Mapping** (ซ้าย: ชื่อฟิลด์ผลลัพธ์, ขวา: path ใน JSON)
6. กำหนดการแบ่งหน้า (Page, Offset, Cursor)
7. กด **Run** → API จะถูกเรียกโดยตรงจาก background

### โหมด Simple
- เก็บข้อมูลตาม selector ในแต่ละหน้า
- คลิกปุ่ม Next ไปเรื่อย ๆ (สูงสุด Max pages)

### โหมด List→Detail
- ใส่ **List Link Selector** เป็นลิงก์รายการ
- ใส่ **Detail Fields JSON** สำหรับหน้า detail
- ระบบจะคลิกลิงก์ทีละรายการ → เก็บข้อมูล → `history.back()` กลับ

### โหมด API (ใหม่!)
- ดึงข้อมูลจาก API/XHR โดยตรง ไม่ต้องใช้ DOM
- ประสิทธิภาพสูงกว่า ทำงานในเบื้องหลังผ่าน background worker
- รองรับการแบ่งหน้าแบบ Page, Offset, และ Cursor
- ควบคุม rate limiting ด้วย throttle

## หมายเหตุสำคัญ

- เคารพ ToS/robots ของเว็บเป้าหมาย และกฎหมายข้อมูลส่วนบุคคล
- ปรับ `pauseMs/throttleMs` ให้เหมาะสม เพื่อลดภาระเว็บ
- SPA/Infinite list อาจต้องเพิ่มเวลา pause หรือใช้ Infinite scroll ก่อนเริ่มเก็บ
- บางเว็บมี Anti-bot/Virtualized list — ใช้ scroll step/pause ที่มากขึ้น
- โหมด API ใช้งานได้ดีกับเว็บแอพที่ดึงข้อมูลจาก API/XHR
- ระมัดระวังในการเรียก API บ่อยเกินไป (ควรใช้ throttle มากกว่า 1000ms)
- ไม่ควรใช้เครื่องมือนี้เพื่อการละเมิดลิขสิทธิ์หรือข้อตกลงการใช้งานเว็บไซต์

## โครงสร้างข้อมูล Fields (DOM mode)

```json
{
  "name": "title",
  "selector": ".item .title",
  "attr": "text" // หรือ href, src, title, datetime, html, อื่น ๆ ผ่าน getAttribute
}
```

## โครงสร้างข้อมูล Field Mapping (API mode)

```json
{
  "title": "name",
  "link": "url",
  "image": "images.0.url",
  "price": "price.amount"
}
```