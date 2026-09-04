const SPREADSHEET_ID="1fIwjxQdN64AH2TS362EHL_G3-QCcjMtqj8c2-lC4QQM";
const RESULT_SHEET="QuizResults",CONFIG_SHEET="QuizConfig",QUESTION_SHEET="QuizQuestions";
const HEADERS=["Timestamp","Week","Name","Phone","Community","Score","DurationSeconds","Answers","Consent","Status"];
const ADMIN_USERNAME="ratufinansial";
const ADMIN_PASSWORD_SHA256="799349982629b0e5843f8632b062042dc75d479df94b7d59e6d49856eb24f51e";
const DEFAULT_CONFIG={week:"2026-W36",questionCount:10,openAt:"2026-09-01T00:00:00+07:00",closeAt:"2026-09-30T23:59:59+07:00"};
const DEFAULT_QUESTIONS=[
  ["Apa langkah pertama sebelum menentukan jumlah tabungan?","Menentukan tujuan menabung","Membeli barang diskon","Meminjam uang",0],
  ["Tempat menyimpan dana darurat sebaiknya…","Mudah diakses saat perlu dan tetap aman","Disimpan seluruhnya dalam bentuk barang","Dipinjamkan tanpa catatan",0],
  ["Jika seseorang meminta kode OTP melalui chat, Ibu sebaiknya…","Memberikannya agar urusan cepat","Menolak dan menghubungi kanal resmi","Mengirimnya ke grup keluarga",1],
  ["Tanda yang perlu dicurigai dari tawaran investasi adalah…","Ada penjelasan risiko","Menjanjikan keuntungan pasti sangat tinggi","Lembaganya dapat diperiksa",1],
  ["Apa perbedaan penting antara tabungan dan investasi?","Investasi selalu untung","Tabungan tidak bisa diambil","Nilai investasi dapat naik atau turun",2],
  ["Sebelum membeli produk investasi, yang paling penting adalah…","Memahami tujuan, risiko, dan legalitas","Mengikuti pilihan teman","Memakai seluruh uang belanja",0],
  ["Cara awal menemukan ide usaha yang cocok adalah…","Meniru semua usaha viral","Melihat keterampilan dan kebutuhan sekitar","Langsung menyewa toko",1],
  ["Cara paling aman menguji produk baru adalah…","Produksi sangat banyak","Berutang untuk modal besar","Tawarkan contoh ke beberapa calon pembeli",2],
  ["Keunggulan pembeda produk dapat berupa…","Rasa, ukuran, kemasan, atau layanan","PIN rekening penjual","Jumlah utang usaha",0],
  ["Informasi yang tidak boleh diberikan kepada pembeli adalah…","Harga produk","Jadwal pemesanan","PIN dan kode OTP",2]
];

function doGet(e){
  try{
    const action=String(e&&e.parameter&&e.parameter.action||"leaderboard");
    if(action==="health")return json_({ok:true,service:"ratu-finansial",sheet:resultSheet_().getName()});
    if(action==="quizConfig"){const config=getConfig_(),questions=getQuestions_();return json_({ok:true,config:config,isOpen:isQuizOpen_(config),questions:questions.map(q=>({text:q.text,answers:q.answers}))});}
    if(action!=="leaderboard")throw new Error("Aksi tidak dikenal");
    const config=getConfig_(),week=String(e.parameter.week||config.week);
    return json_({ok:true,rows:getLeaderboard_(week,Number(e.parameter.limit)||50,false)});
  }catch(err){return json_({ok:false,error:publicError_(err)});}
}

function doPost(e){
  try{
    const b=JSON.parse(e&&e.postData&&e.postData.contents||"{}");
    if(b.action==="adminLogin")return adminLogin_(b);
    if(b.action==="adminLogout")return adminLogout_(b);
    if(b.action==="adminSnapshot"){requireAdmin_(b.token);return json_(adminSnapshot_());}
    if(b.action==="saveSettings"){requireAdmin_(b.token);return saveSettings_(b);}
    if(b.action==="submitQuiz")return submitQuiz_(b);
    throw new Error("Aksi tidak dikenal");
  }catch(err){return json_({ok:false,error:publicError_(err)});}
}

function submitQuiz_(b){
  const lock=LockService.getScriptLock();
  try{
    lock.waitLock(10000);
    const config=getConfig_();if(!isQuizOpen_(config))throw new Error("Kuis sedang ditutup");
    if(b.consent!==true)throw new Error("Persetujuan penggunaan data wajib diberikan");
    if(String(b.week)!==config.week)throw new Error("Periode kuis tidak aktif");
    const name=safeText_(b.name,50),community=safeText_(b.community,50),phone=phone_(b.phone),duration=Math.round(Number(b.duration));
    const questions=getQuestions_(),answers=validateAnswers_(b.answers,questions.length);
    if(!name||!community)throw new Error("Identitas belum lengkap");
    if(!Number.isFinite(duration)||duration<1||duration>7200)throw new Error("Durasi tidak valid");
    const sheet=resultSheet_(),rows=sheet.getDataRange().getValues();
    if(rows.slice(1).some(r=>String(r[1])===config.week&&normaliseStoredPhone_(r[3])===phone))throw new Error("Nomor WhatsApp ini sudah mengikuti kuis minggu ini");
    const correct=answers.reduce((sum,answer,i)=>sum+(answer===questions[i].correct?1:0),0),score=Math.round(correct/questions.length*100);
    const status=duration<Math.max(10,questions.length*2)?"REVIEW":"VALID";
    sheet.appendRow([new Date(),config.week,name,phone,community,score,duration,JSON.stringify(answers),true,status]);SpreadsheetApp.flush();
    return json_({ok:true,score:score,rank:rank_(config.week,phone),status:status});
  }finally{try{lock.releaseLock();}catch(_){}}
}

function adminLogin_(b){
  const cache=CacheService.getScriptCache(),blocked=Number(cache.get("admin-login-failures")||0);
  if(blocked>=8)throw new Error("Terlalu banyak percobaan. Tunggu 10 menit");
  const username=String(b.username||"").trim().toLowerCase(),passwordHash=sha256_(String(b.password||""));
  if(username!==ADMIN_USERNAME||passwordHash!==ADMIN_PASSWORD_SHA256){cache.put("admin-login-failures",String(blocked+1),600);throw new Error("Username atau password salah");}
  cache.remove("admin-login-failures");const token=Utilities.getUuid()+Utilities.getUuid();cache.put("admin-session-"+sha256_(token),"1",21600);
  return json_({ok:true,token:token,expiresIn:21600});
}
function adminLogout_(b){CacheService.getScriptCache().remove("admin-session-"+sha256_(String(b.token||"")));return json_({ok:true});}
function requireAdmin_(token){if(!token||CacheService.getScriptCache().get("admin-session-"+sha256_(String(token)))!=="1")throw new Error("Sesi admin tidak valid");}
function adminSnapshot_(){const config=getConfig_(),participants=allParticipants_();return {ok:true,config:config,questions:getQuestions_(),isOpen:isQuizOpen_(config),participants:participants,leaderboard:getLeaderboard_("",50,true)};}

function saveSettings_(b){
  const lock=LockService.getScriptLock();
  try{
    lock.waitLock(10000);const c=b.config||{},week=safeText_(c.week,20),openAt=new Date(c.openAt),closeAt=new Date(c.closeAt),questions=validateAdminQuestions_(b.questions);
    if(!week)throw new Error("Periode wajib diisi");if(!Number.isFinite(openAt.getTime())||!Number.isFinite(closeAt.getTime())||openAt>=closeAt)throw new Error("Jadwal kuis tidak valid");
    const config={week:week,questionCount:questions.length,openAt:openAt.toISOString(),closeAt:closeAt.toISOString()},cs=configSheet_();
    cs.clearContents();cs.getRange(1,1,1,2).setValues([["Key","Value"]]);cs.getRange(2,1,4,2).setValues(Object.entries(config));cs.setFrozenRows(1);
    const qs=questionSheet_();qs.clearContents();qs.getRange(1,1,1,6).setValues([["Order","Question","AnswerA","AnswerB","AnswerC","CorrectIndex"]]);qs.getRange(2,1,questions.length,6).setValues(questions.map((q,i)=>[i+1,q.text,q.answers[0],q.answers[1],q.answers[2],q.correct]));qs.setFrozenRows(1);SpreadsheetApp.flush();
    return json_({ok:true,config:config});
  }finally{try{lock.releaseLock();}catch(_){}}
}

function validateAdminQuestions_(value){if(!Array.isArray(value)||value.length<1||value.length>30)throw new Error("Jumlah soal harus 1 sampai 30");return value.map(q=>{const text=safeText_(q.text,300),answers=Array.isArray(q.answers)?q.answers.map(a=>safeText_(a,180)):[],correct=Number(q.correct);if(!text||answers.length!==3||answers.some(a=>!a)||!Number.isInteger(correct)||correct<0||correct>2)throw new Error("Isi soal belum lengkap");return{text:text,answers:answers,correct:correct};});}
function validateAnswers_(value,count){if(!Array.isArray(value)||value.length!==count)throw new Error("Jawaban kuis tidak lengkap");return value.map(v=>{const n=Number(v);if(!Number.isInteger(n)||n<0||n>2)throw new Error("Jawaban kuis tidak valid");return n;});}
function getConfig_(){const sheet=configSheet_(),rows=sheet.getDataRange().getValues().slice(1),result=Object.assign({},DEFAULT_CONFIG);rows.forEach(r=>{if(r[0])result[String(r[0])]=r[1]});result.questionCount=Number(result.questionCount)||10;return result;}
function getQuestions_(){const sheet=questionSheet_(),rows=sheet.getDataRange().getValues().slice(1).filter(r=>r[1]);return rows.map(r=>({text:String(r[1]),answers:[String(r[2]),String(r[3]),String(r[4])],correct:Number(r[5])}));}
function isQuizOpen_(config){const now=Date.now(),start=new Date(config.openAt).getTime(),end=new Date(config.closeAt).getTime();return Number.isFinite(start)&&Number.isFinite(end)&&now>=start&&now<=end;}
function getLeaderboard_(week,limit,allWeeks){return resultRows_().filter(r=>(allWeeks||String(r[1])===week)&&String(r[9]).toUpperCase()==="VALID").sort(sortRows_).slice(0,Math.min(Math.max(limit,1),50)).map((r,i)=>({rank:i+1,name:allWeeks?String(r[2]).replace(/^'/,""):mask_(r[2]),community:String(r[4]).replace(/^'/,""),score:Number(r[5])||0,duration:Number(r[6])||0,week:String(r[1])}));}
function allParticipants_(){return resultRows_().sort((a,b)=>new Date(b[0])-new Date(a[0])).map(r=>({timestamp:new Date(r[0]).toISOString(),week:String(r[1]),name:String(r[2]).replace(/^'/,""),phone:String(r[3]),community:String(r[4]).replace(/^'/,""),score:Number(r[5])||0,duration:Number(r[6])||0,status:String(r[9]||"")}));}
function rank_(week,phone){const i=resultRows_().filter(r=>String(r[1])===week&&String(r[9]).toUpperCase()==="VALID").sort(sortRows_).findIndex(r=>normaliseStoredPhone_(r[3])===phone);return i<0?null:i+1;}
function sortRows_(a,b){return(Number(b[5])-Number(a[5]))||(Number(a[6])-Number(b[6]))||(new Date(a[0])-new Date(b[0]));}
function resultRows_(){return resultSheet_().getDataRange().getValues().slice(1);}
function book_(){return SpreadsheetApp.openById(SPREADSHEET_ID);}
function resultSheet_(){const file=book_();let sheet=file.getSheetByName(RESULT_SHEET);if(!sheet){sheet=file.insertSheet(RESULT_SHEET);sheet.appendRow(HEADERS);sheet.setFrozenRows(1);}return sheet;}
function configSheet_(){const file=book_();let sheet=file.getSheetByName(CONFIG_SHEET);if(!sheet){sheet=file.insertSheet(CONFIG_SHEET);sheet.getRange(1,1,5,2).setValues([["Key","Value"],...Object.entries(DEFAULT_CONFIG)]);sheet.setFrozenRows(1);}return sheet;}
function questionSheet_(){const file=book_();let sheet=file.getSheetByName(QUESTION_SHEET);if(!sheet){sheet=file.insertSheet(QUESTION_SHEET);sheet.getRange(1,1,1,6).setValues([["Order","Question","AnswerA","AnswerB","AnswerC","CorrectIndex"]]);sheet.getRange(2,1,DEFAULT_QUESTIONS.length,6).setValues(DEFAULT_QUESTIONS.map((q,i)=>[i+1,...q]));sheet.setFrozenRows(1);}return sheet;}
function phone_(v){const phone=normaliseStoredPhone_(v);if(phone.length<10||phone.length>15)throw new Error("Nomor WhatsApp tidak valid");return phone;}
function normaliseStoredPhone_(v){let p=String(v||"").replace(/\D/g,"");if(p.startsWith("0"))p="62"+p.slice(1);return p;}
function safeText_(v,max){let s=String(v||"").replace(/[<>\u0000-\u001F]/g,"").trim().slice(0,max||80);if(/^[=+\-@]/.test(s))s="'"+s;return s;}
function mask_(name){const p=String(name||"").replace(/^'/,"").trim().split(/\s+/);return p[0]+(p[1]?" "+p[1][0]+".":"");}
function sha256_(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8).map(b=>(b+256)%256).map(b=>("0"+b.toString(16)).slice(-2)).join("");}
function publicError_(err){const allowed=["Aksi tidak dikenal","Kuis sedang ditutup","Persetujuan penggunaan data wajib diberikan","Periode kuis tidak aktif","Identitas belum lengkap","Durasi tidak valid","Nomor WhatsApp ini sudah mengikuti kuis minggu ini","Nomor WhatsApp tidak valid","Jawaban kuis tidak lengkap","Jawaban kuis tidak valid","Username atau password salah","Terlalu banyak percobaan. Tunggu 10 menit","Sesi admin tidak valid","Periode wajib diisi","Jadwal kuis tidak valid","Jumlah soal harus 1 sampai 30","Isi soal belum lengkap"];return allowed.includes(err.message)?err.message:"Layanan sedang bermasalah";}
function json_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
