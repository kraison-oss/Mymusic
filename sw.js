// ตั้งชื่อฐานข้อมูลคลังเก็บไฟล์ในเครื่อง (เปลี่ยนเวอร์ชันได้เมื่อมีการอัปเดตระบบ)
const CACHE_NAME = 'apps-script-pwa-v1';

// รายการไฟล์ที่ต้องการให้บันทึกเก็บไว้ในเครื่องทันทีที่ผู้ใช้เปิดแอป
const assets = [
  '/',
  // หากระบบของคุณดึง CSS หรือ Icon ภายนอกมาใช้ สามารถเอาลิงก์มาใส่ตรงนี้ได้ เพื่อให้โหลดไวขึ้น
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css'
];

// 1. ขั้นตอนติดตั้ง Service Worker และสั่งให้บันทึกไฟล์แคชพื้นฐาน
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('กำลังบันทึกไฟล์ลงแคช...');
      return cache.addAll(assets);
    })
  );
});

// 2. ขั้นตอนการดึงไฟล์: เมื่อเปิดใช้งานแอป ให้ไปดึงไฟล์จากแคชในเครื่องก่อน ถ้าไม่มีค่อยดึงจากเน็ต
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // คืนค่าไฟล์จากเครื่อง (ถ้ามี) หรือไปดาวน์โหลดจากเน็ตปกติ (หากไม่มีในเครื่อง)
      return cachedResponse || fetch(event.request);
    })
  );
});