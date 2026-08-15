const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingTimeout: 20000, pingInterval: 10000 });
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.json({ ok: true }));
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const rooms = new Map();
const MAX_PLAYERS = 10;
const COLORS = ['#ff6b6b','#ff9f43','#feca57','#1dd1a1','#48dbfb','#54a0ff','#5f27cd','#a55eea','#ff6bcb','#10ac84'];
const GAMES = new Set(['ladder','bingo','dodge','race','timing','liar','bomb','memory','typing','waterball','catchmind','gomoku']);

const LIAR_WORDS = {
  '음식':['김치찌개','삼겹살','떡볶이','비빔밥','치킨','피자','라면','김밥','돈까스','냉면','짜장면','카레'],
  '디저트':['아이스크림','케이크','마카롱','붕어빵','도넛','와플','초콜릿','푸딩','빙수','쿠키','크로플','호떡'],
  '장소':['학교','병원','공항','놀이공원','도서관','편의점','카페','영화관','수영장','동물원','지하철역','백화점'],
  '생활':['우산','칫솔','베개','지갑','열쇠','휴지','수건','거울','안경','가방','시계','마스크'],
  '가전':['냉장고','세탁기','전자레인지','에어컨','청소기','선풍기','텔레비전','드라이기','전기밥솥','공기청정기','커피머신','노트북'],
  '직업':['의사','간호사','소방관','경찰관','선생님','요리사','변호사','미용사','운전기사','배우','가수','약사'],
  '인물':['용하영','최충일','박세은','김소은','이소희','윤지선','정하림','최아라','안정화','김민지','오지은','윤진호','최예빈','황가람','박우영','정유정','유설아','이용재','안세진','임채영','이지은','이보영','정연재','현유정','임채원']
};

const TYPING_WORDS = {
  medical: ['CPR', 'ROSC', 'AED', 'BLS', 'ACLS', 'ABGA', 'CBC', 'CRP', 'ESR', 'BUN', 'Creatinine', 'Na', 'K', 'Cl', 'Calcium', 'Magnesium', 'Glucose',
 'Lactate', 'Troponin', 'CK-MB', 'BNP', 'D-dimer', 'PT', 'aPTT', 'INR', 'Fibrinogen', 'Blood culture', 'Urine culture', 'Sputum culture',
 'ECG', 'EKG', 'CXR', 'CT', 'MRI', 'Ultrasound', 'Echo', 'FAST', 'POCUS', 'Angiography', 'Bronchoscopy', 'Endoscopy', 'Colonoscopy',
 'Intubation', 'Extubation', 'Ventilator', 'HFNC', 'NIV', 'BiPAP', 'CPAP', 'Ambu bag', 'Suction', 'Nebulizer', 'Tracheostomy', 'Chest tube',
 'C-line', 'A-line', 'PICC', 'IV', 'IO', 'Foley', 'NG tube', 'PEG', 'Drainage', 'Defibrillation', 'Cardioversion', 'Pacing', 'Compressions',
 'Airway', 'Oxygen', 'SpO2', 'EtCO2', 'PEEP', 'FiO2', 'Tidal volume', 'Respiratory rate', 'Heart rate', 'Blood pressure', 'MAP', 'GCS',
 'Pupil', 'Mental status', 'I&O', 'Urine output', 'NPO', 'DNR', 'Code blue', 'Triage', 'ER', 'ED', 'ICU', 'CCU', 'MICU', 'SICU', 'NICU',
 'PACU', 'OR', 'Shock', 'Sepsis', 'Septic shock', 'Anaphylaxis', 'Syncope', 'Cardiac arrest', 'Respiratory arrest', 'Dyspnea', 'Tachypnea',
 'Bradypnea', 'Hypoxia', 'Cyanosis', 'Hemoptysis', 'Pneumonia', 'Aspiration', 'ARDS', 'COPD', 'Asthma', 'Pneumothorax', 'Hemothorax',
 'Pleural effusion', 'Pulmonary edema', 'Pulmonary embolism', 'DVT', 'ACS', 'STEMI', 'NSTEMI', 'Angina', 'Arrhythmia', 'AF', 'A-flutter',
 'SVT', 'VT', 'VF', 'PVC', 'Bradycardia', 'Tachycardia', 'Heart failure', 'Cardiogenic shock', 'Hypertension', 'Hypotension',
 'Aortic dissection', 'Tamponade', 'Stroke', 'CVA', 'TIA', 'ICH', 'SAH', 'SDH', 'EDH', 'Seizure', 'Status epilepticus', 'Delirium', 'Coma',
 'Headache', 'Dizziness', 'Vertigo', 'Weakness', 'Paralysis', 'Aphasia', 'Dysarthria', 'Meningitis', 'Encephalopathy', 'Trauma',
 'Polytrauma', 'Fracture', 'Dislocation', 'Laceration', 'Abrasion', 'Contusion', 'Burn', 'Hemorrhage', 'Epistaxis', 'GI bleeding',
 'Hematemesis', 'Melena', 'Hematochezia', 'Abdominal pain', 'Appendicitis', 'Pancreatitis', 'Cholecystitis', 'Cholangitis', 'Ileus',
 'Peritonitis', 'Bowel obstruction', 'Perforation', 'Ascites', 'Hepatic encephalopathy', 'AKI', 'CKD', 'ESRD', 'Hematuria', 'Oliguria',
 'Anuria', 'UTI', 'Pyelonephritis', 'DKA', 'HHS', 'Hypoglycemia', 'Hyperglycemia', 'Hyperkalemia', 'Hypokalemia', 'Hyponatremia',
 'Hypernatremia', 'Acidosis', 'Alkalosis', 'Dehydration', 'Fever', 'Hypothermia', 'Infection', 'Cellulitis', 'Abscess', 'COVID-19',
 'Influenza', 'Isolation', 'Contact precaution', 'Droplet precaution', 'Airborne precaution', 'Transfusion', 'PRBC', 'FFP', 'Platelet',
 'Cryoprecipitate', 'Normal saline', 'Dextrose', 'Norepinephrine', 'Epinephrine', 'Dopamine', 'Dobutamine', 'Vasopressin', 'Amiodarone',
 'Adenosine', 'Atropine', 'Nitroglycerin', 'Heparin', 'Aspirin', 'Clopidogrel', 'Furosemide', 'Insulin', 'Midazolam', 'Propofol',
 'Ketamine', 'Fentanyl', 'Morphine', 'Rocuronium', 'Succinylcholine', 'Naloxone', 'Flumazenil', 'Calcium gluconate', 'Sodium bicarbonate',
 'Magnesium sulfate', 'Antibiotics', 'Vancomycin', 'Piperacillin', 'Ceftriaxone', 'Meropenem', 'Metronidazole', 'Acetaminophen',
 'Antipyretic', 'Analgesic', 'Sedation', 'Restraint', 'Pressure sore', 'Fall risk', 'Pain scale', 'NRS', 'RASS', 'CAM-ICU', 'SOFA', 'qSOFA',
 'APACHE', 'NEWS', 'MEWS', 'Central venous pressure', 'ICP', 'CPP', 'ECMO', 'CRRT', 'Hemodialysis', 'Peritoneal dialysis',
 'Hypovolemic shock', 'Obstructive shock', 'Distributive shock', 'Massive transfusion'],
  daily: ['사과', '바나나', '포도', '딸기', '수박', '복숭아', '귤', '레몬', '토마토', '감자', '고구마', '양파', '마늘', '당근', '오이', '상추', '배추', '김치', '라면', '김밥', '치킨', '피자',
 '떡볶이', '햄버거', '샌드위치', '커피', '우유', '주스', '물', '콜라', '학교', '병원', '은행', '마트', '편의점', '카페', '공원', '도서관', '영화관', '지하철', '버스', '택시', '자동차',
 '자전거', '비행기', '기차', '여행', '바다', '산', '강', '하늘', '구름', '비', '눈', '바람', '햇빛', '우산', '모자', '신발', '양말', '바지', '셔츠', '가방', '지갑', '휴대폰', '충전기',
 '이어폰', '컴퓨터', '키보드', '마우스', '모니터', '텔레비전', '냉장고', '세탁기', '청소기', '에어컨', '선풍기', '전자레인지', '밥솥', '침대', '이불', '베개', '소파', '책상', '의자', '거울',
 '시계', '달력', '수건', '비누', '샴푸', '칫솔', '치약', '휴지', '가위', '풀', '연필', '지우개', '볼펜', '노트', '책', '신문', '사진', '카메라', '게임', '음악', '영화', '드라마', '노래',
 '춤', '운동', '축구', '야구', '농구', '배구', '수영', '산책', '등산', '달리기', '요리', '청소', '빨래', '설거지', '출근', '퇴근', '휴가', '주말', '약속', '회의', '공부', '시험', '숙제',
 '친구', '가족', '엄마', '아빠', '언니', '오빠', '동생', '선생님', '의사', '간호사', '경찰', '소방관', '요리사', '가수', '배우', '강아지', '고양이', '토끼', '사자', '호랑이', '코끼리', '기린',
 '원숭이', '펭귄', '돌고래', '물고기', '꽃', '나무', '잔디', '봄', '여름', '가을', '겨울', '아침', '점심', '저녁', '밤', '오늘', '내일', '어제', '시간', '생일', '선물', '케이크', '초콜릿',
 '아이스크림', '쿠키', '도넛', '행복', '사랑', '웃음', '눈물', '기분', '걱정', '기억', '꿈', '전화', '문자', '메시지', '인터넷', '비밀번호', '주소', '이름', '번호', '문', '창문', '계단',
 '엘리베이터', '주차장', '신호등', '횡단보도', '약국', '식당', '미용실', '헬스장', '시장', '공항', '놀이공원', '동물원', '해변', '캠핑', '피크닉'],
  idiom: ['일석이조', '이심전심', '유비무환', '전화위복', '고진감래', '새옹지마', '작심삼일', '동문서답', '금상첨화', '설상가상', '자업자득', '과유불급', '일취월장', '대기만성', '청출어람', '백문불여일견', '십시일반',
 '막상막하', '오리무중', '사면초가', '진퇴양난', '우왕좌왕', '좌충우돌', '속수무책', '천생연분', '일편단심', '동고동락', '형설지공', '주경야독', '일거양득', '일거일득', '일장일단', '일희일비', '이구동성',
 '이열치열', '이왕지사', '삼고초려', '사필귀정', '오매불망', '육하원칙', '칠전팔기', '팔방미인', '구사일생', '십중팔구', '백발백중', '천차만별', '만사형통', '감언이설', '개과천선', '거두절미', '견물생심',
 '결자해지', '경거망동', '고군분투', '고생끝행복시작', '공수래공수거', '과대망상', '관포지교', '괄목상대', '구우일모', '권선징악', '금의환향', '기고만장', '기사회생', '난공불락', '남가일몽', '노심초사',
 '다다익선', '다사다난', '단도직입', '대동소이', '대동단결', '동상이몽', '두문불출', '마이동풍', '명실상부', '무용지물', '문전성시', '박장대소', '반신반의', '방약무인', '백년가약', '백전백승', '부전자전',
 '분골쇄신', '불철주야', '비몽사몽', '산전수전', '살신성인', '상부상조', '선견지명', '설왕설래', '소탐대실', '수수방관', '순망치한', '시기상조', '심사숙고', '아전인수', '안하무인', '어부지리', '역지사지',
 '연목구어', '오합지졸', '와신상담', '용두사미', '우문현답', '유유상종', '의기투합', '일사천리', '일석삼조', '일심동체', '임기응변', '적반하장', '전전긍긍', '조삼모사', '주객전도', '죽마고우', '중구난방',
 '지피지기', '천고마비', '천신만고', '청천벽력', '타산지석', '토사구팽', '파죽지세', '풍전등화', '학수고대', '함흥차사', '허심탄회', '호연지기', '화룡점정', '희로애락', '각골난망', '각양각색', '갑론을박',
 '개선장군', '건곤일척', '견강부회', '고립무원', '공명정대', '구밀복검', '군계일학', '금시초문', '기상천외', '내우외환', '노발대발', '단사표음', '대의명분', '동병상련', '문전옥답', '미사여구', '백척간두',
 '불문곡직', '비일비재', '사상누각', '선공후사', '수구초심', '안분지족', '양두구육', '연전연승', '오월동주', '유종의미', '일망타진', '일벌백계', '임전무퇴', '전광석화', '정정당당', '좌불안석', '천재일우',
 '침소봉대', '탁상공론', '태연자약', '평지풍파', '호가호위', '화기애애']
};

const CATCHMIND_WORDS = {
  medical: ["심폐소생술", "제세동기", "심전도", "산소마스크", "산소포화도", "기관삽관", "인공호흡기", "앰부백", "흡인", "기관절개관", "흉관", "중심정맥관", "동맥관", "수액", "수혈", "혈압계", "체온계", "청진기", "주사기", "링거", "산소통", "인퓨전펌프", "주입펌프", "소변줄", "비위관", "배액관", "응급카트", "스트레처", "휠체어", "목보호대", "부목", "붕대", "거즈", "지혈대", "수술장갑", "마스크", "방호복", "격리실", "응급실", "중환자실", "수술실", "회복실", "구급차", "코드블루", "트리아지", "쇼크", "패혈증", "심정지", "호흡정지", "호흡곤란", "저산소증", "청색증", "폐렴", "천식", "기흉", "혈흉", "폐부종", "폐색전증", "심근경색", "협심증", "부정맥", "심부전", "고혈압", "저혈압", "뇌졸중", "뇌출혈", "경련", "발작", "의식저하", "섬망", "혼수", "두통", "어지럼증", "마비", "골절", "탈구", "열상", "찰과상", "타박상", "화상", "출혈", "코피", "토혈", "혈변", "복통", "맹장염", "췌장염", "장폐색", "복수", "급성신손상", "혈뇨", "핍뇨", "요로감염", "저혈당", "고혈당", "탈수", "발열", "저체온증", "감염", "농양", "혈액배양", "소변배양", "엑스레이", "CT촬영", "초음파", "심장초음파", "혈액검사", "동맥혈가스검사", "투석", "CRRT", "ECMO", "인슐린", "에피네프린", "노르에피네프린", "아트로핀", "아미오다론", "아데노신", "니트로글리세린", "헤파린", "아스피린", "푸로세미드", "프로포폴", "케타민", "펜타닐", "모르핀", "날록손", "항생제", "진통제", "해열제", "진정제"],
  daily: ["사과", "바나나", "포도", "딸기", "수박", "복숭아", "귤", "레몬", "토마토", "감자", "고구마", "양파", "당근", "오이", "김치", "라면", "김밥", "치킨", "피자", "떡볶이", "햄버거", "샌드위치", "커피", "우유", "주스", "콜라", "학교", "병원", "은행", "마트", "편의점", "카페", "공원", "도서관", "영화관", "지하철", "버스", "택시", "자동차", "자전거", "비행기", "기차", "바다", "산", "강", "하늘", "구름", "비", "눈", "바람", "햇빛", "우산", "모자", "신발", "양말", "바지", "셔츠", "가방", "지갑", "휴대폰", "충전기", "이어폰", "컴퓨터", "키보드", "마우스", "모니터", "텔레비전", "냉장고", "세탁기", "청소기", "에어컨", "선풍기", "전자레인지", "밥솥", "침대", "이불", "베개", "소파", "책상", "의자", "거울", "시계", "달력", "수건", "비누", "샴푸", "칫솔", "치약", "휴지", "가위", "연필", "지우개", "볼펜", "노트", "책", "신문", "사진", "카메라", "게임기", "헤드폰", "축구공", "야구공", "농구공", "배구공", "수영장", "등산화", "냄비", "프라이팬", "접시", "숟가락", "젓가락", "포크", "컵", "주전자", "도마", "칼", "냉면", "짜장면", "카레", "케이크", "초콜릿", "아이스크림", "쿠키", "도넛", "강아지", "고양이", "토끼", "사자", "호랑이", "코끼리", "기린", "원숭이", "펭귄", "돌고래", "물고기", "꽃", "나무", "잔디", "해바라기", "장미", "달", "별", "태양", "무지개", "번개", "눈사람", "선물", "풍선", "촛불", "열쇠", "문", "창문", "계단", "엘리베이터", "주차장", "신호등", "횡단보도", "약국", "식당", "미용실", "헬스장", "시장", "공항", "놀이공원", "동물원", "해변", "텐트", "돗자리", "캠핑카", "안경", "선글라스", "목도리", "장갑", "우비", "슬리퍼", "운동화", "구두", "빗", "드라이기", "화장품", "향수", "리모컨", "스피커", "전구", "선풍기", "청소포", "쓰레기통", "빗자루", "걸레", "세제", "옷걸이", "우체통", "택배상자", "편지", "우표", "지도", "나침반", "망원경", "돋보기", "자물쇠", "헬멧", "소화기", "구급상자", "체온계", "밴드", "알약", "주사", "마스크", "비상구", "트로피", "메달", "왕관", "로봇", "공룡", "유령", "마법사", "해적", "우주선", "로켓"]
};

const makeCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from({length: 6}, () => chars[Math.floor(Math.random()*chars.length)]).join(''); }
  while (rooms.has(code));
  return code;
};
const clean = (v, n=20) => String(v ?? '').trim().slice(0,n);
const roomView = (room, viewerId) => ({
  code: room.code,
  hostId: room.hostId,
  game: room.game,
  phase: room.phase,
  topic: room.topic,
  bingoSize: room.bingoSize || 5,
  players: [...room.players.values()].map(p => ({
    id:p.id, nickname:p.nickname, ready:p.ready, color:p.color, alive:p.alive,
    x:p.x, progress:p.progress, finishedAt:p.finishedAt, survived:p.survived,
    stone:p.stone
  })),
  ladder: room.ladder,
  bingo: room.game === 'bingo' ? {
    started: room.phase === 'playing' || room.phase === 'finished',
    size: room.bingoSize || 5,
    myBoard: room.bingoBoards.get(viewerId) || Array((room.bingoSize || 5) ** 2).fill(''),
    myMarks: room.bingoMarks.get(viewerId) || Array((room.bingoSize || 5) ** 2).fill(false),
    myLines: room.bingoLines.get(viewerId) || [],
    target: room.bingoTarget || 1,
    ranking: room.bingoRanking || [],
    claimed: (room.bingoRanking || []).some(x => x.id === viewerId),
    turnOrder: room.bingoTurnOrder || [],
    turnIndex: room.bingoTurnIndex || 0,
    currentTurnId: (room.bingoTurnOrder || [])[room.bingoTurnIndex || 0] || null,
    calledWords: room.bingoCalledWords || []
  } : null,
  dodge: room.dodge,
  race: room.race,
  timing: room.timing,
  liar: room.game === 'liar' ? liarView(room, viewerId) : null,
  bomb: room.bomb,
  memory: room.memory,
  typing: room.typing,
  waterball: room.waterball,
  catchmind: room.game === 'catchmind' ? catchmindView(room, viewerId) : null,
  gomoku: room.gomoku
});
const emitRoom = room => {
  for (const p of room.players.values()) io.to(p.id).emit('room:update', roomView(room, p.id));
};
const resetPlayerStates = room => {
  let i=0;
  for (const p of room.players.values()) {
    p.ready=false; p.alive=true; p.x=10+Math.random()*80; p.progress=0; p.finishedAt=null; p.survived=null;
    p.color = COLORS[i++ % COLORS.length];
  }
};
const clearTimers = room => {
  for (const t of room.timers) clearInterval(t);
  for (const t of room.timeouts) clearTimeout(t);
  room.timers=[]; room.timeouts=[];
};
const normalizeBingoSize = value => [3,4,5].includes(Number(value)) ? Number(value) : 5;
const createRoom = (socket, nickname, game, topic='', bingoSize=5, catchmindRounds=3) => {
  const code=makeCode();
  const player={id:socket.id,nickname,color:COLORS[0],ready:false,alive:true,x:50,progress:0,finishedAt:null,survived:null,stone:null};
  bingoSize=normalizeBingoSize(bingoSize);
  const room={code,hostId:socket.id,game,phase:'lobby',topic:clean(topic,40),bingoSize,players:new Map([[socket.id,player]]),
    ladder:{names:[],results:[],paths:[],traces:[],rungs:[],revealed:[]},
    bingoBoards:new Map(),bingoMarks:new Map(),bingoLines:new Map(),bingoTarget:1,bingoRanking:[],bingoTurnOrder:[],bingoTurnIndex:0,bingoCalledWords:[],
    dodge:{startedAt:null,drops:[],speedLevel:1,countLevel:1,ranking:[]},
    race:{startedAt:null,ranking:[]},
    timing:{startedAt:null,targetMs:null,submissions:[],ranking:[]},
    liar:newLiarState(),
    bomb:newBombState(),
    memory:newMemoryState(),
    typing:newTypingState(),
    waterball:newWaterballState(),
    catchmind:newCatchmindState(catchmindRounds),
    gomoku:{board:Array.from({length:15},()=>Array(15).fill(null)),turn:'black',winner:null,winLine:null},
    timers:[],timeouts:[]};
  rooms.set(code,room); socket.join(code); socket.data.roomCode=code; return room;
};
const getRoom = socket => rooms.get(socket.data.roomCode);
const isHost = (room,socket) => room?.hostId===socket.id;
const reject = (socket,msg) => socket.emit('toast',{type:'error',message:msg});

io.on('connection', socket => {
  socket.on('room:create', ({nickname,game,topic,bingoSize,catchmindRounds}, cb=()=>{}) => {
    nickname=clean(nickname); if(!nickname) return cb({ok:false,message:'닉네임을 입력해주세요.'});
    if(!GAMES.has(game)) return cb({ok:false,message:'게임을 선택해주세요.'});
    const room=createRoom(socket,nickname,game,topic,bingoSize,catchmindRounds); emitRoom(room); cb({ok:true,code:room.code});
  });

  socket.on('room:join', ({nickname,code}, cb=()=>{}) => {
    nickname=clean(nickname); code=clean(code,6).toUpperCase(); const room=rooms.get(code);
    if(!nickname) return cb({ok:false,message:'닉네임을 입력해주세요.'});
    if(!room) return cb({ok:false,message:'존재하지 않는 초대코드입니다.'});
    if(['countdown','playing','voting'].includes(room.phase)) return cb({ok:false,message:'게임이 진행중입니다.'});
    if(room.players.size>=MAX_PLAYERS) return cb({ok:false,message:'방이 가득 찼습니다.'});
    if([...room.players.values()].some(p=>p.nickname===nickname)) return cb({ok:false,message:'같은 닉네임이 이미 있습니다.'});
    const color=COLORS[room.players.size%COLORS.length];
    room.players.set(socket.id,{id:socket.id,nickname,color,ready:false,alive:true,x:10+Math.random()*80,progress:0,finishedAt:null,survived:null,stone:null});
    socket.join(code); socket.data.roomCode=code;
    if(room.game==='bingo'){const cells=(room.bingoSize||5)**2;room.bingoBoards.set(socket.id,Array(cells).fill(''));room.bingoMarks.set(socket.id,Array(cells).fill(false));room.bingoLines.set(socket.id,[]);}
    assignGomoku(room); emitRoom(room); cb({ok:true,code});
  });

  socket.on('room:leave', () => leaveRoom(socket));
  socket.on('room:chooseGame', ({game,topic,bingoSize,catchmindRounds}) => {
    const room=getRoom(socket); if(!isHost(room,socket)||!GAMES.has(game)) return;
    clearTimers(room); room.game=game; room.topic=clean(topic,40); room.bingoSize=game==='bingo'?normalizeBingoSize(bingoSize):5; room.phase='lobby'; resetPlayerStates(room);
    room.ladder={names:[],results:[],paths:[],traces:[],rungs:[],revealed:[]};
    room.bingoBoards=new Map();room.bingoMarks=new Map();room.bingoLines=new Map();room.bingoTarget=1;room.bingoRanking=[];room.bingoTurnOrder=[];room.bingoTurnIndex=0;room.bingoCalledWords=[];
    for(const p of room.players.values()){const cells=(room.bingoSize||5)**2;room.bingoBoards.set(p.id,Array(cells).fill(''));room.bingoMarks.set(p.id,Array(cells).fill(false));room.bingoLines.set(p.id,[]);}
    room.dodge={startedAt:null,drops:[],speedLevel:1,countLevel:1,ranking:[]};room.race={startedAt:null,ranking:[]};room.timing={startedAt:null,targetMs:null,submissions:[],ranking:[]};room.liar=newLiarState();room.bomb=newBombState();room.memory=newMemoryState();room.typing=newTypingState();room.waterball=newWaterballState();room.catchmind=newCatchmindState(catchmindRounds);
    room.gomoku={board:Array.from({length:15},()=>Array(15).fill(null)),turn:'black',winner:null,winLine:null}; assignGomoku(room); emitRoom(room);
  });
  socket.on('room:selecting', () => { const room=getRoom(socket); if(isHost(room,socket)){room.phase='selecting';emitRoom(room);} });
  socket.on('game:restart', () => { const room=getRoom(socket); if(!isHost(room,socket)) return; restartGame(room); emitRoom(room); });

  socket.on('ladder:setup', ({results}) => {
    const room=getRoom(socket); if(!isHost(room,socket)||room.game!=='ladder'||room.phase==='playing') return;
    const names=[...room.players.values()].map(p=>p.nickname);
    results=(results||[]).map(x=>clean(x)).filter(Boolean).slice(0,10);
    if(names.length<2) return reject(socket,'사다리 타기는 참가자가 2명 이상이어야 합니다.');
    if(names.length!==results.length) return reject(socket,`결과를 참가자 수(${names.length}명)와 같게 입력해주세요.`);
    const n=names.length;
    const rungs=[];
    const rows=Math.max(9,Math.min(14,n+7));
    for(let row=0;row<rows;row++){
      const used=new Set();
      const candidates=[...Array(n-1).keys()].sort(()=>Math.random()-.5);
      const count=Math.max(1,Math.min(Math.floor(n/2),1+Math.floor(Math.random()*Math.max(1,Math.floor(n/2)))));
      for(const left of candidates){
        if(used.has(left)||used.has(left+1))continue;
        rungs.push({left,y:35+row*(320/(rows-1))}); used.add(left);used.add(left+1);
        if([...used].length/2>=count)break;
      }
    }
    rungs.sort((a,b)=>a.y-b.y);
    const paths=[],traces=[];
    for(let start=0;start<n;start++){
      let lane=start; const points=[{lane,y:10}];
      for(const rung of rungs){
        if(rung.left===lane||rung.left+1===lane){
          points.push({lane,y:rung.y});
          lane=rung.left===lane?lane+1:lane-1;
          points.push({lane,y:rung.y});
        }
      }
      points.push({lane,y:370}); paths.push(lane); traces.push(points);
    }
    room.ladder={names,results,paths,traces,rungs,revealed:[]}; emitRoom(room);
  });
  socket.on('ladder:reveal', ({index,all}) => { const room=getRoom(socket); if(!room||room.game!=='ladder'||!isHost(room,socket))return; room.phase='playing'; if(all)room.ladder.revealed=room.ladder.names.map((_,i)=>i); else if(Number.isInteger(index)&&!room.ladder.revealed.includes(index))room.ladder.revealed.push(index); emitRoom(room); if(room.ladder.revealed.length===room.ladder.names.length){room.phase='finished';room.timeouts.push(setTimeout(()=>emitRoom(room),3200));} });

  socket.on('bingo:save', board => { const room=getRoom(socket); if(!room||room.game!=='bingo'||room.phase!=='lobby')return; const cells=(room.bingoSize||5)**2; const arr=(board||[]).slice(0,cells).map(v=>clean(v,24)); while(arr.length<cells)arr.push(''); room.bingoBoards.set(socket.id,arr); emitRoom(room); });
  socket.on('bingo:ready', ready => { const room=getRoom(socket); if(!room||room.game!=='bingo'||room.phase!=='lobby')return; const p=room.players.get(socket.id); const board=room.bingoBoards.get(socket.id)||[]; if(ready&&(board.length!==(room.bingoSize||5)**2||board.some(v=>!v)))return reject(socket,`${(room.bingoSize||5)**2}칸을 모두 입력해주세요.`); p.ready=!!ready; emitRoom(room); });
  socket.on('bingo:start', ({target}={}) => {
    const room=getRoom(socket); if(!isHost(room,socket)||room.game!=='bingo')return;
    if(room.players.size<2||[...room.players.values()].some(p=>!p.ready))return reject(socket,'모든 참가자가 준비완료해야 합니다.');
    room.bingoTarget=Math.max(1,Math.min(12,Number(target)||1)); room.bingoRanking=[];
    room.bingoTurnOrder=shuffle([...room.players.keys()]); room.bingoTurnIndex=0; room.bingoCalledWords=[];
    const cells=(room.bingoSize||5)**2;
    for(const p of room.players.values()){room.bingoMarks.set(p.id,Array(cells).fill(false));room.bingoLines.set(p.id,[]);}
    room.phase='playing';emitRoom(room);
  });
  socket.on('bingo:mark', idx => {
    const room=getRoom(socket); const size=room?.bingoSize||5; const cells=size**2;
    if(!room||room.game!=='bingo'||room.phase!=='playing'||!Number.isInteger(idx)||idx<0||idx>=cells)return;
    const currentId=(room.bingoTurnOrder||[])[room.bingoTurnIndex||0];
    if(currentId!==socket.id)return reject(socket,'지금은 다른 참가자의 차례입니다.');
    const myBoard=room.bingoBoards.get(socket.id)||[];
    const word=clean(myBoard[idx],24); if(!word)return reject(socket,'빈 칸은 선택할 수 없습니다.');
    const key=normalizeBingoWord(word);
    if((room.bingoCalledWords||[]).some(x=>x.key===key))return reject(socket,'이미 나온 단어입니다. 다른 단어를 선택해주세요.');
    const caller=room.players.get(socket.id);
    room.bingoCalledWords.push({key,word,callerId:socket.id,callerNickname:caller?.nickname||'',time:Date.now()});
    for(const p of room.players.values()){
      const board=room.bingoBoards.get(p.id)||Array(cells).fill('');
      const marks=room.bingoMarks.get(p.id)||Array(cells).fill(false);
      board.forEach((v,i)=>{if(normalizeBingoWord(v)===key)marks[i]=true;});
      room.bingoMarks.set(p.id,marks); room.bingoLines.set(p.id,calcBingoLines(marks,size));
    }
    if((room.bingoTurnOrder||[]).length)room.bingoTurnIndex=(room.bingoTurnIndex+1)%room.bingoTurnOrder.length;
    emitRoom(room);
  });

  socket.on('bingo:claim', () => {
    const room=getRoom(socket); if(!room||room.game!=='bingo'||room.phase!=='playing')return;
    if(room.bingoRanking.some(x=>x.id===socket.id))return;
    const lines=room.bingoLines.get(socket.id)||[];
    if(lines.length<(room.bingoTarget||1))return reject(socket,`${room.bingoTarget||1}빙고를 먼저 완성해주세요.`);
    const p=room.players.get(socket.id); room.bingoRanking.push({id:p.id,nickname:p.nickname,time:Date.now()});
    if(room.bingoRanking.length===room.players.size)room.phase='finished'; emitRoom(room);
  });
  socket.on('bingo:finish', () => { const room=getRoom(socket); if(!isHost(room,socket)||room.game!=='bingo'||!room.bingoRanking.length)return; room.phase='finished';emitRoom(room); });

  socket.on('dodge:start', () => startCountdown(socket,'dodge'));
  socket.on('dodge:move', x => { const room=getRoom(socket); const p=room?.players.get(socket.id); if(!room||room.game!=='dodge'||room.phase!=='playing'||!p?.alive)return; p.x=Math.max(3,Math.min(97,Number(x)||50)); socket.to(room.code).emit('player:move',{id:socket.id,x:p.x}); });
  socket.on('dodge:hit', () => { const room=getRoom(socket); const p=room?.players.get(socket.id); if(!room||room.game!=='dodge'||room.phase!=='playing'||!p?.alive)return; p.alive=false;p.survived=Date.now()-room.dodge.startedAt; room.dodge.ranking.unshift({id:p.id,nickname:p.nickname,time:p.survived}); if([...room.players.values()].every(q=>!q.alive)){room.phase='finished';clearTimers(room);} emitRoom(room); });

  socket.on('race:start', () => startCountdown(socket,'race'));
  socket.on('race:tap', () => { const room=getRoom(socket); const p=room?.players.get(socket.id); if(!room||room.game!=='race'||room.phase!=='playing'||p.finishedAt)return; p.progress=Math.min(100,p.progress+1.8); if(p.progress>=100){p.finishedAt=Date.now();room.race.ranking.push({id:p.id,nickname:p.nickname,time:p.finishedAt-room.race.startedAt}); if(room.race.ranking.length===room.players.size)room.phase='finished';} emitRoom(room); });

  socket.on('timing:start', () => startCountdown(socket,'timing'));
  socket.on('timing:stop', () => {
    const room=getRoom(socket); const p=room?.players.get(socket.id);
    if(!room||room.game!=='timing'||room.phase!=='playing'||!p||room.timing.submissions.some(x=>x.id===socket.id))return;
    const elapsed=Math.max(0,Date.now()-room.timing.startedAt);
    const diff=Math.abs(elapsed-room.timing.targetMs);
    room.timing.submissions.push({id:p.id,nickname:p.nickname,time:elapsed,diff});
    room.timing.ranking=[...room.timing.submissions].sort((a,b)=>a.diff-b.diff||a.time-b.time);
    if(room.timing.submissions.length>=room.players.size)room.phase='finished';
    emitRoom(room);
  });

  socket.on('liar:start', () => {
    const room=getRoom(socket); if(!isHost(room,socket)||room.game!=='liar'||room.phase!=='lobby')return;
    if(room.players.size<3)return reject(socket,'라이어 게임은 3명 이상 참가해야 합니다.');
    const ids=[...room.players.keys()], liarId=ids[Math.floor(Math.random()*ids.length)];
    const categories=Object.keys(LIAR_WORDS), category=categories[Math.floor(Math.random()*categories.length)];
    const words=LIAR_WORDS[category], word=words[Math.floor(Math.random()*words.length)];
    const order=[...ids].sort(()=>Math.random()-.5);
    room.liar={liarId,category,word,order,round:1,turnIndex:0,messages:[],votes:{},result:null};
    room.phase='playing'; emitRoom(room);
  });
  socket.on('liar:say', text => {
    const room=getRoom(socket); if(!room||room.game!=='liar'||room.phase!=='playing')return;
    const l=room.liar,current=l.order[l.turnIndex]; if(current!==socket.id)return reject(socket,'지금은 다른 참가자의 설명 차례입니다.');
    text=clean(text,100); if(!text)return reject(socket,'설명을 입력해주세요.');
    const p=room.players.get(socket.id); l.messages.push({id:socket.id,nickname:p.nickname,text,round:l.round});
    l.turnIndex++;
    if(l.turnIndex>=l.order.length){l.turnIndex=0;l.round++;if(l.round>3)room.phase='voting';}
    emitRoom(room);
  });
  socket.on('liar:vote', targetId => {
    const room=getRoom(socket); if(!room||room.game!=='liar'||room.phase!=='voting'||!room.players.has(targetId)||room.liar.votes[socket.id])return;
    room.liar.votes[socket.id]=targetId;
    if(Object.keys(room.liar.votes).length>=room.players.size){
      const counts={};Object.values(room.liar.votes).forEach(id=>counts[id]=(counts[id]||0)+1);
      const max=Math.max(...Object.values(counts));const top=Object.keys(counts).filter(id=>counts[id]===max);
      const caught=top.length===1&&top[0]===room.liar.liarId;
      const lp=room.players.get(room.liar.liarId);
      room.liar.result={caught,liarId:room.liar.liarId,liarNickname:lp?.nickname||'라이어',counts};room.phase='finished';
    }
    emitRoom(room);
  });


  socket.on('bomb:start', () => {
    const room=getRoom(socket); if(!isHost(room,socket)||room.game!=='bomb'||room.phase!=='lobby')return;
    if(room.players.size<3)return reject(socket,'폭탄 돌리기는 3명 이상 참가해야 합니다.');
    startBombRound(room);
  });
  socket.on('bomb:pass', () => {
    const room=getRoom(socket); if(!room||room.game!=='bomb'||room.phase!=='playing'||room.bomb.holderId!==socket.id)return;
    const alive=[...room.players.values()].filter(p=>p.alive&&p.id!==socket.id); if(!alive.length)return;
    let next=alive[Math.floor(Math.random()*alive.length)];
    room.bomb.holderId=next.id; room.bomb.passCount++; emitRoom(room);
  });

  socket.on('memory:start', () => {
    const room=getRoom(socket); if(!isHost(room,socket)||room.game!=='memory'||room.phase!=='lobby')return;
    const ids=[...room.players.keys()]; if(!ids.length)return;
    const icons=['🍓','🍋','🍇','🍉','🍒','🥝','🍩','🍪','🍕','🍔','🐶','🐱'];
    const pairCount=Math.min(12,Math.max(6,ids.length+5));
    const cards=shuffle(icons.slice(0,pairCount).flatMap((icon,i)=>[{pair:i,icon},{pair:i,icon}])).map((x,i)=>({...x,id:i,matched:false}));
    room.memory={cards,order:shuffle(ids),turnIndex:0,flipped:[],scores:Object.fromEntries(ids.map(id=>[id,0])),busy:false};
    room.phase='playing';emitRoom(room);
  });
  socket.on('memory:flip', index => {
    const room=getRoom(socket); if(!room||room.game!=='memory'||room.phase!=='playing'||room.memory.busy)return;
    const m=room.memory,current=m.order[m.turnIndex]; if(current!==socket.id)return reject(socket,'지금은 다른 참가자의 차례입니다.');
    index=Number(index);const card=m.cards[index];if(!card||card.matched||m.flipped.includes(index))return;
    m.flipped.push(index);emitRoom(room);if(m.flipped.length<2)return;
    const [a,b]=m.flipped.map(i=>m.cards[i]);m.busy=true;
    if(a.pair===b.pair){
      room.timeouts.push(setTimeout(()=>{a.matched=b.matched=true;m.scores[socket.id]=(m.scores[socket.id]||0)+1;m.flipped=[];m.busy=false;if(m.cards.every(c=>c.matched)){room.phase='finished';}emitRoom(room);},650));
    }else{
      room.timeouts.push(setTimeout(()=>{m.flipped=[];m.turnIndex=(m.turnIndex+1)%m.order.length;m.busy=false;emitRoom(room);},1100));
    }
  });

  socket.on('typing:category', category => {
    const room=getRoom(socket); if(!isHost(room,socket)||room.game!=='typing'||room.phase!=='lobby')return;
    if(!['medical','daily','idiom'].includes(category))return;
    room.typing.category=category; emitRoom(room);
  });
  socket.on('typing:start', () => {
    const room=getRoom(socket); if(!isHost(room,socket)||room.game!=='typing'||room.phase!=='lobby')return;
    startCountdown(socket,'typing');
  });
  socket.on('typing:submit', raw => {
    const room=getRoom(socket); const p=room?.players.get(socket.id);
    if(!room||room.game!=='typing'||room.phase!=='playing'||!p)return;
    const input=normalizeTyping(raw); if(!input)return;
    const now=Date.now();
    room.typing.words=room.typing.words.filter(w=>now<w.bornAt+w.duration);
    const word=room.typing.words.find(w=>normalizeTyping(w.text)===input);
    if(!word)return;
    room.typing.words=room.typing.words.filter(w=>w.id!==word.id);
    const sc=room.typing.scores[socket.id]||(room.typing.scores[socket.id]={count:0,totalMs:0,bestMs:null});
    const responseMs=Math.max(0,now-word.bornAt); sc.count++; sc.totalMs+=responseMs; sc.bestMs=sc.bestMs==null?responseMs:Math.min(sc.bestMs,responseMs);
    room.typing.claims.push({word:word.text,id:p.id,nickname:p.nickname,responseMs,at:now});
    io.to(room.code).emit('typing:claim',{wordId:word.id,word:word.text,id:p.id,nickname:p.nickname,responseMs,scores:room.typing.scores});
    io.to(room.code).emit('typing:sync',{words:room.typing.words,elapsed:now-room.typing.startedAt,scores:room.typing.scores});
  });

  socket.on('catchmind:rounds', rounds => {
    const room=getRoom(socket); if(!isHost(room,socket)||room.game!=='catchmind'||room.phase!=='lobby')return;
    room.catchmind.rounds=normalizeCatchmindRounds(rounds); emitRoom(room);
  });
  socket.on('catchmind:start', () => {
    const room=getRoom(socket); if(!isHost(room,socket)||room.game!=='catchmind'||room.phase!=='lobby')return;
    if(room.players.size<2)return reject(socket,'캐치마인드는 2명 이상 참여해야 합니다.');
    startCatchmindGame(room);
  });
  socket.on('catchmind:choose', index => {
    const room=getRoom(socket); if(!room||room.game!=='catchmind'||room.phase!=='playing')return;
    const c=room.catchmind;if(c.stage!=='choosing'||c.drawerId!==socket.id)return;
    const i=Number(index);if(!Number.isInteger(i)||i<0||i>=c.choices.length)return;
    beginCatchmindDrawing(room,c.choices[i]);
  });
  socket.on('catchmind:draw', seg => {
    const room=getRoom(socket);if(!room||room.game!=='catchmind'||room.phase!=='playing')return;
    const c=room.catchmind;if(c.stage!=='drawing'||c.drawerId!==socket.id)return;
    const x1=Math.max(0,Math.min(1,Number(seg?.x1))),y1=Math.max(0,Math.min(1,Number(seg?.y1))),x2=Math.max(0,Math.min(1,Number(seg?.x2))),y2=Math.max(0,Math.min(1,Number(seg?.y2)));
    if([x1,y1,x2,y2].some(Number.isNaN))return;
    const colors=['#ff3b30','#ff9500','#ffd60a','#34c759','#0a84ff','#5856d6','#af52de','#111111','#ffffff'];
    const color=colors.includes(seg?.color)?seg.color:'#111111';const width=Math.max(2,Math.min(18,Number(seg?.width)||6));
    const safe={x1,y1,x2,y2,color,width};c.strokes.push(safe);if(c.strokes.length>6000)c.strokes.shift();
    socket.to(room.code).emit('catchmind:stroke',safe);
  });
  socket.on('catchmind:clear', () => {
    const room=getRoom(socket);if(!room||room.game!=='catchmind'||room.phase!=='playing')return;const c=room.catchmind;
    if(c.stage!=='drawing'||c.drawerId!==socket.id)return;c.strokes=[];io.to(room.code).emit('catchmind:clear');
  });
  socket.on('catchmind:guess', raw => {
    const room=getRoom(socket);if(!room||room.game!=='catchmind'||room.phase!=='playing')return;const c=room.catchmind,p=room.players.get(socket.id);
    if(!p||c.stage!=='drawing'||c.drawerId===socket.id)return;
    const text=clean(raw,60);if(!text)return;if(c.guesses.some(g=>g.id===socket.id))return;
    const correct=normalizeCatchAnswer(text)===normalizeCatchAnswer(c.word);
    if(correct){const rank=c.guesses.length+1,points=catchmindPoints(rank);c.guesses.push({id:p.id,nickname:p.nickname,rank,points,at:Date.now()});c.scores[p.id]=(c.scores[p.id]||0)+points;c.chat.push({type:'correct',nickname:p.nickname,text:'정답!',at:Date.now()});
      io.to(room.code).emit('catchmind:correct',{id:p.id,nickname:p.nickname,rank,points});
      const guessers=room.players.size-1;if(c.guesses.length>=guessers){room.timeouts.push(setTimeout(()=>finishCatchmindTurn(room),900));}
    }else c.chat.push({type:'guess',nickname:p.nickname,text,at:Date.now()});
    if(c.chat.length>60)c.chat=c.chat.slice(-60);emitRoom(room);
  });

  socket.on('waterball:start', () => {
    const room=getRoom(socket); if(!isHost(room,socket)||room.game!=='waterball'||room.phase!=='lobby')return;
    if(room.players.size<2)return reject(socket,'물풍선 대전은 2명 이상 입장해주세요.');
    startWaterball(room);
  });
  socket.on('waterball:move', dir => {
    const room=getRoom(socket); if(!room||room.game!=='waterball'||room.phase!=='playing')return;
    const wp=room.waterball.players[socket.id]; if(!wp?.alive)return;
    const now=Date.now(),delay=waterMoveDelay(wp,now); if(now-(wp.lastMoveAt||0)<delay)return;
    const d={up:[-1,0],down:[1,0],left:[0,-1],right:[0,1]}[dir]; if(!d)return;
    const nr=wp.r+d[0],nc=wp.c+d[1]; if(!waterCanWalk(room,nr,nc,socket.id))return;
    wp.r=nr;wp.c=nc;wp.lastMoveAt=now; collectWaterItem(room,wp); emitRoom(room);
  });
  socket.on('waterball:bomb', () => {
    const room=getRoom(socket); if(!room||room.game!=='waterball'||room.phase!=='playing')return;
    const wp=room.waterball.players[socket.id]; if(!wp?.alive)return;
    const active=room.waterball.bombs.filter(b=>b.ownerId===socket.id&&!b.exploded).length;
    if(active>=wp.maxBombs)return reject(socket,'설치 가능한 물풍선을 모두 사용 중이에요.');
    if(room.waterball.bombs.some(b=>!b.exploded&&b.r===wp.r&&b.c===wp.c))return;
    const bomb={id:`wb-${room.code}-${++room.waterball.seq}`,ownerId:socket.id,r:wp.r,c:wp.c,range:wp.range,placedAt:Date.now(),explodeAt:Date.now()+2200,exploded:false};
    room.waterball.bombs.push(bomb); emitRoom(room); scheduleWaterExplosion(room,bomb);
  });

  socket.on('gomoku:place', ({r,c}) => { const room=getRoom(socket); const p=room?.players.get(socket.id); if(!room||room.game!=='gomoku'||room.phase==='finished'||room.players.size!==2||!p?.stone)return; if(room.phase==='lobby')room.phase='playing'; if(p.stone!==room.gomoku.turn||room.gomoku.board[r]?.[c])return; room.gomoku.board[r][c]=p.stone; const line=findWin(room.gomoku.board,r,c,p.stone); if(line){room.gomoku.winner=p.nickname;room.gomoku.winLine=line;room.phase='finished';} else room.gomoku.turn=p.stone==='black'?'white':'black'; emitRoom(room); });

  socket.on('disconnect', () => leaveRoom(socket));
});

function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const WATER_ROWS=11,WATER_COLS=13;
const WATER_SPAWNS=[[1,1],[1,11],[9,1],[9,11],[1,6],[9,6],[5,1],[5,11],[3,3],[7,9]];
function newWaterballState(){return {rows:WATER_ROWS,cols:WATER_COLS,tiles:[],players:{},bombs:[],flames:[],items:[],ranking:[],winner:null,startedAt:null,seq:0,mapVariant:0,finalDuel:false};}
function startWaterball(room){
  clearTimers(room); room.phase='countdown'; resetPlayerStates(room); const shuffled=shuffle(WATER_SPAWNS);
  const mapVariant=Math.floor(Math.random()*4);
  const tiles=Array.from({length:WATER_ROWS},()=>Array(WATER_COLS).fill('floor'));
  const safe=new Set(); for(const [r,c] of WATER_SPAWNS){safe.add(`${r},${c}`);safe.add(`${r+1},${c}`);safe.add(`${r-1},${c}`);safe.add(`${r},${c+1}`);safe.add(`${r},${c-1}`)}
  const softChance=[.62,.54,.68,.48][mapVariant];
  for(let r=0;r<WATER_ROWS;r++)for(let c=0;c<WATER_COLS;c++){
    if(r===0||c===0||r===WATER_ROWS-1||c===WATER_COLS-1||(r%2===0&&c%2===0))tiles[r][c]='hard';
    else if(Math.random()<softChance)tiles[r][c]='soft';
  }
  // 매 판 지형의 분위기가 조금씩 달라지도록 추가 고정벽 패턴을 섞는다.
  for(let r=1;r<WATER_ROWS-1;r++)for(let c=1;c<WATER_COLS-1;c++){
    if(tiles[r][c]==='hard'||safe.has(`${r},${c}`))continue;
    let extra=false;
    if(mapVariant===1)extra=(r%4===1&&c%4===0&&Math.random()<.48);
    else if(mapVariant===2)extra=((r+c)%5===0&&Math.random()<.34);
    else if(mapVariant===3)extra=((r*3+c*2)%11===0&&Math.random()<.28);
    if(extra)tiles[r][c]='hard';
  }
  for(const k of safe){const [r,c]=k.split(',').map(Number);if(r>0&&c>0&&r<WATER_ROWS-1&&c<WATER_COLS-1)tiles[r][c]='floor';}
  const players={};let i=0;for(const p of room.players.values()){const [r,c]=shuffled[i++%shuffled.length];p.alive=true;players[p.id]={id:p.id,nickname:p.nickname,color:p.color,r,c,alive:true,maxBombs:1,range:2,speed:1,lastMoveAt:0,diedAt:null,slowUntil:0,hasteUntil:0,invincibleUntil:0};}
  room.waterball={rows:WATER_ROWS,cols:WATER_COLS,tiles,players,bombs:[],flames:[],items:[],ranking:[],winner:null,startedAt:null,seq:0,mapVariant,finalDuel:false}; emitRoom(room);
  room.timeouts.push(setTimeout(()=>{if(!rooms.has(room.code)||room.game!=='waterball')return;room.phase='playing';room.waterball.startedAt=Date.now();maybeStartWaterFinalDuel(room);emitRoom(room);},3500));
}
function waterCanWalk(room,r,c,playerId){const w=room.waterball;if(r<0||c<0||r>=w.rows||c>=w.cols)return false;if(w.tiles[r][c]!=='floor')return false;if(w.bombs.some(b=>!b.exploded&&b.r===r&&b.c===c))return false;return true;}
function waterMoveDelay(wp,now=Date.now()){
  let delay=Math.max(80,170-(wp.speed-1)*22);
  if((wp.slowUntil||0)>now)delay=Math.round(delay*1.65);
  if((wp.hasteUntil||0)>now)delay=Math.max(55,Math.round(delay*.68));
  return delay;
}
function collectWaterItem(room,wp){
  const w=room.waterball,idx=w.items.findIndex(x=>x.r===wp.r&&x.c===wp.c);if(idx<0)return;const it=w.items.splice(idx,1)[0],now=Date.now();
  if(it.type==='range')wp.range=Math.min(8,wp.range+1);
  if(it.type==='bomb')wp.maxBombs=Math.min(8,wp.maxBombs+1);
  if(it.type==='speed')wp.speed=Math.min(5,wp.speed+1);
  if(it.type==='turtle')wp.slowUntil=now+5500;
  if(it.type==='rabbit')wp.hasteUntil=now+5500;
  if(it.type==='rainbow')wp.invincibleUntil=now+4200;
  if(['turtle','rabbit','rainbow'].includes(it.type))room.timeouts.push(setTimeout(()=>{if(rooms.has(room.code)&&room.game==='waterball'&&room.phase==='playing')emitRoom(room);},5600));
}
function maybeStartWaterFinalDuel(room){
  if(room.game!=='waterball'||room.phase!=='playing')return;const w=room.waterball;if(w.finalDuel)return;
  const alive=Object.values(w.players).filter(p=>p.alive);if(alive.length!==2)return;
  w.finalDuel=true;w.finalDuelAt=Date.now();
  for(const p of alive){p.maxBombs=Math.min(10,p.maxBombs+3);p.range=Math.min(10,p.range+(1+Math.floor(Math.random()*2)));}
  io.to(room.code).emit('waterball:final',{players:alive.map(p=>p.nickname)});
  emitRoom(room);
}
function scheduleWaterExplosion(room,bomb){const ms=Math.max(0,bomb.explodeAt-Date.now());room.timeouts.push(setTimeout(()=>explodeWaterBomb(room,bomb.id),ms));}
function explodeWaterBomb(room,bombId){
  if(!rooms.has(room.code)||room.game!=='waterball'||room.phase!=='playing')return;const w=room.waterball,b=w.bombs.find(x=>x.id===bombId);if(!b||b.exploded)return;b.exploded=true;
  const cells=[{r:b.r,c:b.c}],dirs=[[1,0],[-1,0],[0,1],[0,-1]],chains=[];
  for(const [dr,dc] of dirs){for(let n=1;n<=b.range;n++){const r=b.r+dr*n,c=b.c+dc*n;if(r<0||c<0||r>=w.rows||c>=w.cols)break;const tile=w.tiles[r][c];if(tile==='hard')break;cells.push({r,c});const other=w.bombs.find(x=>!x.exploded&&x.r===r&&x.c===c);if(other)chains.push(other.id);if(tile==='soft'){w.tiles[r][c]='floor';if(Math.random()<.46){const types=['range','bomb','speed','turtle','rabbit','rainbow'];w.items.push({id:`wi-${++w.seq}`,r,c,type:types[Math.floor(Math.random()*types.length)]});}break;}}}
  const bornAt=Date.now(),flameIds=cells.map(x=>`wf-${++w.seq}`);cells.forEach((x,i)=>w.flames.push({id:flameIds[i],...x,bornAt,endsAt:bornAt+700}));
  for(const wp of Object.values(w.players)){if(wp.alive&&cells.some(x=>x.r===wp.r&&x.c===wp.c)){if((wp.invincibleUntil||0)>bornAt)continue;wp.alive=false;wp.diedAt=bornAt;const p=room.players.get(wp.id);if(p)p.alive=false;}}
  w.bombs=w.bombs.filter(x=>!x.exploded);emitRoom(room);chains.forEach(id=>room.timeouts.push(setTimeout(()=>explodeWaterBomb(room,id),70)));
  room.timeouts.push(setTimeout(()=>{w.flames=w.flames.filter(f=>!flameIds.includes(f.id));maybeStartWaterFinalDuel(room);finishWaterballIfNeeded(room);if(room.phase==='playing')emitRoom(room);},720));maybeStartWaterFinalDuel(room);finishWaterballIfNeeded(room);
}
function finishWaterballIfNeeded(room){
  if(room.game!=='waterball'||room.phase!=='playing')return;const w=room.waterball,alive=Object.values(w.players).filter(p=>p.alive);if(alive.length>1)return;
  room.phase='finished';const dead=Object.values(w.players).filter(p=>!p.alive).sort((a,b)=>(b.diedAt||0)-(a.diedAt||0));w.winner=alive[0]?.nickname||null;w.ranking=[];if(alive[0])w.ranking.push({id:alive[0].id,nickname:alive[0].nickname,place:1,status:'생존'});dead.forEach((p,i)=>w.ranking.push({id:p.id,nickname:p.nickname,place:(alive.length?2:1)+i,status:'탈락'}));clearTimers(room);emitRoom(room);
}
function newBombState(){return {holderId:null,round:0,passCount:0,eliminated:[],winner:null,explodesAt:null};}
function newMemoryState(){return {cards:[],order:[],turnIndex:0,flipped:[],scores:{},busy:false};}
function normalizeTyping(v){return String(v??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');}
function newTypingState(){return {category:'medical',startedAt:null,endsAt:null,durationMs:60000,words:[],scores:{},claims:[],ranking:[],seq:0,speedLevel:1};}
function normalizeCatchmindRounds(v){return Math.max(3,Math.min(5,Number(v)||3));}
function newCatchmindState(rounds=3){return {rounds:normalizeCatchmindRounds(rounds),stage:'lobby',round:0,turn:0,totalTurns:0,turns:[],drawerId:null,choices:[],word:null,wordLength:0,chooseDeadline:null,drawDeadline:null,hintMask:'',revealed:[],guesses:[],chat:[],scores:{},strokes:[],usedWords:[],turnResult:null,ranking:[]};}
function catchmindView(room,viewerId){const c=room.catchmind||newCatchmindState();const isDrawer=c.drawerId===viewerId;return {...c,choices:(c.stage==='choosing'&&isDrawer)?c.choices:[],word:(isDrawer||c.stage==='between'||c.stage==='finished')?c.word:null,strokes:c.strokes||[]};}
function normalizeCatchAnswer(v){return String(v||'').normalize('NFKC').replace(/\s+/g,'').toLocaleLowerCase('ko-KR');}
function catchmindPoints(rank){return [40,30,15,5,5,3,3,2,2][rank-1]||2;}
function catchWordLength(w){return [...String(w||'').replace(/\s/g,'')].length;}
function makeCatchMask(word,revealed=[]){let pos=0;return [...String(word||'')].map(ch=>{if(/\s/.test(ch))return '  ';const out=revealed.includes(pos)?ch:'＿';pos++;return out}).join(' ');}
function pickCatchChoices(c){const pool=[...CATCHMIND_WORDS.medical,...CATCHMIND_WORDS.daily].filter(w=>!c.usedWords.includes(w));const out=[];while(pool.length&&out.length<3){const i=Math.floor(Math.random()*pool.length);out.push(pool.splice(i,1)[0]);}if(out.length<3){c.usedWords=[];return pickCatchChoices(c);}c.usedWords.push(...out);return out;}
function startCatchmindGame(room){clearTimers(room);room.phase='playing';const c=room.catchmind=newCatchmindState(room.catchmind?.rounds||3);c.scores=Object.fromEntries([...room.players.keys()].map(id=>[id,0]));for(let r=1;r<=c.rounds;r++){const order=shuffle([...room.players.keys()]);for(const id of order)c.turns.push({round:r,drawerId:id});}c.totalTurns=c.turns.length;c.turn=0;startCatchmindTurn(room);}
function startCatchmindTurn(room){const c=room.catchmind;if(c.turn>=c.totalTurns)return finishCatchmindGame(room);const t=c.turns[c.turn],drawer=room.players.get(t.drawerId);if(!drawer){c.turn++;return startCatchmindTurn(room);}c.round=t.round;c.drawerId=t.drawerId;c.stage='choosing';c.choices=pickCatchChoices(c);c.word=null;c.wordLength=0;c.chooseDeadline=Date.now()+10000;c.drawDeadline=null;c.hintMask='';c.revealed=[];c.guesses=[];c.chat=[];c.strokes=[];c.turnResult=null;emitRoom(room);room.timeouts.push(setTimeout(()=>{if(!rooms.has(room.code)||room.game!=='catchmind'||room.catchmind.stage!=='choosing')return;const choice=room.catchmind.choices[Math.floor(Math.random()*room.catchmind.choices.length)];beginCatchmindDrawing(room,choice);},10100));}
function beginCatchmindDrawing(room,word){const c=room.catchmind;if(c.stage!=='choosing')return;c.stage='drawing';c.word=word;c.wordLength=catchWordLength(word);c.chooseDeadline=null;c.drawDeadline=Date.now()+80000;c.revealed=[];c.hintMask=makeCatchMask(word,[]);c.guesses=[];c.chat=[];c.strokes=[];emitRoom(room);
  const revealAt=(delay,count)=>room.timeouts.push(setTimeout(()=>{if(!rooms.has(room.code)||room.game!=='catchmind'||room.catchmind.stage!=='drawing'||room.catchmind.guesses.length)return;revealCatchHint(room,count);},delay));
  revealAt(41000,1);revealAt(54000,2);revealAt(67000,3);room.timeouts.push(setTimeout(()=>finishCatchmindTurn(room),80100));
}
function revealCatchHint(room,count){const c=room.catchmind,n=c.wordLength;if(!n)return;const hidden=[...Array(n).keys()].filter(i=>!c.revealed.includes(i));while(c.revealed.length<count&&hidden.length){const j=Math.floor(Math.random()*hidden.length);c.revealed.push(hidden.splice(j,1)[0]);}c.hintMask=makeCatchMask(c.word,c.revealed);emitRoom(room);}
function finishCatchmindTurn(room){const c=room.catchmind;if(c.stage!=='drawing')return;c.stage='between';c.drawDeadline=null;if(!c.guesses.length){c.scores[c.drawerId]=(c.scores[c.drawerId]||0)+30;}c.turnResult={word:c.word,noCorrect:!c.guesses.length,drawerId:c.drawerId,guesses:[...c.guesses]};emitRoom(room);room.timeouts.push(setTimeout(()=>{if(!rooms.has(room.code)||room.game!=='catchmind')return;room.catchmind.turn++;startCatchmindTurn(room);},3200));}
function finishCatchmindGame(room){const c=room.catchmind;c.stage='finished';room.phase='finished';c.ranking=[...room.players.values()].map(p=>({id:p.id,nickname:p.nickname,score:c.scores[p.id]||0})).sort((a,b)=>b.score-a.score);c.word=null;c.choices=[];c.strokes=[];emitRoom(room);}

function typingCategoryLabel(k){return k==='medical'?'의학용어':k==='daily'?'일상용어':'사자성어';}
function startTypingGame(room){
  const now=Date.now(),durationMs=60000,category=['medical','daily','idiom'].includes(room.typing.category)?room.typing.category:'medical';
  room.typing={category,startedAt:now,endsAt:now+durationMs,durationMs,words:[],scores:Object.fromEntries([...room.players.keys()].map(id=>[id,{count:0,totalMs:0,bestMs:null}])),claims:[],ranking:[],seq:0,speedLevel:1};
  emitRoom(room);
  const loop=()=>{
    if(!rooms.has(room.code)||room.game!=='typing'||room.phase!=='playing')return;
    const t=Date.now(),elapsed=t-room.typing.startedAt;
    if(elapsed>=durationMs){finishTypingGame(room);return;}
    room.typing.words=room.typing.words.filter(w=>t<w.bornAt+w.duration);
    const stage=elapsed<20000?0:elapsed<40000?1:2;
    const target=8+stage*2;
    const duration=Math.max(4300,10500-stage*2200-Math.floor(elapsed/10000)*250);
    const pool=TYPING_WORDS[category];
    const active=new Set(room.typing.words.map(w=>w.text));
    const added=[];
    while(room.typing.words.length<target && added.length<target){
      let text=null;
      for(let tries=0;tries<25;tries++){const cand=pool[Math.floor(Math.random()*pool.length)];if(!active.has(cand)){text=cand;break;}}
      if(!text)break; active.add(text);
      const w={id:`${room.code}-tw-${++room.typing.seq}`,text,x:5+Math.random()*86,bornAt:t+Math.floor(Math.random()*350),duration};
      room.typing.words.push(w);added.push(w);
    }
    room.typing.speedLevel=stage+1;
    io.to(room.code).emit('typing:sync',{words:room.typing.words,elapsed,scores:room.typing.scores,speedLevel:room.typing.speedLevel,endsAt:room.typing.endsAt});
    room.timeouts.push(setTimeout(loop,stage===0?900:stage===1?700:520));
  };
  loop();
}
function finishTypingGame(room){
  if(room.phase!=='playing'||room.game!=='typing')return;
  room.phase='finished'; room.typing.words=[];
  room.typing.ranking=[...room.players.values()].map(p=>{const s=room.typing.scores[p.id]||{count:0,totalMs:0,bestMs:null};return {id:p.id,nickname:p.nickname,count:s.count,avgMs:s.count?Math.round(s.totalMs/s.count):null,bestMs:s.bestMs};}).sort((a,b)=>b.count-a.count||(a.avgMs??1e12)-(b.avgMs??1e12));
  clearTimers(room); emitRoom(room); io.to(room.code).emit('typing:finished',{ranking:room.typing.ranking});
}
function startBombRound(room){const alive=[...room.players.values()].filter(p=>p.alive);if(alive.length<=1){room.bomb.winner=alive[0]?.nickname||null;room.phase='finished';emitRoom(room);return;}room.phase='playing';room.bomb.round++;room.bomb.holderId=alive[Math.floor(Math.random()*alive.length)].id;room.bomb.passCount=0;const ms=5500+Math.floor(Math.random()*6500);room.bomb.explodesAt=Date.now()+ms;emitRoom(room);room.timeouts.push(setTimeout(()=>{if(room.phase!=='playing')return;const p=room.players.get(room.bomb.holderId);if(p&&p.alive){p.alive=false;room.bomb.eliminated.push({id:p.id,nickname:p.nickname,round:room.bomb.round});}room.bomb.holderId=null;emitRoom(room);room.timeouts.push(setTimeout(()=>startBombRound(room),1700));},ms));}
function newLiarState(){return {liarId:null,category:null,word:null,order:[],round:0,turnIndex:0,messages:[],votes:{},result:null};}
function liarView(room,viewerId){
  const l=room.liar||newLiarState(), isLiar=l.liarId===viewerId;
  const reveal=room.phase==='finished'; return {isLiar,category:((!isLiar||reveal)&&l.word)?l.category:null,word:((!isLiar||reveal)&&l.word)?l.word:null,order:l.order,round:l.round,turnIndex:l.turnIndex,messages:l.messages,voted:!!l.votes?.[viewerId],voteCount:Object.keys(l.votes||{}).length,result:l.result};
}
function assignGomoku(room){ if(room.game!=='gomoku')return; let i=0;for(const p of room.players.values())p.stone=i++===0?'black':i===2?'white':null; }
function normalizeBingoWord(v){return String(v??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('ko-KR');}
function calcBingoLines(m,size=5){const lines=[];for(let r=0;r<size;r++){const a=Array.from({length:size},(_,c)=>r*size+c);if(a.every(i=>m[i]))lines.push(a);}for(let c=0;c<size;c++){const a=Array.from({length:size},(_,r)=>r*size+c);if(a.every(i=>m[i]))lines.push(a);}const d1=Array.from({length:size},(_,i)=>i*size+i),d2=Array.from({length:size},(_,i)=>i*size+(size-1-i));if(d1.every(i=>m[i]))lines.push(d1);if(d2.every(i=>m[i]))lines.push(d2);return lines;}
function startCountdown(socket,game){const room=getRoom(socket);if(!isHost(room,socket)||room.game!==game||room.phase!=='lobby')return;if(game==='dodge'&&room.players.size<1)return;if(game==='race'&&room.players.size<1)return;if(game==='timing'&&room.players.size<1)return;if(game==='typing'&&room.players.size<1)return;room.phase='countdown';emitRoom(room);room.timeouts.push(setTimeout(()=>{if(!rooms.has(room.code))return;room.phase='playing';resetPlayerStates(room);const now=Date.now();if(game==='dodge'){room.dodge={startedAt:now,drops:[],speedLevel:2,countLevel:3,ranking:[],dropSeq:0};room.timers.push(setInterval(()=>{if(room.phase!=='playing')return;const elapsed=Date.now()-now;room.dodge.speedLevel=2+Math.floor(elapsed/5000);room.dodge.countLevel=3+Math.floor(elapsed/10000);io.to(room.code).emit('dodge:tick',{elapsed,speedLevel:room.dodge.speedLevel,countLevel:room.dodge.countLevel});},500));spawnDodgeBatch(room);}else if(game==='race') room.race={startedAt:now,ranking:[]};else if(game==='timing') room.timing={startedAt:now,targetMs:(5+Math.floor(Math.random()*6))*1000,submissions:[],ranking:[]};else if(game==='typing'){startTypingGame(room);return;}emitRoom(room);},3500));}

function spawnDodgeBatch(room){
  if(!rooms.has(room.code)||room.game!=='dodge'||room.phase!=='playing')return;
  const now=Date.now(),level=Math.max(3,room.dodge.countLevel||3),speed=Math.max(2,room.dodge.speedLevel||2);
  const duration=Math.max(750,2750-speed*220);
  const batch=Array.from({length:level},()=>({id:`${room.code}-${++room.dodge.dropSeq}`,x:2+Math.random()*94,bornAt:now,duration}));
  room.dodge.drops=(room.dodge.drops||[]).filter(d=>now-d.bornAt<d.duration+350).concat(batch);
  io.to(room.code).emit('dodge:drops',batch);
  const delay=Math.max(170,720-level*65);
  room.timeouts.push(setTimeout(()=>spawnDodgeBatch(room),delay));
}

function restartGame(room){clearTimers(room);room.phase='lobby';resetPlayerStates(room);if(room.game==='bingo'){room.bingoRanking=[];room.bingoTarget=1;room.bingoTurnOrder=[];room.bingoTurnIndex=0;room.bingoCalledWords=[];for(const p of room.players.values()){const cells=(room.bingoSize||5)**2;room.bingoBoards.set(p.id,Array(cells).fill(''));room.bingoMarks.set(p.id,Array(cells).fill(false));room.bingoLines.set(p.id,[]);}}if(room.game==='ladder')room.ladder={names:[],results:[],paths:[],traces:[],rungs:[],revealed:[]};if(room.game==='dodge')room.dodge={startedAt:null,drops:[],speedLevel:1,countLevel:1,ranking:[]};if(room.game==='race')room.race={startedAt:null,ranking:[]};if(room.game==='timing')room.timing={startedAt:null,targetMs:null,submissions:[],ranking:[]};if(room.game==='liar')room.liar=newLiarState();if(room.game==='bomb')room.bomb=newBombState();if(room.game==='memory')room.memory=newMemoryState();if(room.game==='typing')room.typing=newTypingState();if(room.game==='waterball')room.waterball=newWaterballState();if(room.game==='catchmind')room.catchmind=newCatchmindState(room.catchmind?.rounds||3);if(room.game==='gomoku'){room.gomoku={board:Array.from({length:15},()=>Array(15).fill(null)),turn:'black',winner:null,winLine:null};assignGomoku(room);}}
function findWin(board,r,c,s){const dirs=[[1,0],[0,1],[1,1],[1,-1]];for(const[dr,dc]of dirs){const line=[[r,c]];for(const sign of[-1,1])for(let k=1;k<5;k++){const rr=r+dr*k*sign,cc=c+dc*k*sign;if(board[rr]?.[cc]===s)line.push([rr,cc]);else break;}if(line.length>=5)return line;}return null;}
function leaveRoom(socket){const code=socket.data.roomCode,room=rooms.get(code);if(!room)return;room.players.delete(socket.id);room.bingoBoards.delete(socket.id);room.bingoMarks.delete(socket.id);room.bingoLines.delete(socket.id);if(room.bingoTurnOrder?.length){const removed=room.bingoTurnOrder.indexOf(socket.id);room.bingoTurnOrder=room.bingoTurnOrder.filter(id=>id!==socket.id);if(removed>=0&&removed<room.bingoTurnIndex)room.bingoTurnIndex--;if(room.bingoTurnOrder.length)room.bingoTurnIndex=Math.max(0,room.bingoTurnIndex%room.bingoTurnOrder.length);else room.bingoTurnIndex=0;}socket.leave(code);socket.data.roomCode=null;if(room.players.size===0){clearTimers(room);rooms.delete(code);return;}if(room.hostId===socket.id)room.hostId=room.players.keys().next().value;assignGomoku(room);if(room.game==='waterball'&&room.phase==='playing'){const wp=room.waterball?.players?.[socket.id];if(wp){wp.alive=false;wp.diedAt=Date.now();}finishWaterballIfNeeded(room);}if(room.game==='catchmind'&&room.phase==='playing'&&room.catchmind?.drawerId===socket.id){room.catchmind.turn++;startCatchmindTurn(room);return;}emitRoom(room);}
server.listen(PORT,()=>console.log(`Server running on ${PORT}`));
