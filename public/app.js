const socket=io();
const app=document.getElementById('app');
let state={room:null,nickname:'',selected:'ladder',topic:'',bingoSize:5,countdown:null,dodgeX:50,dodgeTimer:0,keys:{},spectateId:null,raceKeyDown:false,timingKeyDown:false,typingComposing:false,typingRaf:0,catchmindRounds:3,catchColor:'#111111',catchTimer:0,catchDrawing:false,catchLast:null};
let bingoDraft=null;
let bingoComposing=false;
const gameMeta={ladder:['🪜','사다리 타기'],bingo:['⭕','빙고'],dodge:['💩','똥피하기'],race:['🏎️','레이싱'],timing:['⏱️','타이밍 게임'],liar:['🕵️','라이어 게임'],bomb:['💣','폭탄 돌리기'],memory:['🃏','카드 뒤집기'],typing:['⌨️','타자게임'],waterball:['💦','물풍선 대전'],catchmind:['🎨','캐치마인드'],gomoku:['⚫','오목']};
const esc=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
const me=()=>state.room?.players.find(p=>p.id===socket.id);
const host=()=>state.room?.hostId===socket.id;
const toast=(message,type='')=>{const d=document.createElement('div');d.className='toast '+type;d.textContent=message;document.getElementById('toast').append(d);setTimeout(()=>d.remove(),2800)};

socket.on('toast',x=>toast(x.message,x.type));
socket.on('waterball:final',x=>toast(`🔥 최종전! ${x.players.join(' vs ')} · 물풍선 +3, 물줄기 강화!`));
socket.on('room:update',room=>{
  state.room=room;
  if(room.phase!=='playing') stopDodgeLocal(true);if(room.game!=='typing'||room.phase!=='playing') stopTypingLocal();
  const active=document.activeElement;
  const editingBingo=room.game==='bingo'&&room.phase==='lobby'&&active?.matches?.('[data-bingo-index]');
  if(editingBingo||bingoComposing){
    if(!bingoDraft) bingoDraft=[...(room.bingo?.myBoard||Array((room.bingo?.size||5)**2).fill(''))];
    return;
  }
  if(room.game!=='bingo'||room.phase!=='lobby') bingoDraft=null;
  render();
});
socket.on('player:move',({id,x})=>{if(!state.room)return;const p=state.room.players.find(q=>q.id===id);if(p){p.x=x;const el=document.querySelector(`[data-player="${id}"]`);if(el)el.style.left=x+'%';}});
socket.on('dodge:tick',x=>{if(state.room?.game==='dodge'){state.room.dodge={...state.room.dodge,...x};updateDodgeHud();}});
socket.on('dodge:drops',drops=>{if(state.room?.game!=='dodge'||state.room.phase!=='playing')return;state.room.dodge.drops=[...(state.room.dodge.drops||[]),...drops].filter(d=>Date.now()-d.bornAt<d.duration+300);drops.forEach(addPoopElement);});
socket.on('typing:sync',data=>{
  if(state.room?.game!=='typing'||state.room.phase!=='playing')return;
  state.room.typing={...(state.room.typing||{}),...data};
  syncTypingWords();syncTypingScores();updateTypingHud();
});
socket.on('typing:claim',data=>{
  if(state.room?.game!=='typing')return;
  if(state.room.typing){state.room.typing.words=(state.room.typing.words||[]).filter(w=>w.id!==data.wordId);state.room.typing.scores=data.scores||state.room.typing.scores;}
  const el=document.querySelector(`[data-typing-word="${data.wordId}"]`);if(el){el.classList.add('claimed');setTimeout(()=>el.remove(),220)}
  if(data.id===socket.id){const input=document.getElementById('typingInput');if(input)input.value='';flashTypingGain(data.word);}
  syncTypingScores();
});
socket.on('typing:finished',data=>{if(state.room?.game==='typing'){state.room.phase='finished';state.room.typing={...(state.room.typing||{}),ranking:data.ranking||[],words:[]};stopTypingLocal();render();}});
socket.on('catchmind:stroke',seg=>{if(state.room?.game==='catchmind'&&state.room.phase==='playing'){state.room.catchmind.strokes=state.room.catchmind.strokes||[];state.room.catchmind.strokes.push(seg);drawCatchSegment(seg);}});
socket.on('catchmind:clear',()=>{if(state.room?.game==='catchmind'){if(state.room.catchmind)state.room.catchmind.strokes=[];clearCatchCanvas();}});
socket.on('catchmind:correct',x=>{if(state.room?.game==='catchmind')toast(`🎯 ${x.nickname} 정답! +${x.points}점`);});
socket.on('connect',()=>render());

window.addEventListener('keydown',e=>{
  if(state.room?.game!=='waterball'||state.room.phase!=='playing')return;
  const tag=document.activeElement?.tagName;if(tag==='INPUT'||tag==='TEXTAREA')return;
  const map={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};
  if(map[e.key]){e.preventDefault();socket.emit('waterball:move',map[e.key]);}
  if(e.code==='Space'){e.preventDefault();if(!e.repeat)socket.emit('waterball:bomb');}
});


function home(){return `<main class="page"><div class="brand"><h1>인계자 정하기</h1><small>경강 미니게임</small></div><div class="home-grid"><section class="card"><h2>같이 놀 준비됐나요? 🎉</h2><div class="field"><label>닉네임</label><input id="nickname" class="input" maxlength="20" placeholder="닉네임을 입력하세요" value="${esc(state.nickname)}"></div><div class="field"><label>초대코드</label><input id="invite" class="input" maxlength="6" placeholder="참가자만 입력" style="text-transform:uppercase"></div><div class="guide"><b>방장</b> = 닉네임 입력 후 게임 선택<br><b>참가자</b> = 닉네임 입력 후 초대코드에 방장이 보낸 초대코드 입력</div><div class="actions"><button class="btn primary" onclick="createRoom()">선택한 게임 방 만들기</button><button class="btn mint" onclick="joinRoom()">초대코드로 참가하기</button></div></section><section class="card"><h2>게임 선택</h2><div class="games">${Object.entries(gameMeta).map(([k,[e,n]])=>`<button class="game-card ${state.selected===k?'selected':''}" onclick="selectGame('${k}')"><span class="emoji">${e}</span><b>${n}</b><span class="sub">${desc(k)}</span>${k==='gomoku'?'<span class="game-badge">2인용</span>':''}</button>`).join('')}</div><div id="topicWrap" class="field ${state.selected==='bingo'?'':'hidden'}"><label>빙고 주제</label><input id="topic" class="input" maxlength="40" placeholder="예: 우리반 추억, 음식, 여행지" value="${esc(state.topic)}"><label>빙고판 크기</label><div class="size-picker">${[5,4,3].map(n=>`<button type="button" class="size-option ${state.bingoSize===n?'selected':''}" onclick="setBingoSize(${n})">${n}×${n}<small>${n*n}칸</small></button>`).join('')}</div></div><div id="catchRoundsWrap" class="field ${state.selected==='catchmind'?'':'hidden'}"><label>진행 라운드</label><div class="size-picker">${[3,4,5].map(n=>`<button type="button" class="size-option ${state.catchmindRounds===n?'selected':''}" onclick="setCatchmindRounds(${n})">${n}라운드<small>전원 ${n}회 출제</small></button>`).join('')}</div><small class="sub">1라운드 = 참가자 전원이 한 번씩 출제</small></div></section></div></main>`}
function desc(k){return {ladder:'운명을 따라 내려가기',bingo:'3×3 · 4×4 · 5×5 선택',dodge:'실시간 생존 게임',race:'스페이스바 연타 대결',timing:'5~10초 랜덤 타이밍 맞추기',liar:'3라운드 설명 후 라이어 찾기',bomb:'폭탄을 넘기고 끝까지 생존',memory:'같은 그림을 찾아 점수 대결',typing:'내려오는 단어를 가장 먼저 입력',waterball:'물풍선·아이템 실시간 대전',catchmind:'그림을 그리고 실시간 정답 맞히기',gomoku:'두 명이 겨루는 오목'}[k]}
function selectGame(k){state.selected=k;state.nickname=document.getElementById('nickname')?.value||state.nickname;state.topic=document.getElementById('topic')?.value||state.topic;render()}
function setBingoSize(n){state.nickname=document.getElementById('nickname')?.value||state.nickname;state.topic=document.getElementById('topic')?.value||state.topic;state.bingoSize=[3,4,5].includes(n)?n:5;render()}
function setCatchmindRounds(n){state.nickname=document.getElementById('nickname')?.value||state.nickname;state.catchmindRounds=[3,4,5].includes(n)?n:3;render()}
function createRoom(){const nickname=document.getElementById('nickname').value.trim();const topic=document.getElementById('topic')?.value.trim()||'';socket.emit('room:create',{nickname,game:state.selected,topic,bingoSize:state.bingoSize,catchmindRounds:state.catchmindRounds},r=>{if(!r.ok)toast(r.message,'error');else state.nickname=nickname})}
function joinRoom(){const nickname=document.getElementById('nickname').value.trim(),code=document.getElementById('invite').value.trim().toUpperCase();socket.emit('room:join',{nickname,code},r=>{if(!r.ok)toast(r.message,'error');else state.nickname=nickname})}
function roomHeader(){const r=state.room;return `<div class="room-top"><div><div class="sub">초대코드</div><div class="code">${r.code}</div></div><div class="players">${r.players.map(p=>`<span class="player-chip ${p.ready?'ready':''} ${p.id===r.hostId?'host':''}">${esc(p.nickname)}${p.ready?' ✓':''}</span>`).join('')}</div><button class="btn danger" onclick="leaveRoom()">방 나가기</button></div>`}
function render(){if(!state.room){app.innerHTML=home();return}const r=state.room;let body='';if(r.phase==='selecting'&&!host())body=`<div class="overlay"><div><div class="count">🎮</div><h2>방장이 게임을 고르는 중입니다.</h2></div></div>`;if(r.phase==='selecting'&&host())body=chooser();else body+=gameView();app.innerHTML=`<main class="page">${roomHeader()}<section class="card game-shell">${body}</section></main>${countdownOverlay()}`;afterRender()}
function chooser(){return `<div class="center"><div class="title">다음 게임을 골라주세요</div><div class="games">${Object.entries(gameMeta).map(([k,[e,n]])=>`<button class="game-card" onclick="chooseNext('${k}')"><span class="emoji">${e}</span><b>${n}</b>${k==='gomoku'?'<span class="game-badge">2인용</span>':''}</button>`).join('')}</div></div>`}
function chooseNext(game){if(game==='bingo')return openBingoSetup();if(game==='catchmind')return openCatchmindSetup();socket.emit('room:chooseGame',{game,topic:'',bingoSize:5})}
function openBingoSetup(){const wrap=document.createElement('div');wrap.className='overlay';wrap.id='bingoSetupOverlay';wrap.innerHTML=`<div class="modal-card"><div class="title">⭕ 빙고 설정</div><div class="field"><label>빙고 주제</label><input id="nextBingoTopic" class="input" maxlength="40" placeholder="예: 음식, 여행지, 우리반 추억"></div><div class="field"><label>빙고판 크기</label><div class="size-picker">${[5,4,3].map(n=>`<button type="button" class="size-option ${n===5?'selected':''}" data-next-size="${n}" onclick="pickNextBingoSize(${n})">${n}×${n}<small>${n*n}칸</small></button>`).join('')}</div></div><div class="actions"><button class="btn primary" onclick="confirmNextBingo()">빙고 선택</button><button class="btn danger" onclick="document.getElementById('bingoSetupOverlay').remove()">취소</button></div></div>`;document.body.append(wrap);wrap.dataset.size='5';setTimeout(()=>document.getElementById('nextBingoTopic')?.focus(),0)}
function pickNextBingoSize(n){const w=document.getElementById('bingoSetupOverlay');if(!w)return;w.dataset.size=String(n);w.querySelectorAll('[data-next-size]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.nextSize)===n))}
function confirmNextBingo(){const w=document.getElementById('bingoSetupOverlay');const topic=document.getElementById('nextBingoTopic')?.value.trim()||'';const bingoSize=Number(w?.dataset.size)||5;w?.remove();socket.emit('room:chooseGame',{game:'bingo',topic,bingoSize})}
function openCatchmindSetup(){const wrap=document.createElement('div');wrap.className='overlay';wrap.id='catchSetupOverlay';wrap.dataset.rounds='3';wrap.innerHTML=`<div class="modal-card"><div class="title">🎨 캐치마인드 설정</div><div class="field"><label>진행 라운드</label><div class="size-picker">${[3,4,5].map(n=>`<button type="button" class="size-option ${n===3?'selected':''}" data-catch-rounds="${n}" onclick="pickNextCatchRounds(${n})">${n}라운드<small>전원 ${n}회 출제</small></button>`).join('')}</div></div><p class="sub">1라운드마다 참가자 모두 한 번씩 그림을 그립니다.</p><div class="actions"><button class="btn primary" onclick="confirmNextCatchmind()">캐치마인드 선택</button><button class="btn danger" onclick="document.getElementById('catchSetupOverlay').remove()">취소</button></div></div>`;document.body.append(wrap)}
function pickNextCatchRounds(n){const w=document.getElementById('catchSetupOverlay');if(!w)return;w.dataset.rounds=String(n);w.querySelectorAll('[data-catch-rounds]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.catchRounds)===n))}
function confirmNextCatchmind(){const w=document.getElementById('catchSetupOverlay');const catchmindRounds=Number(w?.dataset.rounds)||3;w?.remove();socket.emit('room:chooseGame',{game:'catchmind',topic:'',bingoSize:5,catchmindRounds})}
function gameView(){const r=state.room;return {ladder:ladderView,bingo:bingoView,dodge:dodgeView,race:raceView,timing:timingView,liar:liarView,bomb:bombView,memory:memoryView,typing:typingView,waterball:waterballView,catchmind:catchmindView,gomoku:gomokuView}[r.game]()}
function commonEnd(){if(state.room.phase!=='finished')return'';return `<div class="actions" style="justify-content:center"><button class="btn primary" onclick="socket.emit('game:restart')">게임 다시하기</button>${host()?`<button class="btn mint" onclick="socket.emit('room:selecting')">다른 게임 선택하기</button>`:''}<button class="btn danger" onclick="leaveRoom()">방 나가기</button></div>`}
function leaveRoom(){socket.emit('room:leave');state.room=null;render()}
function countdownOverlay(){const p=state.room?.phase;if(p!=='countdown')return'';return `<div class="overlay"><div class="count" id="countText">3</div></div>`}
function afterRender(){if(state.room?.phase==='countdown')runCountdown();if(state.room?.game==='dodge'&&state.room.phase==='playing')startDodgeLocal();if(state.room?.game==='typing'&&state.room.phase==='playing')startTypingLocal();if(state.room?.game==='catchmind'&&state.room.phase==='playing')setupCatchmindAfterRender()}
function runCountdown(){let n=3;const el=document.getElementById('countText');const t=setInterval(()=>{n--;if(!el)return clearInterval(t);el.textContent=n>0?n:'시작!';if(n<0)clearInterval(t)},850)}

function ladderView(){const r=state.room,l=r.ladder;const playerNames=r.players.map(p=>p.nickname);const setup=host()&&r.phase==='lobby'?`<div class="ladder-form"><div class="field"><label>참가자 (${playerNames.length}명 · 방 닉네임 자동 적용)</label><div class="auto-names">${playerNames.map(n=>`<span class="player-chip">${esc(n)}</span>`).join('')}</div></div><div class="field"><label>결과 (한 줄에 하나씩, ${playerNames.length}개)</label><textarea id="ladderResults" class="input" rows="${Math.max(4,Math.min(10,playerNames.length+1))}" placeholder="예: 당첨\n꽝\n커피 사기">${esc(l.results.join('\n'))}</textarea></div></div><button class="btn primary" onclick="setupLadder()">사다리 만들기</button>`:'';let board='';if(l.names.length){board=`<div class="ladder-labels">${l.names.map((n,i)=>`<button class="btn" onclick="revealLadder(${i})">${esc(n)}</button>`).join('')}</div><div class="ladder"><svg viewBox="0 0 1000 390">${ladderSvg(l)}</svg></div><div class="ladder-labels">${l.results.map(x=>`<span class="result-badge">${esc(x)}</span>`).join('')}</div>${host()?`<div class="actions" style="justify-content:center"><button class="btn primary" ${r.phase==='playing'?'disabled':''} onclick="socket.emit('ladder:reveal',{all:true})">${r.phase==='playing'?'사다리 이동 중...':'한번에 결과 확인하기'}</button></div>`:''}${r.phase==='finished'?`<div class="ranking ladder-final-results">${l.revealed.map(i=>`<div class="rank-row"><span>${esc(l.names[i])}</span><span>→ ${esc(l.results[l.paths[i]])}</span></div>`).join('')}</div>`:''}`}return `<div class="center"><div class="title">🪜 사다리 타기</div><p class="sub">이름을 누르면 경로가 애니메이션으로 나타납니다.</p></div>${setup}${board}${commonEnd()}`}
function setupLadder(){const results=document.getElementById('ladderResults').value.split('\n');socket.emit('ladder:setup',{results})}
function revealLadder(index){if(host())socket.emit('ladder:reveal',{index})}
function ladderSvg(l){const n=l.names.length,x=i=>70+i*(860/(n-1));let s='';for(let i=0;i<n;i++)s+=`<line x1="${x(i)}" y1="10" x2="${x(i)}" y2="370" stroke="#8c7aa8" stroke-width="5"/>`;for(const rung of (l.rungs||[]))s+=`<line x1="${x(rung.left)}" y1="${rung.y}" x2="${x(rung.left+1)}" y2="${rung.y}" stroke="#c5b8da" stroke-width="5"/>`;for(const i of l.revealed){const pts=(l.traces?.[i]||[]).map(p=>`${x(p.lane)},${p.y}`).join(' ');s+=`<polyline points="${pts}" fill="none" stroke="${['#ff5d8f','#6c5ce7','#00b894','#ff9f43','#00a8ff'][i%5]}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" pathLength="1000" stroke-dasharray="1000" stroke-dashoffset="1000"><animate attributeName="stroke-dashoffset" from="1000" to="0" dur="2.8s" fill="freeze"/></polyline>`}return s}

function bingoView(){
  const r=state.room,b=r.bingo,m=me(),size=b.size||r.bingoSize||5,cells=size*size;
  if(!bingoDraft||bingoDraft.length!==cells) bingoDraft=[...(b.myBoard||Array(cells).fill(''))];
  const board=b.started?b.myBoard:bingoDraft;
  const canClaim=b.started&&!b.claimed&&b.myLines.length>=b.target;
  const rank=b.ranking||[];
  const order=(b.turnOrder||[]).map(id=>r.players.find(p=>p.id===id)).filter(Boolean);
  const current=r.players.find(p=>p.id===b.currentTurnId);
  const myTurn=b.started&&r.phase==='playing'&&b.currentTurnId===m.id;
  const called=new Set((b.calledWords||[]).map(x=>String(x.word||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('ko-KR')));
  const turnBox=b.started?`<div class="bingo-turn-box"><div class="bingo-turn-now">${r.phase==='playing'?(myTurn?'🎯 내 차례입니다!':`🎯 <b>${esc(current?.nickname||'')}</b>님의 차례`):'게임 종료'}</div><div class="bingo-turn-order">${order.map((p,i)=>`<span class="${p.id===b.currentTurnId?'active':''}">${i+1}. ${esc(p.nickname)}</span>`).join('<i>→</i>')}</div>${b.calledWords?.length?`<div class="bingo-last-call">최근 선택: <b>${esc(b.calledWords[b.calledWords.length-1].word)}</b> · ${esc(b.calledWords[b.calledWords.length-1].callerNickname)}</div>`:''}</div>`:'';
  return `<div class="center"><div class="title">⭕ ${esc(r.topic||'빙고')} <span class="board-size-badge">${size}×${size}</span></div><p class="sub">${b.started?`자기 차례에 단어 하나를 선택하세요. 같은 단어가 다른 사람 판에 있으면 모두 자동 체크됩니다. ${b.target}빙고 달성 후 빙고 버튼을 누르세요.`:`${cells}칸을 입력한 뒤 준비완료를 눌러주세요. Tab 또는 Enter를 누르면 다음 칸으로 이동합니다.`}</p>${turnBox}${b.started?`<div class="bingo-claim-bar"><b>${esc(m.nickname)}</b><button class="btn bingo-claim ${canClaim?'ready-to-claim':''}" ${canClaim?'':'disabled'} onclick="claimBingo()">빙고!</button><span>${b.myLines.length} / ${b.target}줄</span></div>`:''}</div><div class="bingo-grid ${b.started&&!myTurn?'waiting-turn':''}" style="--bingo-size:${size}">${board.map((v,i)=>{if(!b.started)return `<div class="bingo-cell bingo-input-cell"><input data-bingo-index="${i}" value="${esc(v)}" maxlength="24" autocomplete="off" oninput="bingoInput(event,${i})" onfocus="bingoFocus(${i})" onblur="bingoBlur()" onkeydown="bingoKey(event,${i})" oncompositionstart="bingoComposing=true" oncompositionend="bingoCompositionEnd(event,${i})"></div>`;const key=String(v||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('ko-KR');const already=called.has(key);return `<button class="bingo-cell ${b.myMarks[i]?'marked':''} ${b.myLines.some(line=>line.includes(i))?'line':''} ${!myTurn||already||r.phase!=='playing'?'locked':''}" ${myTurn&&!already&&r.phase==='playing'?'': 'disabled'} onclick="markBingo(${i})"><span>${esc(v)}</span></button>`}).join('')}</div><div class="actions" style="justify-content:center">${!b.started?`<button class="btn ${m.ready?'danger':'primary'}" onclick="toggleReady()">${m.ready?'준비 취소':'준비완료'}</button>`:''}${host()&&!b.started?`<label class="target-picker">목표 <select id="bingoTarget">${Array.from({length:Math.min(5,size*2+2)},(_,i)=>i+1).map(n=>`<option value="${n}">${n}빙고</option>`).join('')}</select></label><button class="btn mint" onclick="startBingo()">게임 스타트</button>`:''}${host()&&b.started&&rank.length?`<button class="btn primary" onclick="socket.emit('bingo:finish')">결과 화면 보기</button>`:''}</div>${rank.length?`<div class="ranking"><h3>빙고 선언 순위</h3>${rank.map((x,i)=>`<div class="rank-row"><span>${['🥇','🥈','🥉'][i]||`${i+1}위`} ${esc(x.nickname)}</span><span>${i+1}번째 선언</span></div>`).join('')}</div>`:''}${commonEnd()}`;
}
function bingoFocus(i){
  if(!bingoDraft) bingoDraft=[...(state.room?.bingo?.myBoard||Array((state.room?.bingo?.size||5)**2).fill(''))];
}
function bingoInput(e,i){
  if(!bingoDraft) bingoDraft=[...(state.room?.bingo?.myBoard||Array((state.room?.bingo?.size||5)**2).fill(''))];
  bingoDraft[i]=e.target.value;
}
function bingoCompositionEnd(e,i){
  bingoComposing=false;
  bingoInput(e,i);
}
function saveBingoNow(){
  if(!bingoDraft) bingoDraft=[...(state.room?.bingo?.myBoard||Array((state.room?.bingo?.size||5)**2).fill(''))];
  socket.emit('bingo:save',[...bingoDraft]);
}
function bingoBlur(){
  if(!bingoComposing) saveBingoNow();
}
function bingoKey(e,i){
  if(bingoComposing||e.isComposing||e.keyCode===229) return;
  let next=null;
  if(e.key==='Tab'){
    e.preventDefault();
    const last=(state.room?.bingo?.size||5)**2-1;
    next=e.shiftKey?Math.max(0,i-1):Math.min(last,i+1);
  }else if(e.key==='Enter'){
    e.preventDefault();
    const last=(state.room?.bingo?.size||5)**2-1;
    next=Math.min(last,i+1);
  }
  if(next!==null){
    bingoInput({target:e.currentTarget},i);
    saveBingoNow();
    requestAnimationFrame(()=>{
      const el=document.querySelector(`[data-bingo-index="${next}"]`);
      el?.focus();
      el?.select();
    });
  }
}
function startBingo(){saveBingoNow();setTimeout(()=>socket.emit('bingo:start',{target:Number(document.getElementById('bingoTarget')?.value)||1}),80)}
function claimBingo(){socket.emit('bingo:claim')}
function toggleReady(){saveBingoNow();setTimeout(()=>socket.emit('bingo:ready',!me().ready),100)}
function markBingo(i){const b=state.room?.bingo;if(b?.started&&state.room.phase==='playing'&&b.currentTurnId===me().id)socket.emit('bingo:mark',i)}

function dodgeView(){
  const r=state.room,d=r.dodge,m=me();
  const alive=r.players.filter(p=>p.alive);
  if(r.phase==='playing'&&m&&!m.alive){
    if(!alive.some(p=>p.id===state.spectateId)) state.spectateId=alive[0]?.id||null;
  } else if(m?.alive) state.spectateId=null;
  const spectating=r.phase==='playing'&&m&&!m.alive&&state.spectateId;
  const selected=r.players.find(p=>p.id===state.spectateId);
  const spectatorPanel=(r.phase==='playing'&&m&&!m.alive)?`<div class="spectator-panel"><b>💀 아웃!</b><span>${alive.length?`살아있는 참가자를 눌러 관전하세요.${selected?` · 현재 <strong>${esc(selected.nickname)}</strong> 관전 중`:''}`:'모든 참가자가 아웃되었습니다.'}</span><div class="spectator-buttons">${alive.map(p=>`<button class="btn ${p.id===state.spectateId?'primary':''}" onclick="spectatePlayer('${p.id}')">👀 ${esc(p.nickname)}</button>`).join('')}</div></div>`:'';
  const people=r.players.map(p=>{
    const cls=[p.id!==socket.id?'other':'',!p.alive?'dead':'',spectating&&p.id===state.spectateId?'spectated':'',spectating&&p.alive&&p.id!==state.spectateId?'spectator-dim':''].filter(Boolean).join(' ');
    return `<div class="person ${cls}" data-player="${p.id}" style="left:${p.x}%;--person-color:${p.color}"><span class="person-icon">👤</span><span class="person-name">${esc(p.nickname)}${p.alive?'':' · OUT'}</span><span class="person-hitbox" aria-hidden="true"></span></div>`;
  }).join('');
  const drops=(d?.drops||[]).filter(x=>Date.now()-x.bornAt<x.duration+250).map(p=>poopHtml(p)).join('');
  return `<div class="center"><div class="title">💩 똥피하기</div><p class="sub">방향키 ← → 로 이동하세요. 똥과 몸통이 실제로 겹칠 때만 아웃됩니다.</p></div>${r.phase==='lobby'&&host()?`<div class="actions" style="justify-content:center"><button class="btn primary" onclick="socket.emit('dodge:start')">게임 시작</button></div>`:''}${spectatorPanel}<div class="arena ${spectating?'spectator-mode':''}" id="arena"><div class="hud"><span id="dodgeTime">생존 0.0초</span><span id="dodgeLevel">속도 2단계 · 개수 3단계</span></div>${people}${drops}</div>${r.phase==='finished'?ranking(d.ranking,'time'):''}${commonEnd()}`
}
function spectatePlayer(id){if(state.room?.game!=='dodge'||state.room.phase!=='playing'||me()?.alive)return;const p=state.room.players.find(x=>x.id===id&&x.alive);if(!p)return;state.spectateId=id;render()}
function poopHtml(p){const elapsed=Math.max(0,Date.now()-p.bornAt);return `<div class="poop" data-drop="${p.id}" style="left:${p.x}%;top:-40px;animation-duration:${p.duration}ms;animation-delay:-${Math.min(elapsed,p.duration)}ms"><span class="poop-emoji">💩</span><span class="poop-hitbox" aria-hidden="true"></span></div>`}
function addPoopElement(p){const arena=document.getElementById('arena');if(!arena||document.querySelector(`[data-drop="${p.id}"]`))return;arena.insertAdjacentHTML('beforeend',poopHtml(p));setTimeout(()=>document.querySelector(`[data-drop="${p.id}"]`)?.remove(),Math.max(50,p.duration-(Date.now()-p.bornAt)+350))}
function startDodgeLocal(){if(state.dodgeTimer||!me()?.alive)return;state.dodgeX=me().x;document.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();state.keys[e.key]=true}};document.onkeyup=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key))state.keys[e.key]=false};state.dodgeTimer=requestAnimationFrame(dodgeLoop)}
function stopDodgeLocal(removePoops=false){if(state.dodgeTimer)cancelAnimationFrame(state.dodgeTimer);state.dodgeTimer=0;state.keys={};document.onkeydown=null;document.onkeyup=null;if(removePoops)document.querySelectorAll('.poop').forEach(x=>x.remove())}
function dodgeLoop(){if(state.room?.phase!=='playing'||!me()?.alive){stopDodgeLocal(false);return}if(state.keys.ArrowLeft)state.dodgeX-=.75;if(state.keys.ArrowRight)state.dodgeX+=.75;state.dodgeX=Math.max(3,Math.min(97,state.dodgeX));const el=document.querySelector(`[data-player="${socket.id}"]`);if(el)el.style.left=state.dodgeX+'%';socket.emit('dodge:move',state.dodgeX);checkPoopCollision();updateDodgeHud();state.dodgeTimer=requestAnimationFrame(dodgeLoop)}
function checkPoopCollision(){const hit=document.querySelector(`[data-player="${socket.id}"] .person-hitbox`);if(!hit)return;const a=hit.getBoundingClientRect();for(const p of document.querySelectorAll('.poop-hitbox')){const b=p.getBoundingClientRect();const overlapX=Math.min(a.right,b.right)-Math.max(a.left,b.left);const overlapY=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);if(overlapX>=7&&overlapY>=7){stopDodgeLocal(false);socket.emit('dodge:hit');break}}}
function updateDodgeHud(){const d=state.room?.dodge;if(!d)return;const t=document.getElementById('dodgeTime'),l=document.getElementById('dodgeLevel');if(t&&d.startedAt)t.textContent=(me()?.alive?'생존 ':'관전 ')+((Date.now()-d.startedAt)/1000).toFixed(1)+'초';if(l)l.textContent=`속도 ${d.speedLevel||1}단계 · 개수 ${d.countLevel||1}단계`}

function raceView(){const r=state.room;return `<div class="center"><div class="title">🏎️ 레이싱</div><p class="sub">스페이스바를 눌렀다 떼며 연타하세요. 꾹 누르기는 인정되지 않습니다.</p></div>${r.phase==='lobby'&&host()?`<div class="actions" style="justify-content:center"><button class="btn primary" onclick="socket.emit('race:start')">레이싱 시작</button></div>`:''}<div class="race-track">${r.players.map(p=>`<div class="lane"><div class="car" style="left:calc(${Math.min(88,p.progress*.88)}%);background:${p.color}">🚗 ${esc(p.nickname)}</div><div class="finish">🏁</div>${p.finishedAt?'<span class="arrived">도착!</span>':''}</div>`).join('')}</div>${r.phase==='finished'?ranking(r.race.ranking,'time'):''}${commonEnd()}`}
window.addEventListener('keydown',e=>{if(e.code!=='Space')return;if(state.room?.game==='race'&&state.room.phase==='playing'){e.preventDefault();if(!e.repeat&&!state.raceKeyDown){state.raceKeyDown=true;socket.emit('race:tap')}}else if(state.room?.game==='timing'&&state.room.phase==='playing'){e.preventDefault();if(!e.repeat&&!state.timingKeyDown){state.timingKeyDown=true;stopTiming()}}});window.addEventListener('keyup',e=>{if(e.code==='Space'){state.raceKeyDown=false;state.timingKeyDown=false}});
function ranking(rows,type){return `<div class="ranking">${rows.map((x,i)=>`<div class="rank-row"><span>${['🥇','🥈','🥉'][i]||`${i+1}위`} ${esc(x.nickname)}</span><span>${type==='time'?(x.time/1000).toFixed(2)+'초':''}</span></div>`).join('')}</div>`}

function timingView(){
  const r=state.room,t=r.timing||{targetMs:null,submissions:[],ranking:[]};
  const mine=t.submissions?.find(x=>x.id===socket.id),waiting=(t.submissions||[]).length;
  const target=t.targetMs?`${(t.targetMs/1000).toFixed(3)}초`:'? 초';
  const playButton=r.phase==='playing'?`<button class="timing-stop ${mine?'done':''}" ${mine?'disabled':''} onclick="stopTiming()">${mine?'기록 완료!':'지금이다!'}</button>`:'';
  const lobby=r.phase==='lobby'&&host()?`<div class="actions" style="justify-content:center"><button class="btn primary" onclick="socket.emit('timing:start')">타이밍 게임 시작</button></div>`:'';
  const message=r.phase==='playing'?(mine?`내 기록 <b>${(mine.time/1000).toFixed(3)}초</b> · 다른 참가자를 기다리는 중`:`목표 <b>${target}</b>를 마음속으로 센 뒤 버튼 또는 스페이스바를 누르세요!`):'매 게임 5~10초 사이의 목표 시간이 랜덤으로 정해집니다.';
  const progress=r.phase==='playing'?`<div class="timing-progress">기록 완료 ${waiting} / ${r.players.length}명</div>`:'';
  const results=r.phase==='finished'?`<div class="ranking"><h3>⏱️ ${target}에 가까운 순위</h3>${(t.ranking||[]).map((x,i)=>`<div class="rank-row"><span>${['🥇','🥈','🥉'][i]||`${i+1}위`} ${esc(x.nickname)}</span><span>${(x.time/1000).toFixed(3)}초 · 차이 ${(x.diff/1000).toFixed(3)}초</span></div>`).join('')}</div>`:'';
  return `<div class="center"><div class="title">⏱️ 타이밍 게임</div><p class="sub">이번 목표는 게임 시작과 동시에 공개됩니다.</p></div>${lobby}<div class="timing-stage"><div class="timing-target">${target}</div><p>${message}</p>${playButton}${progress}</div>${results}${commonEnd()}`;
}
function stopTiming(){if(state.room?.game==='timing'&&state.room.phase==='playing')socket.emit('timing:stop')}

function liarView(){
  const r=state.room,l=r.liar||{},m=me();
  if(r.phase==='lobby')return `<div class="center"><div class="title">🕵️ 라이어 게임</div><p class="sub">한 명만 제시어를 모릅니다. 3라운드 동안 차례대로 설명한 뒤 라이어를 찾아보세요.</p><div class="liar-rules">3명 이상 · 라이어 1명 랜덤 · 설명 3라운드 · 전원 투표</div></div>${host()?`<div class="actions" style="justify-content:center"><button class="btn primary" onclick="socket.emit('liar:start')">라이어 게임 시작</button></div>`:'<p class="center sub">방장이 게임을 시작할 때까지 기다려 주세요.</p>'}`;
  const identity=l.isLiar?`<div class="liar-secret liar"><span>🤫</span><b>당신은 라이어 입니다.</b><small>다른 사람의 설명을 듣고 제시어를 유추하세요.</small></div>`:`<div class="liar-secret word"><span>🔐 제시어</span><b>${esc(l.word||'')}</b><small>${l.category?`카테고리 · ${esc(l.category)}`:''}</small></div>`;
  if(r.phase==='playing'){
    const currentId=l.order?.[l.turnIndex],current=r.players.find(p=>p.id===currentId),myTurn=currentId===socket.id;
    return `<div class="center"><div class="title">🕵️ 라이어 게임 · ${Math.min(3,l.round||1)}라운드</div></div>${identity}<div class="liar-turn"><b>${current?`[${esc(current.nickname)}]부터 단어에 대한 설명을 해주세요.`:'설명 차례를 준비 중입니다.'}</b><div class="turn-order">${(l.order||[]).map(id=>{const p=r.players.find(x=>x.id===id);return p?`<span class="${id===currentId?'active':''}">${esc(p.nickname)}</span>`:''}).join('<i>→</i>')}</div></div><div class="liar-chat"><div class="chat-log">${(l.messages||[]).map(x=>`<div class="chat-msg"><span>${esc(x.nickname)} · ${x.round}R</span><b>${esc(x.text)}</b></div>`).join('')||'<p class="sub">아직 설명이 없습니다.</p>'}</div><div class="chat-input"><input id="liarText" class="input" maxlength="100" placeholder="${myTurn?'제시어를 직접 말하지 말고 설명하세요':'내 차례가 되면 입력할 수 있어요'}" ${myTurn?'':'disabled'} onkeydown="if(event.key==='Enter')sendLiarText()"><button class="btn primary" onclick="sendLiarText()" ${myTurn?'':'disabled'}>설명 보내기</button></div></div>`;
  }
  if(r.phase==='voting'){
    return `<div class="center"><div class="title">🗳️ 누가 라이어?</div><p class="sub">한 명을 선택해 투표하세요. 투표 후에는 변경할 수 없습니다.</p></div>${identity}<div class="vote-grid">${r.players.filter(p=>p.id!==socket.id).map(p=>`<button class="vote-card" ${l.voted?'disabled':''} onclick="voteLiar('${p.id}')"><span>👤</span><b>${esc(p.nickname)}</b></button>`).join('')}</div><div class="center sub">투표 완료 ${l.voteCount||0} / ${r.players.length}명 ${l.voted?'· 내 투표 완료 ✓':''}</div>`;
  }
  const result=l.result||{};const counts=result.counts||{};
  return `<div class="center"><div class="title">${result.caught?'🎯 라이어를 찾았습니다!':'😈 라이어 승!'}</div><div class="liar-result"><div class="liar-reveal"><span>${esc(result.liarNickname||'')}</span><b>라이어!</b></div><p>제시어는 <strong>${esc(l.word||'결과 공개')}</strong>${l.category?` · ${esc(l.category)}`:''}</p></div></div><div class="ranking">${r.players.slice().sort((a,b)=>(counts[b.id]||0)-(counts[a.id]||0)).map(p=>`<div class="rank-row"><span>${esc(p.nickname)}${p.id===result.liarId?' 😈':''}</span><span>${counts[p.id]||0}표</span></div>`).join('')}</div>${commonEnd()}`;
}
function sendLiarText(){const el=document.getElementById('liarText');const text=el?.value.trim();if(text)socket.emit('liar:say',text)}
function voteLiar(id){socket.emit('liar:vote',id)}


function bombView(){
  const r=state.room,b=r.bomb||{},alive=r.players.filter(p=>p.alive),holder=r.players.find(p=>p.id===b.holderId),mine=b.holderId===socket.id;
  if(r.phase==='lobby')return `<div class="center"><div class="title">💣 폭탄 돌리기</div><p class="sub">3명 이상 · 폭발 시간은 비공개 랜덤 · 마지막 생존자가 우승!</p></div>${host()?'<div class="actions" style="justify-content:center"><button class="btn primary" onclick="socket.emit(\'bomb:start\')">폭탄 게임 시작</button></div>':'<p class="center sub">방장이 시작할 때까지 기다려 주세요.</p>'}`;
  if(r.phase==='finished')return `<div class="center"><div class="title">🏆 ${esc(b.winner||'')} 우승!</div><p class="sub">마지막까지 폭탄을 피했습니다.</p></div><div class="ranking">${(b.eliminated||[]).slice().reverse().map((x,i)=>`<div class="rank-row"><span>${i+2}위 ${esc(x.nickname)}</span><span>${x.round}라운드 탈락</span></div>`).join('')}</div>${commonEnd()}`;
  return `<div class="center"><div class="title">💣 폭탄 돌리기 · ${b.round||1}라운드</div><p class="sub">폭탄이 언제 터질지는 아무도 모릅니다!</p></div><div class="bomb-stage"><div class="bomb-big ${mine?'mine':''}">💣</div><h2>${holder?`${esc(holder.nickname)}에게 폭탄이 있습니다!`:'다음 라운드 준비 중...'}</h2>${mine?'<button class="btn danger bomb-pass" onclick="socket.emit(\'bomb:pass\')">💨 폭탄 넘기기!</button>':'<p class="sub">폭탄이 넘어오지 않기를 기다리세요...</p>'}</div><div class="bomb-players">${r.players.map(p=>`<div class="bomb-player ${p.id===b.holderId?'holder':''} ${!p.alive?'out':''}"><span>${p.alive?(p.id===b.holderId?'💣':'🙂'):'💥'}</span><b>${esc(p.nickname)}</b><small>${p.alive?'생존':'탈락'}</small></div>`).join('')}</div>`;
}

function memoryView(){
  const r=state.room,m=r.memory||{},currentId=m.order?.[m.turnIndex],current=r.players.find(p=>p.id===currentId),myTurn=currentId===socket.id;
  if(r.phase==='lobby')return `<div class="center"><div class="title">🃏 카드 뒤집기</div><p class="sub">차례대로 카드 두 장을 뒤집어 같은 그림을 찾으세요. 맞추면 한 번 더!</p></div>${host()?'<div class="actions" style="justify-content:center"><button class="btn primary" onclick="socket.emit(\'memory:start\')">카드 게임 시작</button></div>':'<p class="center sub">방장이 시작할 때까지 기다려 주세요.</p>'}`;
  const scoreRows=r.players.slice().sort((a,b)=>(m.scores?.[b.id]||0)-(m.scores?.[a.id]||0));
  if(r.phase==='finished')return `<div class="center"><div class="title">🃏 카드 뒤집기 결과</div></div><div class="ranking">${scoreRows.map((p,i)=>`<div class="rank-row"><span>${['🥇','🥈','🥉'][i]||`${i+1}위`} ${esc(p.nickname)}</span><span>${m.scores?.[p.id]||0}쌍</span></div>`).join('')}</div>${commonEnd()}`;
  return `<div class="center"><div class="title">🃏 카드 뒤집기</div><p class="sub">${current?`현재 차례: <b>${esc(current.nickname)}</b>${myTurn?' · 내 차례!':''}`:'차례 준비 중'}</p></div><div class="memory-scores">${scoreRows.map(p=>`<span class="player-chip ${p.id===currentId?'ready':''}">${esc(p.nickname)} · ${m.scores?.[p.id]||0}쌍</span>`).join('')}</div><div class="memory-board">${(m.cards||[]).map((c,i)=>{const open=c.matched||m.flipped?.includes(i);return `<button class="memory-card ${open?'open':''} ${c.matched?'matched':''}" ${(!myTurn||m.busy||c.matched||m.flipped?.includes(i))?'disabled':''} onclick="socket.emit('memory:flip',${i})"><span>${open?c.icon:'?'}</span></button>`}).join('')}</div>`;
}


function typingCategoryLabel(k){return k==='medical'?'의학용어':k==='daily'?'일상용어':'사자성어'}
function typingView(){
  const r=state.room,t=r.typing||{},cat=t.category||'medical';
  if(r.phase==='lobby')return `<div class="center"><div class="title">⌨️ 타자게임</div><p class="sub">같은 화면에서 내려오는 단어를 누구보다 빨리 입력해서 획득하세요!</p></div><div class="typing-category"><h3>게임 종류</h3><div class="typing-category-buttons">${[['medical','의학용어','응급실·중환자실 용어'],['daily','일상용어','익숙한 생활 단어'],['idiom','사자성어','네 글자 집중 대결']].map(([k,n,d])=>`<button class="typing-cat ${cat===k?'selected':''}" ${host()?'':'disabled'} onclick="socket.emit('typing:category','${k}')"><b>${n}</b><small>${d}</small></button>`).join('')}</div></div><div class="typing-rules">60초 · 시작부터 8개 이상 동시 등장 · 시간이 갈수록 더 빠르고 많아집니다.</div>${host()?'<div class="actions" style="justify-content:center"><button class="btn primary" onclick="socket.emit(\'typing:start\')">타자게임 시작</button></div>':'<p class="center sub">방장이 종류를 고르고 시작할 때까지 기다려 주세요.</p>'}`;
  if(r.phase==='finished')return `<div class="center"><div class="title">⌨️ 타자게임 결과</div><p class="sub">${typingCategoryLabel(cat)} · 획득 단어 수 우선, 동점이면 평균 입력 속도가 빠른 순서</p></div><div class="ranking">${(t.ranking||[]).map((x,i)=>`<div class="rank-row"><span>${['🥇','🥈','🥉'][i]||`${i+1}위`} ${esc(x.nickname)}</span><span><b>${x.count}개</b>${x.avgMs!=null?` · 평균 ${(x.avgMs/1000).toFixed(2)}초`:''}</span></div>`).join('')}</div>${commonEnd()}`;
  return `<div class="typing-wrap"><div class="typing-top"><div><div class="title">⌨️ ${typingCategoryLabel(cat)}</div><div class="sub">보이는 단어를 정확히 입력하면 가장 먼저 친 사람이 획득!</div></div><div class="typing-clock" id="typingClock">01:00</div></div><div class="typing-scoreboard" id="typingScores">${typingScoresHtml()}</div><div class="typing-arena" id="typingArena"></div><div class="typing-input-wrap"><input id="typingInput" class="input typing-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="단어를 입력하세요" oncompositionstart="state.typingComposing=true" oncompositionend="state.typingComposing=false;maybeSubmitTyping(this)" oninput="maybeSubmitTyping(this)" onkeydown="if(event.key==='Enter'){event.preventDefault();submitTypingInput()}"><span id="typingGain" class="typing-gain"></span></div></div>`;
}
function typingScoresHtml(){const r=state.room,t=r?.typing||{},scores=t.scores||{};return (r?.players||[]).slice().sort((a,b)=>(scores[b.id]?.count||0)-(scores[a.id]?.count||0)).map(p=>`<span class="player-chip ${p.id===socket.id?'ready':''}" data-typing-score="${p.id}">${esc(p.nickname)} <b>${scores[p.id]?.count||0}</b></span>`).join('')}
function syncTypingScores(){const box=document.getElementById('typingScores');if(box)box.innerHTML=typingScoresHtml()}
function normalizeTypingClient(v){return String(v??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US')}
function maybeSubmitTyping(el){if(state.typingComposing||state.room?.game!=='typing'||state.room.phase!=='playing')return;const v=normalizeTypingClient(el.value);if(!v)return;const match=(state.room.typing?.words||[]).some(w=>normalizeTypingClient(w.text)===v);if(match){socket.emit('typing:submit',el.value);el.value=''}}
function submitTypingInput(){const el=document.getElementById('typingInput');if(!el||state.typingComposing)return;const v=el.value.trim();if(v){socket.emit('typing:submit',v);el.value=''}}
function flashTypingGain(word){const el=document.getElementById('typingGain');if(!el)return;el.textContent=`+1 ${word}`;el.classList.remove('show');void el.offsetWidth;el.classList.add('show')}
function startTypingLocal(){if(state.typingRaf)return;syncTypingWords();updateTypingHud();document.getElementById('typingInput')?.focus();const loop=()=>{if(state.room?.game!=='typing'||state.room.phase!=='playing'){state.typingRaf=0;return}animateTypingWords();updateTypingHud();state.typingRaf=requestAnimationFrame(loop)};state.typingRaf=requestAnimationFrame(loop)}
function stopTypingLocal(){if(state.typingRaf)cancelAnimationFrame(state.typingRaf);state.typingRaf=0}
function syncTypingWords(){const arena=document.getElementById('typingArena');if(!arena)return;const words=state.room?.typing?.words||[],ids=new Set(words.map(w=>w.id));arena.querySelectorAll('[data-typing-word]').forEach(el=>{if(!ids.has(el.dataset.typingWord))el.remove()});for(const w of words){let el=arena.querySelector(`[data-typing-word="${w.id}"]`);if(!el){el=document.createElement('div');el.className='falling-word';el.dataset.typingWord=w.id;el.textContent=w.text;el.style.left=w.x+'%';arena.appendChild(el)}}animateTypingWords()}
function animateTypingWords(){const arena=document.getElementById('typingArena');if(!arena)return;const h=arena.clientHeight,now=Date.now(),map=new Map((state.room?.typing?.words||[]).map(w=>[w.id,w]));arena.querySelectorAll('[data-typing-word]').forEach(el=>{const w=map.get(el.dataset.typingWord);if(!w)return el.remove();const progress=Math.max(0,Math.min(1,(now-w.bornAt)/w.duration));const y=-44+progress*(h+38);el.style.transform=`translate(-50%,${y}px)`;el.style.opacity=progress>.94?String(Math.max(0,(1-progress)/.06)):1})}
function updateTypingHud(){const el=document.getElementById('typingClock'),t=state.room?.typing;if(!el||!t)return;const left=Math.max(0,(t.endsAt||Date.now())-Date.now());const sec=Math.ceil(left/1000);el.textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`}

function waterballItemIcon(t){return t==='range'?'🔥':t==='bomb'?'➕':t==='speed'?'⚡':t==='turtle'?'🐢':t==='rabbit'?'🐇':'🌈'}
function waterballView(){
  const r=state.room,w=r.waterball||{},wp=w.players?.[socket.id];
  if(r.phase==='lobby')return `<div class="center"><div class="title">💦 물풍선 대전</div><p class="sub">방향키 이동 · Space 물풍선 · 블록을 부수고 아이템을 먹어 마지막까지 살아남으세요!</p><div class="water-rules"><span>🔥 물줄기 증가</span><span>➕ 풍선 개수 증가</span><span>⚡ 기본속도 증가</span><span>🐢 5.5초 느려짐</span><span>🐇 5.5초 빨라짐</span><span>🌈 4.2초 무적</span></div></div>${host()?'<div class="actions" style="justify-content:center"><button class="btn primary" onclick="socket.emit(\'waterball:start\')">물풍선 대전 시작</button></div>':'<p class="center sub">방장이 시작할 때까지 기다려 주세요.</p>'}`;
  if(r.phase==='finished')return `<div class="center"><div class="title">${w.winner?`🏆 ${esc(w.winner)} 우승!`:'💥 전원 탈락!'}</div><p class="sub">물풍선 대전 결과</p></div><div class="ranking">${(w.ranking||[]).map((x,i)=>`<div class="rank-row"><span>${['🥇','🥈','🥉'][i]||`${i+1}위`} ${esc(x.nickname)}</span><span>${x.status}</span></div>`).join('')}</div>${commonEnd()}`;
  const rows=w.rows||11,cols=w.cols||13,cells=[];
  for(let rr=0;rr<rows;rr++)for(let cc=0;cc<cols;cc++){
    const tile=w.tiles?.[rr]?.[cc]||'floor',bomb=(w.bombs||[]).find(b=>b.r===rr&&b.c===cc),flame=(w.flames||[]).some(f=>f.r===rr&&f.c===cc),item=(w.items||[]).find(x=>x.r===rr&&x.c===cc),players=Object.values(w.players||{}).filter(p=>p.r===rr&&p.c===cc);
    const now=Date.now();
    cells.push(`<div class="water-cell ${tile} ${flame?'flame':''}">${tile==='hard'?'🧱':tile==='soft'?'📦':''}${item?`<span class="water-item">${waterballItemIcon(item.type)}</span>`:''}${bomb?'<span class="water-bomb">💧</span>':''}${flame?'<span class="water-flame">💦</span>':''}${players.map(p=>`<span class="water-player ${p.alive?'':'dead'} ${p.id===socket.id?'mine':''} ${(p.invincibleUntil||0)>now?'invincible':''} ${(p.slowUntil||0)>now?'slowed':''} ${(p.hasteUntil||0)>now?'hasted':''}" style="--pc:${p.color}" title="${esc(p.nickname)}"><i>${(p.invincibleUntil||0)>now?'😎':'🙂'}</i><b>${esc(p.nickname.slice(0,4))}</b></span>`).join('')}</div>`);
  }
  const now=Date.now(),effects=wp?[[(wp.slowUntil||0)>now,'🐢 느려짐'],[(wp.hasteUntil||0)>now,'🐇 가속'],[(wp.invincibleUntil||0)>now,'🌈 무적']].filter(x=>x[0]).map(x=>`<span>${x[1]}</span>`).join(''):'';
  return `<div class="water-head"><div><div class="title">💦 물풍선 대전</div><div class="sub">방향키 이동 · Space 물풍선 설치 · 맵 ${Number(w.mapVariant||0)+1}</div></div>${wp?`<div class="water-stats"><span>💧 ${wp.maxBombs}</span><span>🔥 ${wp.range}</span><span>⚡ ${wp.speed}</span>${effects}</div>`:''}</div>${w.finalDuel?'<div class="water-final"><b>🔥 FINAL DUEL 🔥</b><span>최후의 2인! 두 참가자 모두 물풍선 +3 · 물줄기 +1~2칸 강화!</span></div>':''}${wp&&!wp.alive?'<div class="spectator-panel"><b>💥 탈락!</b><span>남은 참가자들의 대전을 관전 중입니다.</span></div>':''}<div class="water-board" style="--cols:${cols}">${cells.join('')}</div><div class="water-legend"><span>📦 부술 수 있는 블록</span><span>💧 설치한 물풍선</span><span>💦 물줄기에 닿으면 탈락</span><span>🐢 감속</span><span>🐇 가속</span><span>🌈 무적</span></div>`;
}


function catchmindView(){
  const r=state.room,c=r.catchmind||{},m=me();
  if(r.phase==='lobby')return `<div class="center"><div class="title">🎨 캐치마인드</div><p class="sub">한 명씩 그림을 그리고 나머지 참가자들은 채팅으로 정답을 맞혀요.</p><div class="catch-rules"><b>${c.rounds||3}라운드</b> · 제시어 선택 10초 · 그림 제한시간 80초 · 후반부 글자 힌트 공개</div>${host()?`<div class="field catch-round-lobby"><label>진행 라운드</label><div class="size-picker">${[3,4,5].map(n=>`<button class="size-option ${c.rounds===n?'selected':''}" onclick="socket.emit('catchmind:rounds',${n})">${n}라운드</button>`).join('')}</div></div><button class="btn primary" onclick="socket.emit('catchmind:start')">캐치마인드 시작</button>`:'<p class="sub">방장이 게임을 시작할 때까지 기다려 주세요.</p>'}</div>`;
  if(r.phase==='finished')return `<div class="center"><div class="title">🏆 캐치마인드 결과</div><div class="ranking catch-ranking">${(c.ranking||[]).map((x,i)=>`<div class="rank-row"><span>${['🥇','🥈','🥉'][i]||`${i+1}위`} <b>${esc(x.nickname)}</b></span><b>${x.score}점</b></div>`).join('')}</div></div>${commonEnd()}`;
  const drawer=r.players.find(p=>p.id===c.drawerId),isDrawer=c.drawerId===socket.id,turnNo=(c.turn||0)+1;
  const scoreRows=r.players.slice().sort((a,b)=>(c.scores?.[b.id]||0)-(c.scores?.[a.id]||0)).map(p=>`<span class="catch-score ${p.id===c.drawerId?'drawer':''}">${esc(p.nickname)} <b>${c.scores?.[p.id]||0}</b></span>`).join('');
  if(c.stage==='choosing')return `<div class="center"><div class="title">🎨 ${c.round}/${c.rounds}라운드 · ${turnNo}/${c.totalTurns}</div><div class="catch-scoreboard">${scoreRows}</div>${isDrawer?`<h2>제시어를 골라주세요!</h2><p class="sub">10초 안에 선택하지 않으면 랜덤으로 결정됩니다.</p><div class="catch-choice-list">${(c.choices||[]).map((w,i)=>`<button class="catch-choice" onclick="socket.emit('catchmind:choose',${i})">${esc(w)}</button>`).join('')}</div>`:`<div class="catch-wait"><div class="emoji-big">🖌️</div><h2>${esc(drawer?.nickname||'')}님이 제시어를 고르는 중...</h2></div>`}<div class="catch-clock">선택시간 <b id="catchClock">10</b>초</div></div>`;
  if(c.stage==='between'){const tr=c.turnResult||{};return `<div class="center catch-between"><div class="title">정답은 <b>${esc(tr.word||c.word||'')}</b>!</div>${tr.noCorrect?`<h2>아무도 못 맞혔어요 😭</h2><p>출제자 ${esc(drawer?.nickname||'')} +30점</p>`:`<h3>이번 문제 정답 순서</h3><div class="ranking">${(tr.guesses||[]).map(g=>`<div class="rank-row"><span>${g.rank}위 ${esc(g.nickname)}</span><b>+${g.points}점</b></div>`).join('')}</div>`}<p class="sub">잠시 후 다음 출제자로 넘어갑니다.</p></div>`;}
  const alreadyCorrect=(c.guesses||[]).some(g=>g.id===socket.id);
  const answerBox=isDrawer?`<div class="catch-answer drawer-answer">내 제시어: <b>${esc(c.word||'')}</b></div>`:`<div class="catch-answer"><span>${c.wordLength||0}글자</span><b>${esc(c.hintMask||'')}</b></div>`;
  return `<div class="catch-wrap"><div class="catch-top"><div><b>${c.round}/${c.rounds}라운드</b> · 출제자 <strong>${esc(drawer?.nickname||'')}</strong></div><div>남은 시간 <b id="catchClock">80</b>초</div></div>${answerBox}<div class="catch-scoreboard">${scoreRows}</div><div class="catch-main"><div class="catch-board-wrap"><canvas id="catchCanvas" width="900" height="560"></canvas>${isDrawer?`<div class="catch-tools">${[['#ff3b30','빨'],['#ff9500','주'],['#ffd60a','노'],['#34c759','초'],['#0a84ff','파'],['#5856d6','남'],['#af52de','보'],['#111111','검'],['#ffffff','흰']].map(([v,n])=>`<button title="${n}" class="catch-color ${state.catchColor===v?'selected':''}" style="--sw:${v}" onclick="setCatchColor('${v}')"></button>`).join('')}<button class="btn danger small" onclick="socket.emit('catchmind:clear')">전체 지우기</button></div>`:'<div class="catch-view-label">👀 그림을 보고 정답을 맞혀보세요!</div>'}</div><div class="catch-chat"><div class="catch-messages" id="catchMessages">${(c.chat||[]).map(x=>`<div class="catch-msg ${x.type==='correct'?'correct':''}"><b>${esc(x.nickname)}</b> ${x.type==='correct'?'🎯 정답!':esc(x.text)}</div>`).join('')}</div>${isDrawer?'<div class="catch-drawer-note">그림을 그리는 동안 채팅 정답 입력은 할 수 없어요.</div>':alreadyCorrect?'<div class="catch-drawer-note correct">정답을 맞혔어요! 🎉</div>':`<div class="catch-input-row"><input id="catchGuess" class="input" maxlength="60" placeholder="정답 입력 후 Enter" onkeydown="if(event.key==='Enter')submitCatchGuess()"><button class="btn primary" onclick="submitCatchGuess()">입력</button></div>`}</div></div></div>`;
}
function submitCatchGuess(){const el=document.getElementById('catchGuess');const v=el?.value.trim();if(!v)return;socket.emit('catchmind:guess',v);el.value='';el.focus()}
function setCatchColor(v){state.catchColor=v;document.querySelectorAll('.catch-color').forEach(b=>b.classList.toggle('selected',b.style.getPropertyValue('--sw')===v))}
function setupCatchmindAfterRender(){const c=state.room?.catchmind;if(!c)return;clearInterval(state.catchTimer);const clock=document.getElementById('catchClock');const deadline=c.stage==='choosing'?c.chooseDeadline:c.stage==='drawing'?c.drawDeadline:null;if(clock&&deadline){const tick=()=>{const n=Math.max(0,Math.ceil((deadline-Date.now())/1000));clock.textContent=n};tick();state.catchTimer=setInterval(tick,250)}if(c.stage!=='drawing')return;const cv=document.getElementById('catchCanvas');if(!cv)return;clearCatchCanvas();(c.strokes||[]).forEach(drawCatchSegment);if(c.drawerId!==socket.id)return;cv.style.touchAction='none';const pos=e=>{const r=cv.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))}};cv.onpointerdown=e=>{state.catchDrawing=true;state.catchLast=pos(e);cv.setPointerCapture?.(e.pointerId)};cv.onpointermove=e=>{if(!state.catchDrawing||!state.catchLast)return;const q=pos(e),seg={x1:state.catchLast.x,y1:state.catchLast.y,x2:q.x,y2:q.y,color:state.catchColor,width:6};drawCatchSegment(seg);socket.emit('catchmind:draw',seg);state.catchLast=q};const up=()=>{state.catchDrawing=false;state.catchLast=null};cv.onpointerup=up;cv.onpointercancel=up;cv.onpointerleave=up}
function clearCatchCanvas(){const cv=document.getElementById('catchCanvas');if(!cv)return;const ctx=cv.getContext('2d');ctx.save();ctx.fillStyle='#ffffff';ctx.fillRect(0,0,cv.width,cv.height);ctx.restore()}
function drawCatchSegment(seg){const cv=document.getElementById('catchCanvas');if(!cv)return;const ctx=cv.getContext('2d');ctx.beginPath();ctx.moveTo(seg.x1*cv.width,seg.y1*cv.height);ctx.lineTo(seg.x2*cv.width,seg.y2*cv.height);ctx.strokeStyle=seg.color||'#111';ctx.lineWidth=seg.width||6;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke()}

function gomokuView(){const r=state.room,g=r.gomoku,p=me();const status=g.winner?`${esc(g.winner)}이(가) 승리!`:r.players.length<2?'상대 참가자를 기다리는 중...':`${g.turn==='black'?'흑':'백'}돌 차례`;return `<div class="center"><div class="title">⚫ 오목</div><p class="sub">내 돌: ${p?.stone==='black'?'흑':p?.stone==='white'?'백':'관전'} · ${status}</p></div><div class="gomoku-wrap"><div class="gomoku">${g.board.flatMap((row,rr)=>row.map((v,cc)=>`<button class="intersection" onclick="placeStone(${rr},${cc})">${v?`<span class="stone ${v} ${g.winLine?.some(([r,c])=>r===rr&&c===cc)?'win':''}"></span>`:''}</button>`)).join('')}</div></div>${commonEnd()}`}
function placeStone(r,c){socket.emit('gomoku:place',{r,c})}

render();
