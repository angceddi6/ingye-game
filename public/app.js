const socket=io();
const app=document.getElementById('app');
let state={room:null,nickname:'',selected:'ladder',topic:'',bingoSize:5,countdown:null,dodgeX:50,dodgeTimer:0,keys:{},spectateId:null,raceKeyDown:false,timingKeyDown:false};
let bingoDraft=null;
let bingoComposing=false;
const gameMeta={ladder:['🪜','사다리 타기'],bingo:['⭕','빙고'],dodge:['💩','똥피하기'],race:['🏎️','레이싱'],timing:['⏱️','타이밍 게임'],gomoku:['⚫','오목']};
const esc=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
const me=()=>state.room?.players.find(p=>p.id===socket.id);
const host=()=>state.room?.hostId===socket.id;
const toast=(message,type='')=>{const d=document.createElement('div');d.className='toast '+type;d.textContent=message;document.getElementById('toast').append(d);setTimeout(()=>d.remove(),2800)};

socket.on('toast',x=>toast(x.message,x.type));
socket.on('room:update',room=>{
  state.room=room;
  if(room.phase!=='playing') stopDodgeLocal(true);
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
socket.on('connect',()=>render());

function home(){return `<main class="page"><div class="brand"><h1>인계자 정하기</h1><small>경강 미니게임</small></div><div class="home-grid"><section class="card"><h2>같이 놀 준비됐나요? 🎉</h2><div class="field"><label>닉네임</label><input id="nickname" class="input" maxlength="20" placeholder="닉네임을 입력하세요" value="${esc(state.nickname)}"></div><div class="field"><label>초대코드</label><input id="invite" class="input" maxlength="6" placeholder="참가자만 입력" style="text-transform:uppercase"></div><div class="guide"><b>방장</b> = 닉네임 입력 후 게임 선택<br><b>참가자</b> = 닉네임 입력 후 초대코드에 방장이 보낸 초대코드 입력</div><div class="actions"><button class="btn primary" onclick="createRoom()">선택한 게임 방 만들기</button><button class="btn mint" onclick="joinRoom()">초대코드로 참가하기</button></div></section><section class="card"><h2>게임 선택</h2><div class="games">${Object.entries(gameMeta).map(([k,[e,n]])=>`<button class="game-card ${state.selected===k?'selected':''}" onclick="selectGame('${k}')"><span class="emoji">${e}</span><b>${n}</b><span class="sub">${desc(k)}</span>${k==='gomoku'?'<span class="game-badge">2인용</span>':''}</button>`).join('')}</div><div id="topicWrap" class="field ${state.selected==='bingo'?'':'hidden'}"><label>빙고 주제</label><input id="topic" class="input" maxlength="40" placeholder="예: 우리반 추억, 음식, 여행지" value="${esc(state.topic)}"><label>빙고판 크기</label><div class="size-picker">${[5,4,3].map(n=>`<button type="button" class="size-option ${state.bingoSize===n?'selected':''}" onclick="setBingoSize(${n})">${n}×${n}<small>${n*n}칸</small></button>`).join('')}</div></div></section></div></main>`}
function desc(k){return {ladder:'운명을 따라 내려가기',bingo:'3×3 · 4×4 · 5×5 선택',dodge:'실시간 생존 게임',race:'스페이스바 연타 대결',timing:'5~10초 랜덤 목표 맞추기',gomoku:'두 명이 겨루는 오목'}[k]}
function selectGame(k){state.selected=k;state.nickname=document.getElementById('nickname')?.value||state.nickname;state.topic=document.getElementById('topic')?.value||state.topic;render()}
function setBingoSize(n){state.nickname=document.getElementById('nickname')?.value||state.nickname;state.topic=document.getElementById('topic')?.value||state.topic;state.bingoSize=[3,4,5].includes(n)?n:5;render()}
function createRoom(){const nickname=document.getElementById('nickname').value.trim();const topic=document.getElementById('topic')?.value.trim()||'';socket.emit('room:create',{nickname,game:state.selected,topic,bingoSize:state.bingoSize},r=>{if(!r.ok)toast(r.message,'error');else state.nickname=nickname})}
function joinRoom(){const nickname=document.getElementById('nickname').value.trim(),code=document.getElementById('invite').value.trim().toUpperCase();socket.emit('room:join',{nickname,code},r=>{if(!r.ok)toast(r.message,'error');else state.nickname=nickname})}
function roomHeader(){const r=state.room;return `<div class="room-top"><div><div class="sub">초대코드</div><div class="code">${r.code}</div></div><div class="players">${r.players.map(p=>`<span class="player-chip ${p.ready?'ready':''} ${p.id===r.hostId?'host':''}">${esc(p.nickname)}${p.ready?' ✓':''}</span>`).join('')}</div><button class="btn danger" onclick="leaveRoom()">방 나가기</button></div>`}
function render(){if(!state.room){app.innerHTML=home();return}const r=state.room;let body='';if(r.phase==='selecting'&&!host())body=`<div class="overlay"><div><div class="count">🎮</div><h2>방장이 게임을 고르는 중입니다.</h2></div></div>`;if(r.phase==='selecting'&&host())body=chooser();else body+=gameView();app.innerHTML=`<main class="page">${roomHeader()}<section class="card game-shell">${body}</section></main>${countdownOverlay()}`;afterRender()}
function chooser(){return `<div class="center"><div class="title">다음 게임을 골라주세요</div><div class="games">${Object.entries(gameMeta).map(([k,[e,n]])=>`<button class="game-card" onclick="chooseNext('${k}')"><span class="emoji">${e}</span><b>${n}</b>${k==='gomoku'?'<span class="game-badge">2인용</span>':''}</button>`).join('')}</div></div>`}
function chooseNext(game){if(game!=='bingo')return socket.emit('room:chooseGame',{game,topic:'',bingoSize:5});openBingoSetup()}
function openBingoSetup(){const wrap=document.createElement('div');wrap.className='overlay';wrap.id='bingoSetupOverlay';wrap.innerHTML=`<div class="modal-card"><div class="title">⭕ 빙고 설정</div><div class="field"><label>빙고 주제</label><input id="nextBingoTopic" class="input" maxlength="40" placeholder="예: 음식, 여행지, 우리반 추억"></div><div class="field"><label>빙고판 크기</label><div class="size-picker">${[5,4,3].map(n=>`<button type="button" class="size-option ${n===5?'selected':''}" data-next-size="${n}" onclick="pickNextBingoSize(${n})">${n}×${n}<small>${n*n}칸</small></button>`).join('')}</div></div><div class="actions"><button class="btn primary" onclick="confirmNextBingo()">빙고 선택</button><button class="btn danger" onclick="document.getElementById('bingoSetupOverlay').remove()">취소</button></div></div>`;document.body.append(wrap);wrap.dataset.size='5';setTimeout(()=>document.getElementById('nextBingoTopic')?.focus(),0)}
function pickNextBingoSize(n){const w=document.getElementById('bingoSetupOverlay');if(!w)return;w.dataset.size=String(n);w.querySelectorAll('[data-next-size]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.nextSize)===n))}
function confirmNextBingo(){const w=document.getElementById('bingoSetupOverlay');const topic=document.getElementById('nextBingoTopic')?.value.trim()||'';const bingoSize=Number(w?.dataset.size)||5;w?.remove();socket.emit('room:chooseGame',{game:'bingo',topic,bingoSize})}
function gameView(){const r=state.room;return {ladder:ladderView,bingo:bingoView,dodge:dodgeView,race:raceView,timing:timingView,gomoku:gomokuView}[r.game]()}
function commonEnd(){if(state.room.phase!=='finished')return'';return `<div class="actions" style="justify-content:center"><button class="btn primary" onclick="socket.emit('game:restart')">게임 다시하기</button>${host()?`<button class="btn mint" onclick="socket.emit('room:selecting')">다른 게임 선택하기</button>`:''}<button class="btn danger" onclick="leaveRoom()">방 나가기</button></div>`}
function leaveRoom(){socket.emit('room:leave');state.room=null;render()}
function countdownOverlay(){const p=state.room?.phase;if(p!=='countdown')return'';return `<div class="overlay"><div class="count" id="countText">3</div></div>`}
function afterRender(){if(state.room?.phase==='countdown')runCountdown();if(state.room?.game==='dodge'&&state.room.phase==='playing')startDodgeLocal()}
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
  return `<div class="center"><div class="title">⭕ ${esc(r.topic||'빙고')} <span class="board-size-badge">${size}×${size}</span></div><p class="sub">${b.started?`${b.target}빙고를 완성한 뒤 닉네임 옆의 빙고 버튼을 누르세요.`:`${cells}칸을 입력한 뒤 준비완료를 눌러주세요. Tab 또는 Enter를 누르면 다음 칸으로 이동합니다.`}</p>${b.started?`<div class="bingo-claim-bar"><b>${esc(m.nickname)}</b><button class="btn bingo-claim ${canClaim?'ready-to-claim':''}" ${canClaim?'':'disabled'} onclick="claimBingo()">빙고!</button><span>${b.myLines.length} / ${b.target}줄</span></div>`:''}</div><div class="bingo-grid" style="--bingo-size:${size}">${board.map((v,i)=>b.started?`<button class="bingo-cell ${b.myMarks[i]?'marked':''} ${b.myLines.some(line=>line.includes(i))?'line':''}" onclick="markBingo(${i})"><span>${esc(v)}</span></button>`:`<div class="bingo-cell bingo-input-cell"><input data-bingo-index="${i}" value="${esc(v)}" maxlength="24" autocomplete="off" oninput="bingoInput(event,${i})" onfocus="bingoFocus(${i})" onblur="bingoBlur()" onkeydown="bingoKey(event,${i})" oncompositionstart="bingoComposing=true" oncompositionend="bingoCompositionEnd(event,${i})"></div>`).join('')}</div><div class="actions" style="justify-content:center">${!b.started?`<button class="btn ${m.ready?'danger':'primary'}" onclick="toggleReady()">${m.ready?'준비 취소':'준비완료'}</button>`:''}${host()&&!b.started?`<label class="target-picker">목표 <select id="bingoTarget">${Array.from({length:Math.min(5,size*2+2)},(_,i)=>i+1).map(n=>`<option value="${n}">${n}빙고</option>`).join('')}</select></label><button class="btn mint" onclick="startBingo()">게임 스타트</button>`:''}${host()&&b.started&&rank.length?`<button class="btn primary" onclick="socket.emit('bingo:finish')">결과 화면 보기</button>`:''}</div>${rank.length?`<div class="ranking"><h3>빙고 선언 순위</h3>${rank.map((x,i)=>`<div class="rank-row"><span>${['🥇','🥈','🥉'][i]||`${i+1}위`} ${esc(x.nickname)}</span><span>${i+1}번째 선언</span></div>`).join('')}</div>`:''}${commonEnd()}`;
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
function markBingo(i){if(state.room.bingo.started)socket.emit('bingo:mark',i)}

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
  const mine=t.submissions?.find(x=>x.id===socket.id);
  const waiting=(t.submissions||[]).length;
  const playButton=r.phase==='playing'?`<button class="timing-stop ${mine?'done':''}" ${mine?'disabled':''} onclick="stopTiming()">${mine?'기록 완료!':'지금이다!'}</button>`:'';
  const lobby=r.phase==='lobby'&&host()?`<div class="actions" style="justify-content:center"><button class="btn primary" onclick="socket.emit('timing:start')">타이밍 게임 시작</button></div>`:'';
  const targetSec=(t.targetMs||0)/1000;
  const message=r.phase==='playing'?(mine?`내 기록 <b>${(mine.time/1000).toFixed(3)}초</b> · 다른 참가자를 기다리는 중`:`마음속으로 ${targetSec.toFixed(0)}초를 센 뒤 버튼 또는 스페이스바를 누르세요!`):'방장이 시작하면 3, 2, 1 후 5~10초 사이의 랜덤 목표가 공개됩니다.';
  const progress=r.phase==='playing'?`<div class="timing-progress">기록 완료 ${waiting} / ${r.players.length}명</div>`:'';
  const results=r.phase==='finished'?`<div class="ranking"><h3>⏱️ ${targetSec.toFixed(3)}초에 가까운 순위</h3>${(t.ranking||[]).map((x,i)=>`<div class="rank-row"><span>${['🥇','🥈','🥉'][i]||`${i+1}위`} ${esc(x.nickname)}</span><span>${(x.time/1000).toFixed(3)}초 · 차이 ${(x.diff/1000).toFixed(3)}초</span></div>`).join('')}</div>`:'';
  return `<div class="center"><div class="title">⏱️ 타이밍 게임</div><p class="sub">매 판 5~10초 사이의 목표가 랜덤으로 정해집니다.</p></div>${lobby}<div class="timing-stage"><div class="timing-target">${r.phase==='playing'||r.phase==='finished'?`${targetSec.toFixed(3)}초`:'? 초'}</div><p>${message}</p>${playButton}${progress}</div>${results}${commonEnd()}`;
}
function stopTiming(){if(state.room?.game==='timing'&&state.room.phase==='playing')socket.emit('timing:stop')}

function gomokuView(){const r=state.room,g=r.gomoku,p=me();const status=g.winner?`${esc(g.winner)}이(가) 승리!`:r.players.length<2?'상대 참가자를 기다리는 중...':`${g.turn==='black'?'흑':'백'}돌 차례`;return `<div class="center"><div class="title">⚫ 오목</div><p class="sub">내 돌: ${p?.stone==='black'?'흑':p?.stone==='white'?'백':'관전'} · ${status}</p></div><div class="gomoku-wrap"><div class="gomoku">${g.board.flatMap((row,rr)=>row.map((v,cc)=>`<button class="intersection" onclick="placeStone(${rr},${cc})">${v?`<span class="stone ${v} ${g.winLine?.some(([r,c])=>r===rr&&c===cc)?'win':''}"></span>`:''}</button>`)).join('')}</div></div>${commonEnd()}`}
function placeStone(r,c){socket.emit('gomoku:place',{r,c})}

render();
