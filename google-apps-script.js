const SPREADSHEET_ID="1fIwjxQdN64AH2TS362EHL_G3-QCcjMtqj8c2-lC4QQM";
const RESULT_SHEET="QuizResults";
const HEADERS=["Timestamp","Week","Name","Phone","Community","Score","DurationSeconds","Answers","Consent","Status"];
const ACTIVE_WEEK="2026-W36";
const ANSWER_KEY=[0,0,1,1,2,0,1,2,0,2];

function doGet(e){
  try{
    const action=String(e?.parameter?.action||"leaderboard");
    if(action==="health") return json_({ok:true,service:"ratu-finansial",week:ACTIVE_WEEK,sheet:sheet_().getName()});
    if(action!=="leaderboard") throw new Error("Aksi tidak dikenal");
    return json_({ok:true,rows:getLeaderboard_(String(e.parameter.week||ACTIVE_WEEK),Number(e.parameter.limit)||50)});
  }catch(err){return json_({ok:false,error:publicError_(err)});}
}

function doPost(e){
  const lock=LockService.getScriptLock();
  try{
    lock.waitLock(10000);
    const b=JSON.parse(e?.postData?.contents||"{}");
    if(b.action!=="submitQuiz") throw new Error("Aksi tidak dikenal");
    if(b.consent!==true) throw new Error("Persetujuan penggunaan data wajib diberikan");
    if(String(b.week)!==ACTIVE_WEEK) throw new Error("Periode kuis tidak aktif");
    const name=safeText_(b.name,50),community=safeText_(b.community,50),phone=phone_(b.phone);
    const duration=Math.round(Number(b.duration));
    const answers=validateAnswers_(b.answers);
    if(!name||!community) throw new Error("Identitas belum lengkap");
    if(!Number.isFinite(duration)||duration<1||duration>7200) throw new Error("Durasi tidak valid");
    const sheet=sheet_(),rows=sheet.getDataRange().getValues();
    if(rows.slice(1).some(r=>String(r[1])===ACTIVE_WEEK&&normaliseStoredPhone_(r[3])===phone)) throw new Error("Nomor WhatsApp ini sudah mengikuti kuis minggu ini");
    const score=answers.reduce((sum,answer,i)=>sum+(answer===ANSWER_KEY[i]?10:0),0);
    const status=duration<20?"REVIEW":"VALID";
    sheet.appendRow([new Date(),ACTIVE_WEEK,name,phone,community,score,duration,JSON.stringify(answers),true,status]);
    SpreadsheetApp.flush();
    return json_({ok:true,score:score,rank:rank_(ACTIVE_WEEK,phone),status:status});
  }catch(err){return json_({ok:false,error:publicError_(err)});}
  finally{try{lock.releaseLock();}catch(_){}}
}

function validateAnswers_(value){
  if(!Array.isArray(value)||value.length!==ANSWER_KEY.length) throw new Error("Jawaban kuis tidak lengkap");
  return value.map(v=>{const n=Number(v);if(!Number.isInteger(n)||n<0||n>2) throw new Error("Jawaban kuis tidak valid");return n;});
}

function getLeaderboard_(week,limit){
  return rows_(week).slice(0,Math.min(Math.max(limit,1),50)).map((r,i)=>({rank:i+1,name:mask_(r[2]),community:safeText_(r[4],50),score:Number(r[5])||0,duration:Number(r[6])||0}));
}
function rank_(week,phone){const i=rows_(week).findIndex(r=>normaliseStoredPhone_(r[3])===phone);return i<0?null:i+1;}
function rows_(week){return sheet_().getDataRange().getValues().slice(1).filter(r=>String(r[1])===week&&String(r[9]).toUpperCase()==="VALID").sort((a,b)=>(Number(b[5])-Number(a[5]))||(Number(a[6])-Number(b[6]))||(new Date(a[0])-new Date(b[0])));}
function sheet_(){const file=SpreadsheetApp.openById(SPREADSHEET_ID);let sheet=file.getSheetByName(RESULT_SHEET);if(!sheet){sheet=file.insertSheet(RESULT_SHEET);sheet.appendRow(HEADERS);sheet.setFrozenRows(1);}return sheet;}
function phone_(v){const phone=normaliseStoredPhone_(v);if(phone.length<10||phone.length>15) throw new Error("Nomor WhatsApp tidak valid");return phone;}
function normaliseStoredPhone_(v){let p=String(v||"").replace(/\D/g,"");if(p.startsWith("0"))p="62"+p.slice(1);return p;}
function safeText_(v,max){let s=String(v||"").replace(/[<>\u0000-\u001F]/g,"").trim().slice(0,max||80);if(/^[=+\-@]/.test(s))s="'"+s;return s;}
function mask_(name){const p=String(name||"").replace(/^'/,"").trim().split(/\s+/);return p[0]+(p[1]?" "+p[1][0]+".":"");}
function publicError_(err){const allowed=["Aksi tidak dikenal","Persetujuan penggunaan data wajib diberikan","Periode kuis tidak aktif","Identitas belum lengkap","Durasi tidak valid","Nomor WhatsApp ini sudah mengikuti kuis minggu ini","Nomor WhatsApp tidak valid","Jawaban kuis tidak lengkap","Jawaban kuis tidak valid"];return allowed.includes(err.message)?err.message:"Layanan kuis sedang bermasalah";}
function json_(d){return ContentService.createTextOutput(JSON.stringify(d)).setMimeType(ContentService.MimeType.JSON);}
