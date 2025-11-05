# OctoLite Scraper (MV3)

## ติดตั้งแบบ Load unpacked

1. ดาวน์โหลดโฟลเดอร์ `octolite-scraper`
2. เปิด Chrome/Edge → `chrome://extensions` → เปิด **Developer mode**
3. คลิก **Load unpacked** → เลือกโฟลเดอร์นี้
4. ปักหมุดไอคอน OctoLite บน toolbar

## ใช้งานเร็ว (Quick Start)

1. เปิดหน้าเว็บเป้าหมาย
2. เปิด popup → กด **เลือก Selector** แล้วคลิกองค์ประกอบที่อยากเก็บ
3. ปรับ **Fields JSON** ให้ครบฟิลด์ (name/selector/attr)
4. (ถ้ามี) ใส่ selector ของปุ่ม **Next** และจำนวน **Max pages**
5. (ตัวเลือก) เปิด **Infinite scroll**
6. กด **Run** → ดู Log → Export CSV/JSON

### โหมด Simple

- เก็บข้อมูลตาม selector ในแต่ละหน้า
- คลิกปุ่ม Next ไปเรื่อย ๆ (สูงสุด Max pages)

### โหมด List→Detail

- ใส่ **List Link Selector** เป็นลิงก์รายการ
- ใส่ **Detail Fields JSON** สำหรับหน้า detail
- ระบบจะคลิกลิงก์ทีละรายการ → เก็บข้อมูล → `history.back()` กลับ

## หมายเหตุสำคัญ

- เคารพ ToS/robots ของเว็บเป้าหมาย และกฎหมายข้อมูลส่วนบุคคล
- ปรับ `pauseMs/throttleMs` ให้เหมาะสม เพื่อลดภาระเว็บ
- SPA/Infinite list อาจต้องเพิ่มเวลา pause หรือใช้ Infinite scroll ก่อนเริ่มเก็บ
- บางเว็บมี Anti-bot/Virtualized list — ใช้ scroll step/pause ที่มากขึ้น

## โครงสร้างข้อมูล Fields

```json
{
  "name": "title",
  "selector": ".item .title",
  "attr": "text" // หรือ href, src, title, datetime, html, อื่น ๆ ผ่าน getAttribute
}
```
