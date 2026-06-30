// ==========================================
// 1. ส่วนควบคุมการรับ-ส่งข้อมูล (API Web App)
// ==========================================

// 🌐 ฟังก์ชันสำหรับรองรับการดึงข้อมูลจากภายนอก (GET Requests จาก GitHub Pages)
function doGet(e) {
  var action = e.parameter.action;
  
  try {
    // 1.1 ส่งรายชื่อห้องเรียนทั้งหมดกลับไป
    if (action === "getRooms") {
      var rooms = getRooms();
      return ContentService.createTextOutput(JSON.stringify(rooms))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 1.2 ส่งรายวิชาทั้งหมดกลับไป
    if (action === "getSubjects") {
      var subjects = getSubjects();
      return ContentService.createTextOutput(JSON.stringify(subjects))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 1.3 ส่งรายวิชาพร้อมสถานะกลับไปประจำวัน
    if (action === "getSubjectsWithStatus") {
      var room = e.parameter.room;
      var dateStr = e.parameter.date || e.parameter.dateStr; // รองรับพารามิเตอร์ทั้งสองแบบที่หน้าบ้านส่งมา
      var data = getSubjectsWithStatus(room, dateStr);
      return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 1.4 สำคัญมาก! ส่งรายชื่อนักเรียนพร้อมสถานะกลับไป (แก้ปัญหาดึงรายชื่อเด็กไม่ได้)
    if (action === "getStudentList" || action === "getStudents") {
      var room = e.parameter.room;
      var dateStr = e.parameter.date;
      var subjectId = e.parameter.subjectId;
      var data = getStudentList(room, dateStr, subjectId);
      return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 1.5 ส่งรายชื่อนักเรียนรูปแบบข้อความดิบ (สำหรับใช้ในโหมดแก้ไขกลุ่มคละห้อง)
    if (action === "getRawStudentsText") {
      var room = e.parameter.room;
      var rawText = getRawStudentsText(room);
      return ContentService.createTextOutput(rawText)
        .setMimeType(ContentService.MimeType.TEXT);
    }

    // กรณีเปิดลิงก์ผ่านเว็บแอปโดยตรงให้แสดงผลหน้าจอ Index หลัก (หากมี)
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('ระบบเช็คชื่อนักเรียน - โรงเรียนโชคชัยสามัคคี')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 🌐 ฟังก์ชันสำหรับรองรับการส่งข้อมูลมาบันทึกจากภายนอก (POST Requests จาก GitHub Pages)
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var message = "ไม่พบคำสั่งประมวลผลข้อมูลที่ตรงกัน";

    // 2.1 บันทึกข้อมูลเวลาเรียนแบบกลุ่มใหญ่ทั้งห้อง
    if (action === "saveAttendance") {
      message = saveAttendance(data.room, data.date, data.subjectId, data.attendanceData);
    }
    
    // 2.2 บันทึกข้อมูลแยกรายบุคคลเฉพาะคน
    else if (action === "saveSingleStudentAttendance") {
      message = saveSingleStudentAttendance(data.room, data.date, data.subjectId, data.studentId, data.studentName, data.status);
    }
    
    // 2.3 อัปโหลดรายชื่อเด็กแบบคละห้อง/กลุ่มพิเศษ (Bulk Import)
    else if (action === "importStudentsBulk") {
      message = importStudentsBulk(data.levelStr, data.roomNum, data.rawText);
    }
    
    // 2.4 ลบข้อมูลนักเรียนทั้งห้องเรียน/กลุ่มเรียน
    else if (action === "deleteEntireRoom") {
      message = deleteEntireRoom(data.room);
    }
    
    // 2.5 เพิ่มรายวิชาเรียนใหม่จากหน้าต่างตั้งค่า
    else if (action === "addSubjectFromForm") {
      message = addSubjectFromForm(data.name, data.id, data.teacher, data.hours, data.period);
    }
    
    // 2.6 แก้ไขอัปเดตข้อมูลวิชาเรียนเดิมที่มีอยู่
    else if (action === "updateSubjectData") {
      message = updateSubjectData(data.oldId, data.name, data.id, data.teacher, data.hours, data.period);
    }
    
    // 2.7 ลบรายวิชาเรียนใดรายวิชาหนึ่งออก
    else if (action === "deleteSubjectData") {
      message = deleteSubjectData(data.subjectId);
    }
    
    // 2.8 ล้างฐานข้อมูลรายวิชาเรียนออกทั้งหมด
    else if (action === "deleteAllSubjects") {
      message = deleteAllSubjects();
    }

    return ContentService.createTextOutput(JSON.stringify({ "status": "success", "message": message }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================
// 2. ส่วนฟังก์ชันแกนหลักประมวลผลร่วมกับแผ่นงาน
// ==========================================

// 1. ดึงรายชื่อห้องเรียนทั้งหมด
function getRooms() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("รายชื่อนักเรียน");
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var rooms = [];
  for (var i = 1; i < data.length; i++) {
    var room = data[i][4]; // คอลัมน์ E (ห้องเรียน)
    if (room && rooms.indexOf(room) === -1) {
      rooms.push(room);
    }
  }
  return rooms.sort();
}

// 2. ดึงรายวิชาทั้งหมด
function getSubjects() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("รายวิชา");
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var subjects = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) {
      subjects.push({
        id: data[i][1],      // รหัสวิชา (B)
        name: data[i][0],    // ชื่อวิชา (A)
        teacher: data[i][2], // ครูผู้สอน (C)
        hours: data[i][3],   // เวลาเรียน (D)
        period: data[i][4]   // คาบเรียน (E)
      });
    }
  }
  return subjects;
}

// 3. ดึงวิชาพร้อมสถานะการบันทึกในวันนั้นๆ
function getSubjectsWithStatus(room, dateStr) {
  var subjects = getSubjects();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("บันทึกเวลาเรียน");
  if (!sheet) return subjects;
  
  var data = sheet.getDataRange().getValues();
  var savedSubjectIds = [];
  
  for (var i = 1; i < data.length; i++) {
    var rowDate = data[i][0];
    var formattedRowDate = "";
    if (rowDate instanceof Date) {
      formattedRowDate = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
    } else {
      formattedRowDate = String(rowDate).split("T")[0];
    }
    
    if (formattedRowDate === dateStr && String(data[i][2]).trim() === String(room).trim()) {
      var subId = data[i][3];
      if (savedSubjectIds.indexOf(subId) === -1) {
        savedSubjectIds.push(subId);
      }
    }
  }
  
  return subjects.map(function(sub) {
    return {
      id: sub.id,
      name: sub.name,
      teacher: sub.teacher,
      hours: sub.hours,
      period: sub.period,
      isSaved: savedSubjectIds.indexOf(sub.id) !== -1
    };
  });
}

// 4. ดึงรายชื่อนักเรียนและสถานะการลงเวลา
function getStudentList(room, dateStr, subjectId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // ดึงประวัติการลงเวลาก่อน
  var attendanceSheet = ss.getSheetByName("บันทึกเวลาเรียน");
  var savedStatus = {};
  var isEditMode = false;
  
  if (attendanceSheet) {
    var attData = attendanceSheet.getDataRange().getValues();
    for (var i = 1; i < attData.length; i++) {
      var rowDate = attData[i][0];
      var formattedRowDate = "";
      if (rowDate instanceof Date) {
        formattedRowDate = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
      } else {
        formattedRowDate = String(rowDate).split("T")[0];
      }
      
      if (formattedRowDate === dateStr && 
          String(attData[i][2]).trim() === String(room).trim() && 
          String(attData[i][3]).trim() === String(subjectId).trim()) {
        
        var stdId = attData[i][4];
        savedStatus[stdId] = attData[i][6]; // สถานะ (G)
        isEditMode = true;
      }
    }
  }
  
  // ดึงรายชื่อนักเรียนหลัก
  var studentSheet = ss.getSheetByName("รายชื่อนักเรียน");
  if (!studentSheet) return { students: [], isEdit: false };
  
  var stdData = studentSheet.getDataRange().getValues();
  var students = [];
  
  for (var j = 1; j < stdData.length; j++) {
    if (String(stdData[j][4]).trim() === String(room).trim()) {
      var stdId = stdData[j][1];
      students.push({
        no: stdData[j][0],
        id: stdId,
        name: stdData[j][2],
        gender: stdData[j][3],
        room: stdData[j][4],
        status: savedStatus[stdId] || "มา" // ถ้าไม่มีประวัติ ให้ค่าเริ่มต้นเป็น "มา"
      });
    }
  }
  
  // จัดเรียงเลขที่
  students.sort(function(a, b) { return a.no - b.no; });
  return { students: students, isEdit: isEditMode };
}

// 5. บันทึกข้อมูลเวลาเรียนแบบกลุ่ม (ทับข้อมูลเดิมในวัน/วิชานั้นๆ)
function saveAttendance(room, dateStr, subjectId, attendanceData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("บันทึกเวลาเรียน");
  if (!sheet) {
    sheet = ss.insertSheet("บันทึกเวลาเรียน");
    sheet.appendRow(["วันที่", "คาบเรียน", "ห้องเรียน/กลุ่ม", "รหัสวิชา", "เลขประจำตัว", "ชื่อ-นามสกุล", "สถานะ"]);
  }
  
  var data = sheet.getDataRange().getValues();
  // ลบข้อมูลเก่าที่ซ้ำออกก่อน (โหมดแก้ไขย้อนหลัง)
  for (var i = data.length - 1; i >= 1; i--) {
    var rowDate = data[i][0];
    var formattedRowDate = "";
    if (rowDate instanceof Date) {
      formattedRowDate = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
    } else {
      formattedRowDate = String(rowDate).split("T")[0];
    }
    
    if (formattedRowDate === dateStr && 
        String(data[i][2]).trim() === String(room).trim() && 
        String(data[i][3]).trim() === String(subjectId).trim()) {
      sheet.deleteRow(i + 1);
    }
  }
  
  // ค้นหารายละเอียดวิชาเพื่อเอา คาบเรียน
  var subSheet = ss.getSheetByName("รายวิชา");
  var periodStr = "ไม่ระบุ";
  if (subSheet) {
    var subData = subSheet.getDataRange().getValues();
    for (var k = 1; k < subData.length; k++) {
      if (String(subData[k][1]).trim() === String(subjectId).trim()) {
        periodStr = subData[k][4] || "ไม่ระบุ";
        break;
      }
    }
  }
  
  // บันทึกข้อมูลชุดใหม่ลงไป
  var rowsToAdd = [];
  attendanceData.forEach(function(item) {
    rowsToAdd.push([dateStr, periodStr, room, subjectId, item.id, item.name, item.status]);
  });
  
  if (rowsToAdd.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
  }
  
  return "💾 บันทึกข้อมูลห้อง " + room + " จำนวน " + attendanceData.length + " คน ลง Google Sheets สำเร็จเรียบร้อยแล้ว!";
}

// 6. บันทึกข้อมูลแยกรายบุคคล
function saveSingleStudentAttendance(room, dateStr, subjectId, studentId, studentName, status) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("บันทึกเวลาเรียน");
  if (!sheet) return "ไม่พบแผ่นงานบันทึกเวลาเรียน";
  
  var data = sheet.getDataRange().getValues();
  var foundRow = -1;
  
  for (var i = 1; i < data.length; i++) {
    var rowDate = data[i][0];
    var formattedRowDate = "";
    if (rowDate instanceof Date) {
      formattedRowDate = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
    } else {
      formattedRowDate = String(rowDate).split("T")[0];
    }
    
    if (formattedRowDate === dateStr && 
        String(data[i][2]).trim() === String(room).trim() && 
        String(data[i][3]).trim() === String(subjectId).trim() && 
        String(data[i][4]).trim() === String(studentId).trim()) {
      foundRow = i + 1;
      break;
    }
  }
  
  if (foundRow !== -1) {
    sheet.getRange(foundRow, 7).setValue(status); // อัปเดตคอลัมน์ G
    return "📝 อัปเดตสถานะของ " + studentName + " เป็น [" + status + "] เรียบร้อย!";
  } else {
    var subSheet = ss.getSheetByName("รายวิชา");
    var periodStr = "ไม่ระบุ";
    if (subSheet) {
      var subData = subSheet.getDataRange().getValues();
      for (var k = 1; k < subData.length; k++) {
        if (String(subData[k][1]).trim() === String(subjectId).trim()) {
          periodStr = subData[k][4] || "ไม่ระบุ";
          break;
        }
      }
    }
    sheet.appendRow([dateStr, periodStr, room, subjectId, studentId, studentName, status]);
    return "📥 บันทึกสถานะใหม่ของ " + studentName + " เป็น [" + status + "] สำเร็จ!";
  }
}

// 7. ดึงรายชื่อนักเรียนรูปแบบข้อความดิบ
function getRawStudentsText(room) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("รายชื่อนักเรียน");
  if (!sheet) return "";
  var data = sheet.getDataRange().getValues();
  var lines = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][4]).trim() === String(room).trim()) {
      lines.push(data[i][0] + "\t" + data[i][1] + "\t" + data[i][2]);
    }
  }
  return lines.join("\n");
}

// 8. นำเข้ารายชื่อนักเรียนแบบกลุ่มใหญ่ (Bulk Import)
function importStudentsBulk(levelStr, roomNum, rawText) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("รายชื่อนักเรียน");
  if (!sheet) {
    sheet = ss.insertSheet("รายชื่อนักเรียน");
    sheet.appendRow(["เลขที่", "เลขประจำตัว", "ชื่อ-นามสกุล", "เพศ", "ห้องเรียน"]);
  }
  
  var roomName = levelStr.trim() + " ห้อง " + roomNum.trim();
  var existingData = sheet.getDataRange().getValues();
  
  for (var i = existingData.length - 1; i >= 1; i--) {
    if (String(existingData[i][4]).trim() === roomName.trim()) {
      sheet.deleteRow(i + 1);
    }
  }
  
  var lines = rawText.split("\n");
  var rowsToAdd = [];
  
  for (var j = 0; j < lines.length; j++) {
    var line = lines[j].trim();
    if (!line) continue;
    
    var parts = line.split(/\s+/);
    if (parts.length >= 3) {
      var no = parts[0];
      var id = parts[1];
      var name = parts.slice(2).join(" ");
      var gender = (name.indexOf("เด็กชาย") === 0 || name.indexOf("นาย") === 0) ? "ชาย" : "หญิง";
      rowsToAdd.push([no, id, name, gender, roomName]);
    }
  }
  
  if (rowsToAdd.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
    return "✅ นำเข้าข้อมูลกลุ่ม [" + roomName + "] จำนวน " + rowsToAdd.length + " คน ลงฐานข้อมูลหลักสำเร็จ!";
  }
  return "❌ ไม่พบรูปแบบข้อมูลที่ถูกต้องในการประมวลผล";
}

// 9. ลบข้อมูลนักเรียนทั้งห้องเรียน
function deleteEntireRoom(roomName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("รายชื่อนักเรียน");
  if (!sheet) return "ไม่พบแผ่นงานรายชื่อนักเรียน";
  var data = sheet.getDataRange().getValues();
  var count = 0;
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][4]).trim() === String(roomName).trim()) {
      sheet.deleteRow(i + 1);
      count++;
    }
  }
  return "🗑️ ลบข้อมูลรายชื่อนักเรียนของกลุ่ม [" + roomName + "] ออกจากระบบถาวรจำนวน " + count + " รายการสำเร็จ!";
}

// 10. ฟังก์ชันจัดการรายวิชาเพิ่มเติม
function addSubjectFromForm(name, id, teacher, hours, period) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("รายวิชา");
  if (!sheet) {
    sheet = ss.insertSheet("รายวิชา");
    sheet.appendRow(["ชื่อวิชา", "รหัสวิชา", "ผู้สอน", "หน่วยกิต/ชั่วโมง", "คาบเรียน"]);
  }
  sheet.appendRow([name, id, teacher, hours, period]);
  return "✅ บันทึกรายวิชาใหม่ [" + id + " - " + name + "] สำเร็จ!";
}

function updateSubjectData(oldId, name, id, teacher, hours, period) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("รายวิชา");
  if (!sheet) return "ไม่พบแผ่นงานรายวิชา";
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(oldId).trim()) {
      sheet.getRange(i + 1, 1, 1, 5).setValues([[name, id, teacher, hours, period]]);
      return "📝 อัปเดตข้อมูลรายวิชาสำเร็จ!";
    }
  }
  return "❌ ไม่พบรหัสวิชาเดิมที่ต้องการแก้ไข";
}

function deleteSubjectData(subjectId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("รายวิชา");
  if (!sheet) return "ไม่พบแผ่นงานรายวิชา";
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][1]).trim() === String(subjectId).trim()) {
      sheet.deleteRow(i + 1);
      return "🗑️ ลบรหัสวิชา " + subjectId + " ออกจากระบบแล้ว";
    }
  }
  return "❌ ไม่พบรหัสวิชาที่ระบุ";
}

function deleteAllSubjects() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("รายวิชา");
  if (!sheet) return "ไม่พบแผ่นงานรายวิชา";
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
  return "🗑️ ดำเนินการล้างข้อมูลรายวิชาทั้งหมดเรียบร้อยแล้ว";
}
