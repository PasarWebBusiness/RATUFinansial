const SPREADSHEET_ID="1fIwjxQdN64AH2TS362EHL_G3-QCcjMtqj8c2-lC4QQM";
const RESULT_SHEET="QuizResults",CONFIG_SHEET="QuizConfig",QUESTION_SHEET="QuizQuestions",PROFILE_SHEET="Profiles",FINANCE_SHEET="FinanceTransactions";
const HEADERS=["Timestamp","Week","Name","Phone","Community","Score","DurationSeconds","Answers","Consent","Status"];
const PROFILE_HEADERS=["ProfileId","CreatedAt","UpdatedAt","Name","Phone","Community","PinSalt","PinHash","Status"];
const FINANCE_HEADERS=["TransactionId","ProfileId","CreatedAt","Date","Type","Amount","Category","Note","DeletedAt"];
const FINANCE_CATEGORIES=["Belanja dapur","Tagihan","Transportasi","Pendidikan","Kesehatan","Usaha","Gaji/Pendapatan","Lainnya"];
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
    return json_({ok:true,rows:getLeaderboard_(week,Math.min(Number(e.parameter.limit)||5,5),false)});
  }catch(err){return json_({ok:false,error:publicError_(err)});}
}

function doPost(e){
  try{
    const b=JSON.parse(e&&e.postData&&e.postData.contents||"{}");
    if(b.action==="adminLogin")return adminLogin_(b);
    if(b.action==="adminLogout")return adminLogout_(b);
    if(b.action==="adminSnapshot"){requireAdmin_(b.token);return json_(adminSnapshot_());}
    if(b.action==="saveSettings"){requireAdmin_(b.token);return saveSettings_(b);}
    if(b.action==="adminUpdateParticipant"){requireAdmin_(b.token);return adminUpdateParticipant_(b);}
    if(b.action==="adminDeleteParticipant"){requireAdmin_(b.token);return adminDeleteParticipant_(b);}
    if(b.action==="submitQuiz")return submitQuiz_(b);
    if(b.action==="profileLogin")return profileLogin_(b);
    if(b.action==="profileMe")return profileMe_(b);
    if(b.action==="profileLogout")return profileLogout_(b);
    if(b.action==="financeList")return financeList_(b);
    if(b.action==="financeAdd")return financeAdd_(b);
    if(b.action==="financeDelete")return financeDelete_(b);
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
    const name=safeText_(b.name,50),community=safeText_(b.community,50),phone=phone_(b.phone),pin=pin_(b.pin),duration=Math.round(Number(b.duration));
    const questions=getQuestions_(),answers=validateAnswers_(b.answers,questions.length);
    if(!name||!community)throw new Error("Identitas belum lengkap");
    if(!Number.isFinite(duration)||duration<1||duration>7200)throw new Error("Durasi tidak valid");
    const profile=upsertQuizProfile_(name,phone,community,pin),sheet=resultSheet_(),rows=sheet.getDataRange().getValues();
    if(rows.slice(1).some(r=>String(r[1])===config.week&&normaliseStoredPhone_(r[3])===phone))throw new Error("Nomor WhatsApp ini sudah mengikuti kuis minggu ini");
    const correct=answers.reduce((sum,answer,i)=>sum+(answer===questions[i].correct?1:0),0),score=Math.round(correct/questions.length*100);
    const status="VALID";
    sheet.appendRow([new Date(),config.week,name,phone,community,score,duration,JSON.stringify(answers),true,status]);SpreadsheetApp.flush();
    const token=createProfileSession_(profile.id);
    return json_({ok:true,score:score,rank:rank_(config.week,phone),status:status,profileToken:token,profile:{name:profile.name,phone:profile.phone,community:profile.community}});
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

function adminUpdateParticipant_(b){
  const lock=LockService.getScriptLock();
  try{
    lock.waitLock(10000);const name=safeText_(b.name,50),phone=phone_(b.phone),score=Number(b.score),found=findParticipant_(b.participantId);
    if(!name)throw new Error("Nama peserta wajib diisi");
    if(!Number.isInteger(score)||score<0||score>100)throw new Error("Nilai harus 0 sampai 100");
    if(!found||found.status==="DELETED")throw new Error("Peserta tidak ditemukan");
    const rows=resultRows_();if(rows.some((r,i)=>i!==found.index&&String(r[1])===found.week&&normaliseStoredPhone_(r[3])===phone&&String(r[9]).toUpperCase()!=="DELETED"))throw new Error("Nomor WhatsApp sudah digunakan pada periode ini");
    const oldPhone=normaliseStoredPhone_(found.values[3]),profile=findProfileByPhone_(oldPhone),otherProfile=findProfileByPhone_(phone);
    if(profile&&otherProfile&&profile.id!==otherProfile.id)throw new Error("Nomor WhatsApp sudah terhubung ke profil lain");
    resultSheet_().getRange(found.row,3,1,4).setValues([[name,phone,found.values[4],score]]);
    if(profile)profileSheet_().getRange(profile.row,3,1,4).setValues([[new Date(),name,phone,profile.community]]);
    SpreadsheetApp.flush();return json_({ok:true});
  }finally{try{lock.releaseLock();}catch(_){}}
}
function adminDeleteParticipant_(b){
  const lock=LockService.getScriptLock();
  try{lock.waitLock(10000);const found=findParticipant_(b.participantId);if(!found||found.status==="DELETED")throw new Error("Peserta tidak ditemukan");resultSheet_().getRange(found.row,10).setValue("DELETED");SpreadsheetApp.flush();return json_({ok:true});}
  finally{try{lock.releaseLock();}catch(_){}}
}
function findParticipant_(id){const rows=resultRows_();for(let i=0;i<rows.length;i++){const row=rows[i];if(participantId_(row)===String(id||""))return{row:i+2,index:i,values:row,week:String(row[1]),status:String(row[9]).toUpperCase()};}return null;}
function participantId_(row){const time=new Date(row[0]).toISOString();return sha256_(time+"|"+String(row[1])+"|"+normaliseStoredPhone_(row[3])).slice(0,24);}

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
function getLeaderboard_(week,limit,allWeeks){return resultRows_().filter(r=>(allWeeks||String(r[1])===week)&&["VALID","REVIEW"].includes(String(r[9]).toUpperCase())).sort(sortRows_).slice(0,Math.min(Math.max(limit,1),50)).map((r,i)=>({rank:i+1,name:allWeeks?String(r[2]).replace(/^'/,""):mask_(r[2]),community:String(r[4]).replace(/^'/,""),score:Number(r[5])||0,duration:Number(r[6])||0,week:String(r[1])}));}
function allParticipants_(){return resultRows_().filter(r=>String(r[9]).toUpperCase()!=="DELETED").sort((a,b)=>new Date(b[0])-new Date(a[0])).map(r=>({id:participantId_(r),timestamp:new Date(r[0]).toISOString(),week:String(r[1]),name:String(r[2]).replace(/^'/,""),phone:String(r[3]),community:String(r[4]).replace(/^'/,""),score:Number(r[5])||0,duration:Number(r[6])||0,status:String(r[9]||"")}));}
function rank_(week,phone){const i=resultRows_().filter(r=>String(r[1])===week&&["VALID","REVIEW"].includes(String(r[9]).toUpperCase())).sort(sortRows_).findIndex(r=>normaliseStoredPhone_(r[3])===phone);return i<0?null:i+1;}
function sortRows_(a,b){return(Number(b[5])-Number(a[5]))||(Number(a[6])-Number(b[6]))||(new Date(a[0])-new Date(b[0]));}
function resultRows_(){return resultSheet_().getDataRange().getValues().slice(1);}
function book_(){return SpreadsheetApp.openById(SPREADSHEET_ID);}
function resultSheet_(){const file=book_();let sheet=file.getSheetByName(RESULT_SHEET);if(!sheet){sheet=file.insertSheet(RESULT_SHEET);sheet.appendRow(HEADERS);sheet.setFrozenRows(1);}return sheet;}
function configSheet_(){const file=book_();let sheet=file.getSheetByName(CONFIG_SHEET);if(!sheet){sheet=file.insertSheet(CONFIG_SHEET);sheet.getRange(1,1,5,2).setValues([["Key","Value"],...Object.entries(DEFAULT_CONFIG)]);sheet.setFrozenRows(1);}return sheet;}
function questionSheet_(){const file=book_();let sheet=file.getSheetByName(QUESTION_SHEET);if(!sheet){sheet=file.insertSheet(QUESTION_SHEET);sheet.getRange(1,1,1,6).setValues([["Order","Question","AnswerA","AnswerB","AnswerC","CorrectIndex"]]);sheet.getRange(2,1,DEFAULT_QUESTIONS.length,6).setValues(DEFAULT_QUESTIONS.map((q,i)=>[i+1,...q]));sheet.setFrozenRows(1);}return sheet;}
function profileSheet_(){const file=book_();let sheet=file.getSheetByName(PROFILE_SHEET);if(!sheet){sheet=file.insertSheet(PROFILE_SHEET);sheet.appendRow(PROFILE_HEADERS);sheet.setFrozenRows(1);}return sheet;}
function financeSheet_(){const file=book_();let sheet=file.getSheetByName(FINANCE_SHEET);if(!sheet){sheet=file.insertSheet(FINANCE_SHEET);sheet.appendRow(FINANCE_HEADERS);sheet.setFrozenRows(1);}return sheet;}

function upsertQuizProfile_(name,phone,community,pin){
  const sheet=profileSheet_(),rows=sheet.getDataRange().getValues(),found=findProfileByPhone_(phone,rows);
  if(found){verifyProfilePin_(found,pin);sheet.getRange(found.row,3,1,4).setValues([[new Date(),name,phone,community]]);return{id:found.id,name:name,phone:phone,community:community};}
  const salt=Utilities.getUuid(),id=Utilities.getUuid();
  sheet.appendRow([id,new Date(),new Date(),name,phone,community,salt,pinHash_(salt,pin),"ACTIVE"]);
  return{id:id,name:name,phone:phone,community:community};
}
function profileLogin_(b){
  const phone=phone_(b.phone),pin=pin_(b.pin),rateKey="profile-login-"+sha256_(phone),cache=CacheService.getScriptCache(),failures=Number(cache.get(rateKey)||0);
  if(failures>=6)throw new Error("Terlalu banyak percobaan. Tunggu 15 menit");
  const found=findProfileByPhone_(phone);
  if(!found){cache.put(rateKey,String(failures+1),900);throw new Error("Profil belum ditemukan. Ikuti kuis terlebih dahulu");}
  try{verifyProfilePin_(found,pin);}catch(err){cache.put(rateKey,String(failures+1),900);throw err;}
  cache.remove(rateKey);const token=createProfileSession_(found.id);
  return json_({ok:true,profileToken:token,profile:{name:found.name,phone:found.phone,community:found.community}});
}
function profileMe_(b){const profile=requireProfile_(b.profileToken);return json_({ok:true,profile:{name:profile.name,phone:profile.phone,community:profile.community}});}
function profileLogout_(b){CacheService.getScriptCache().remove("profile-session-"+sha256_(String(b.profileToken||"")));return json_({ok:true});}
function createProfileSession_(profileId){const token=Utilities.getUuid()+Utilities.getUuid();CacheService.getScriptCache().put("profile-session-"+sha256_(token),profileId,21600);return token;}
function requireProfile_(token){if(!token)throw new Error("Sesi profil tidak valid");const id=CacheService.getScriptCache().get("profile-session-"+sha256_(String(token)));if(!id)throw new Error("Sesi profil tidak valid");const found=findProfileById_(id);if(!found||found.status!=="ACTIVE")throw new Error("Profil tidak aktif");return found;}
function findProfileByPhone_(phone,rows){return findProfile_(rows||profileSheet_().getDataRange().getValues(),r=>normaliseStoredPhone_(r[4])===phone);}
function findProfileById_(id){return findProfile_(profileSheet_().getDataRange().getValues(),r=>String(r[0])===String(id));}
function findProfile_(rows,test){for(let i=1;i<rows.length;i++)if(test(rows[i]))return profileFromRow_(rows[i],i+1);return null;}
function profileFromRow_(r,row){return{id:String(r[0]),row:row,name:String(r[3]).replace(/^'/,""),phone:normaliseStoredPhone_(r[4]),community:String(r[5]).replace(/^'/,""),salt:String(r[6]),pinHash:String(r[7]),status:String(r[8]||"").toUpperCase()};}
function verifyProfilePin_(profile,pin){if(profile.status!=="ACTIVE"||pinHash_(profile.salt,pin)!==profile.pinHash)throw new Error("Nomor WhatsApp atau PIN salah");}
function pin_(value){const pin=String(value||"");if(!/^\d{6}$/.test(pin))throw new Error("PIN harus terdiri dari 6 angka");return pin;}
function pinHash_(salt,pin){const props=PropertiesService.getScriptProperties();let secret=props.getProperty("PROFILE_PIN_SECRET");if(!secret){secret=Utilities.getUuid()+Utilities.getUuid();props.setProperty("PROFILE_PIN_SECRET",secret);}return sha256_(secret+"|"+salt+"|"+pin);}

function financeList_(b){const profile=requireProfile_(b.profileToken),rows=financeSheet_().getDataRange().getValues().slice(1).filter(r=>String(r[1])===profile.id&&!r[8]).sort((a,c)=>new Date(c[2])-new Date(a[2])).slice(0,1000);return json_({ok:true,records:rows.map(financeRow_)});}
function financeAdd_(b){
  const profile=requireProfile_(b.profileToken),type=String(b.type||""),amount=Math.round(Number(b.amount)),category=safeText_(b.category,40),note=safeText_(b.note,80),date=String(b.date||"");
  if(!["income","expense"].includes(type))throw new Error("Jenis transaksi tidak valid");
  if(!Number.isFinite(amount)||amount<1||amount>1000000000000)throw new Error("Jumlah transaksi tidak valid");
  if(!FINANCE_CATEGORIES.includes(category))throw new Error("Kategori transaksi tidak valid");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(new Date(date+"T00:00:00Z").getTime()))throw new Error("Tanggal transaksi tidak valid");
  const requestId=String(b.requestId||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80),id=requestId?sha256_(profile.id+"|"+requestId).slice(0,32):Utilities.getUuid(),sheet=financeSheet_(),existing=sheet.getDataRange().getValues().slice(1).find(r=>String(r[0])===id&&String(r[1])===profile.id&&!r[8]);
  if(existing)return json_({ok:true,record:financeRow_(existing)});
  const createdAt=new Date();sheet.appendRow([id,profile.id,createdAt,date,type,amount,category,note,""]);SpreadsheetApp.flush();
  return json_({ok:true,record:financeRow_([id,profile.id,createdAt,date,type,amount,category,note,""])});
}
function financeDelete_(b){
  const profile=requireProfile_(b.profileToken),id=String(b.transactionId||""),sheet=financeSheet_(),rows=sheet.getDataRange().getValues();
  for(let i=1;i<rows.length;i++)if(String(rows[i][0])===id&&String(rows[i][1])===profile.id&&!rows[i][8]){sheet.getRange(i+1,9).setValue(new Date());return json_({ok:true});}
  throw new Error("Catatan tidak ditemukan");
}
function financeRow_(r){return{id:String(r[0]),createdAt:new Date(r[2]).toISOString(),date:String(r[3]),type:String(r[4]),amount:Number(r[5])||0,category:String(r[6]).replace(/^'/,""),note:String(r[7]).replace(/^'/,"")};}
function phone_(v){const phone=normaliseStoredPhone_(v);if(phone.length<10||phone.length>15)throw new Error("Nomor WhatsApp tidak valid");return phone;}
function normaliseStoredPhone_(v){let p=String(v||"").replace(/\D/g,"");if(p.startsWith("0"))p="62"+p.slice(1);return p;}
function safeText_(v,max){let s=String(v||"").replace(/[<>\u0000-\u001F]/g,"").trim().slice(0,max||80);if(/^[=+\-@]/.test(s))s="'"+s;return s;}
function mask_(name){const p=String(name||"").replace(/^'/,"").trim().split(/\s+/);return p[0]+(p[1]?" "+p[1][0]+".":"");}
function sha256_(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8).map(b=>(b+256)%256).map(b=>("0"+b.toString(16)).slice(-2)).join("");}
function publicError_(err){const allowed=["Aksi tidak dikenal","Kuis sedang ditutup","Persetujuan penggunaan data wajib diberikan","Periode kuis tidak aktif","Identitas belum lengkap","Durasi tidak valid","Nomor WhatsApp ini sudah mengikuti kuis minggu ini","Nomor WhatsApp tidak valid","Jawaban kuis tidak lengkap","Jawaban kuis tidak valid","Username atau password salah","Terlalu banyak percobaan. Tunggu 10 menit","Sesi admin tidak valid","Periode wajib diisi","Jadwal kuis tidak valid","Jumlah soal harus 1 sampai 30","Isi soal belum lengkap","PIN harus terdiri dari 6 angka","Nomor WhatsApp atau PIN salah","Terlalu banyak percobaan. Tunggu 15 menit","Profil belum ditemukan. Ikuti kuis terlebih dahulu","Sesi profil tidak valid","Profil tidak aktif","Jenis transaksi tidak valid","Jumlah transaksi tidak valid","Kategori transaksi tidak valid","Tanggal transaksi tidak valid","Catatan tidak ditemukan","Nama peserta wajib diisi","Nilai harus 0 sampai 100","Peserta tidak ditemukan","Nomor WhatsApp sudah digunakan pada periode ini","Nomor WhatsApp sudah terhubung ke profil lain"];return allowed.includes(err.message)?err.message:"Layanan sedang bermasalah";}
function json_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
