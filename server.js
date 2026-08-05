const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingTimeout: 20000, pingInterval: 10000 });
const PORT = process.env.PORT || 3000;

const publicPath = path.resolve(__dirname, 'public');

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.use(express.static(publicPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'), err => {
    if (err) {
      console.error('index.html 전송 오류:', err);
      res.status(500).send('게임 화면 파일을 불러오지 못했습니다.');
    }
  });
});

const rooms = new Map();
const MAX_PLAYERS = 10;
const COLORS = ['#ff6b6b','#ff9f43','#feca57','#1dd1a1','#48dbfb','#54a0ff','#5f27cd','#a55eea','#ff6bcb','#10ac84'];
const GAMES = new Set(['ladder','bingo','dodge','race','gomoku']);

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
  players: [...room.players.values()].map(p => ({
    id:p.id, nickname:p.nickname, ready:p.ready, color:p.color, alive:p.alive,
    x:p.x, progress:p.progress, finishedAt:p.finishedAt, survived:p.survived,
    stone:p.stone
  })),
  ladder: room.ladder,
  bingo: room.game === 'bingo' ? {
    started: room.phase === 'playing' || room.phase === 'finished',
    myBoard: room.bingoBoards.get(viewerId) || Array(25).fill(''),
    myMarks: room.bingoMarks.get(viewerId) || Array(25).fill(false),
    myLines: room.bingoLines.get(viewerId) || []
  } : null,
  dodge: room.dodge,
  race: room.race,
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
const createRoom = (socket, nickname, game, topic='') => {
  const code=makeCode();
  const player={id:socket.id,nickname,color:COLORS[0],ready:false,alive:true,x:50,progress:0,finishedAt:null,survived:null,stone:null};
  const room={code,hostId:socket.id,game,phase:'lobby',topic:clean(topic,40),players:new Map([[socket.id,player]]),
    ladder:{names:[],results:[],paths:[],revealed:[]},
    bingoBoards:new Map(),bingoMarks:new Map(),bingoLines:new Map(),
    dodge:{startedAt:null,drops:[],speedLevel:1,countLevel:1,ranking:[]},
    race:{startedAt:null,ranking:[]},
    gomoku:{board:Array.from({length:15},()=>Array(15).fill(null)),turn:'black',winner:null,winLine:null},
    timers:[],timeouts:[]};
  rooms.set(code,room); socket.join(code); socket.data.roomCode=code; return room;
};
const getRoom = socket => rooms.get(socket.data.roomCode);
const isHost = (room,socket) => room?.hostId===socket.id;
const reject = (socket,msg) => socket.emit('toast',{type:'error',message:msg});

io.on('connection', socket => {
  socket.on('room:create', ({nickname,game,topic}, cb=()=>{}) => {
    nickname=clean(nickname); if(!nickname) return cb({ok:false,message:'닉네임을 입력해주세요.'});
    if(!GAMES.has(game)) return cb({ok:false,message:'게임을 선택해주세요.'});
    const room=createRoom(socket,nickname,game,topic); emitRoom(room); cb({ok:true,code:room.code});
  });

  socket.on('room:join', ({nickname,code}, cb=()=>{}) => {
    nickname=clean(nickname); code=clean(code,6).toUpperCase(); const room=rooms.get(code);
    if(!nickname) return cb({ok:false,message:'닉네임을 입력해주세요.'});
    if(!room) return cb({ok:false,message:'존재하지 않는 초대코드입니다.'});
    if(room.phase==='playing') return cb({ok:false,message:'게임이 진행중입니다.'});
    if(room.players.size>=MAX_PLAYERS) return cb({ok:false,message:'방이 가득 찼습니다.'});
    if([...room.players.values()].some(p=>p.nickname===nickname)) return cb({ok:false,message:'같은 닉네임이 이미 있습니다.'});
    const color=COLORS[room.players.size%COLORS.length];
    room.players.set(socket.id,{id:socket.id,nickname,color,ready:false,alive:true,x:10+Math.random()*80,progress:0,finishedAt:null,survived:null,stone:null});
    socket.join(code); socket.data.roomCode=code;
    if(room.game==='bingo'){room.bingoBoards.set(socket.id,Array(25).fill(''));room.bingoMarks.set(socket.id,Array(25).fill(false));room.bingoLines.set(socket.id,[]);}
    assignGomoku(room); emitRoom(room); cb({ok:true,code});
  });

  socket.on('room:leave', () => leaveRoom(socket));
  socket.on('room:chooseGame', ({game,topic}) => {
    const room=getRoom(socket); if(!isHost(room,socket)||!GAMES.has(game)) return;
    clearTimers(room); room.game=game; room.topic=clean(topic,40); room.phase='lobby'; resetPlayerStates(room);
    room.ladder={names:[],results:[],paths:[],revealed:[]};
    room.bingoBoards=new Map();room.bingoMarks=new Map();room.bingoLines=new Map();
    for(const p of room.players.values()){room.bingoBoards.set(p.id,Array(25).fill(''));room.bingoMarks.set(p.id,Array(25).fill(false));room.bingoLines.set(p.id,[]);}
    room.dodge={startedAt:null,drops:[],speedLevel:1,countLevel:1,ranking:[]};room.race={startedAt:null,ranking:[]};
    room.gomoku={board:Array.from({length:15},()=>Array(15).fill(null)),turn:'black',winner:null,winLine:null}; assignGomoku(room); emitRoom(room);
  });
  socket.on('room:selecting', () => { const room=getRoom(socket); if(isHost(room,socket)){room.phase='selecting';emitRoom(room);} });
  socket.on('game:restart', () => { const room=getRoom(socket); if(!isHost(room,socket)) return; restartGame(room); emitRoom(room); });

  socket.on('ladder:setup', ({names,results}) => {
    const room=getRoom(socket); if(!isHost(room,socket)||room.game!=='ladder'||room.phase==='playing') return;
    names=(names||[]).map(x=>clean(x)).filter(Boolean).slice(0,10); results=(results||[]).map(x=>clean(x)).filter(Boolean).slice(0,10);
    if(names.length<2||names.length!==results.length) return reject(socket,'참가자와 결과는 같은 개수로 2개 이상 입력해주세요.');
    const order=[...Array(names.length).keys()]; for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
    room.ladder={names,results,paths:order,revealed:[]}; emitRoom(room);
  });
  socket.on('ladder:reveal', ({index,all}) => { const room=getRoom(socket); if(!room||room.game!=='ladder'||!isHost(room,socket))return; room.phase='playing'; if(all)room.ladder.revealed=room.ladder.names.map((_,i)=>i); else if(Number.isInteger(index)&&!room.ladder.revealed.includes(index))room.ladder.revealed.push(index); emitRoom(room); if(room.ladder.revealed.length===room.ladder.names.length){room.phase='finished';room.timeouts.push(setTimeout(()=>emitRoom(room),1300));} });

  socket.on('bingo:save', board => { const room=getRoom(socket); if(!room||room.game!=='bingo'||room.phase!=='lobby')return; const arr=(board||[]).slice(0,25).map(v=>clean(v,24)); while(arr.length<25)arr.push(''); room.bingoBoards.set(socket.id,arr); emitRoom(room); });
  socket.on('bingo:ready', ready => { const room=getRoom(socket); if(!room||room.game!=='bingo'||room.phase!=='lobby')return; const p=room.players.get(socket.id); const board=room.bingoBoards.get(socket.id)||[]; if(ready&&board.some(v=>!v))return reject(socket,'25칸을 모두 입력해주세요.'); p.ready=!!ready; emitRoom(room); });
  socket.on('bingo:start', () => { const room=getRoom(socket); if(!isHost(room,socket)||room.game!=='bingo')return; if(room.players.size<2||[...room.players.values()].some(p=>!p.ready))return reject(socket,'모든 참가자가 준비완료해야 합니다.'); room.phase='playing';emitRoom(room); });
  socket.on('bingo:mark', idx => { const room=getRoom(socket); if(!room||room.game!=='bingo'||room.phase!=='playing'||!Number.isInteger(idx)||idx<0||idx>24)return; const marks=room.bingoMarks.get(socket.id)||Array(25).fill(false); marks[idx]=!marks[idx]; room.bingoMarks.set(socket.id,marks); room.bingoLines.set(socket.id,calcBingoLines(marks)); emitRoom(room); });

  socket.on('dodge:start', () => startCountdown(socket,'dodge'));
  socket.on('dodge:move', x => { const room=getRoom(socket); const p=room?.players.get(socket.id); if(!room||room.game!=='dodge'||room.phase!=='playing'||!p?.alive)return; p.x=Math.max(3,Math.min(97,Number(x)||50)); socket.to(room.code).emit('player:move',{id:socket.id,x:p.x}); });
  socket.on('dodge:hit', () => { const room=getRoom(socket); const p=room?.players.get(socket.id); if(!room||room.game!=='dodge'||room.phase!=='playing'||!p?.alive)return; p.alive=false;p.survived=Date.now()-room.dodge.startedAt; room.dodge.ranking.unshift({id:p.id,nickname:p.nickname,time:p.survived}); if([...room.players.values()].every(q=>!q.alive)){room.phase='finished';clearTimers(room);} emitRoom(room); });

  socket.on('race:start', () => startCountdown(socket,'race'));
  socket.on('race:tap', () => { const room=getRoom(socket); const p=room?.players.get(socket.id); if(!room||room.game!=='race'||room.phase!=='playing'||p.finishedAt)return; p.progress=Math.min(100,p.progress+1.8); if(p.progress>=100){p.finishedAt=Date.now();room.race.ranking.push({id:p.id,nickname:p.nickname,time:p.finishedAt-room.race.startedAt}); if(room.race.ranking.length===room.players.size)room.phase='finished';} emitRoom(room); });

  socket.on('gomoku:place', ({r,c}) => { const room=getRoom(socket); const p=room?.players.get(socket.id); if(!room||room.game!=='gomoku'||room.phase==='finished'||room.players.size!==2||!p?.stone)return; if(room.phase==='lobby')room.phase='playing'; if(p.stone!==room.gomoku.turn||room.gomoku.board[r]?.[c])return; room.gomoku.board[r][c]=p.stone; const line=findWin(room.gomoku.board,r,c,p.stone); if(line){room.gomoku.winner=p.nickname;room.gomoku.winLine=line;room.phase='finished';} else room.gomoku.turn=p.stone==='black'?'white':'black'; emitRoom(room); });

  socket.on('disconnect', () => leaveRoom(socket));
});

function assignGomoku(room){ if(room.game!=='gomoku')return; let i=0;for(const p of room.players.values())p.stone=i++===0?'black':i===2?'white':null; }
function calcBingoLines(m){const lines=[];for(let r=0;r<5;r++){const a=[0,1,2,3,4].map(c=>r*5+c);if(a.every(i=>m[i]))lines.push(a);}for(let c=0;c<5;c++){const a=[0,1,2,3,4].map(r=>r*5+c);if(a.every(i=>m[i]))lines.push(a);}const d1=[0,6,12,18,24],d2=[4,8,12,16,20];if(d1.every(i=>m[i]))lines.push(d1);if(d2.every(i=>m[i]))lines.push(d2);return lines;}
function startCountdown(socket,game){const room=getRoom(socket);if(!isHost(room,socket)||room.game!==game||room.phase!=='lobby')return;if(game==='dodge'&&room.players.size<1)return;if(game==='race'&&room.players.size<1)return;room.phase='countdown';emitRoom(room);room.timeouts.push(setTimeout(()=>{if(!rooms.has(room.code))return;room.phase='playing';resetPlayerStates(room);const now=Date.now();if(game==='dodge'){room.dodge={startedAt:now,drops:[],speedLevel:1,countLevel:1,ranking:[]};room.timers.push(setInterval(()=>{if(room.phase!=='playing')return;const elapsed=Date.now()-now;room.dodge.speedLevel=1+Math.floor(elapsed/10000);room.dodge.countLevel=1+Math.floor(elapsed/20000);io.to(room.code).emit('dodge:tick',{elapsed,speedLevel:room.dodge.speedLevel,countLevel:room.dodge.countLevel});},500));}else room.race={startedAt:now,ranking:[]};emitRoom(room);},3500));}
function restartGame(room){clearTimers(room);room.phase='lobby';resetPlayerStates(room);if(room.game==='bingo'){for(const p of room.players.values()){room.bingoBoards.set(p.id,Array(25).fill(''));room.bingoMarks.set(p.id,Array(25).fill(false));room.bingoLines.set(p.id,[]);}}if(room.game==='ladder')room.ladder={names:[],results:[],paths:[],revealed:[]};if(room.game==='dodge')room.dodge={startedAt:null,drops:[],speedLevel:1,countLevel:1,ranking:[]};if(room.game==='race')room.race={startedAt:null,ranking:[]};if(room.game==='gomoku'){room.gomoku={board:Array.from({length:15},()=>Array(15).fill(null)),turn:'black',winner:null,winLine:null};assignGomoku(room);}}
function findWin(board,r,c,s){const dirs=[[1,0],[0,1],[1,1],[1,-1]];for(const[dr,dc]of dirs){const line=[[r,c]];for(const sign of[-1,1])for(let k=1;k<5;k++){const rr=r+dr*k*sign,cc=c+dc*k*sign;if(board[rr]?.[cc]===s)line.push([rr,cc]);else break;}if(line.length>=5)return line;}return null;}
function leaveRoom(socket){const code=socket.data.roomCode,room=rooms.get(code);if(!room)return;room.players.delete(socket.id);room.bingoBoards.delete(socket.id);room.bingoMarks.delete(socket.id);room.bingoLines.delete(socket.id);socket.leave(code);socket.data.roomCode=null;if(room.players.size===0){clearTimers(room);rooms.delete(code);return;}if(room.hostId===socket.id)room.hostId=room.players.keys().next().value;assignGomoku(room);emitRoom(room);}
server.listen(PORT,()=>console.log(`Server running on ${PORT}`));
