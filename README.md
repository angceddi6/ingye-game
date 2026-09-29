# 인계자 정하기 — 경강 미니게임

실시간 Socket.IO 기반 미니게임 사이트입니다. 최대 10명이 같은 초대코드로 참여할 수 있습니다.

## 포함 게임
- 사다리 타기
- 3×3 / 4×4 / 5×5 빙고
- 실시간 똥피하기 + 탈락 후 관전
- 스페이스바 레이싱
- 5~10초 랜덤 타이밍 게임
- 라이어 게임
- 폭탄 돌리기
- 카드 뒤집기
- 타자게임: 의학용어 / 일상용어 / 사자성어
- 2인용 오목

## 타자게임
- 모든 참가자가 같은 단어 배치를 실시간으로 봅니다.
- 60초 동안 진행하며 시작부터 8개 이상 단어가 동시에 내려옵니다.
- 시간이 지날수록 단어 수와 낙하 속도가 증가합니다.
- 먼저 정확히 입력한 참가자만 해당 단어를 획득합니다.
- 획득 수가 많은 순서로 순위를 정하고, 동점이면 평균 획득 속도가 빠른 참가자가 앞섭니다.
- 의학용어 280개, 일상용어 214개, 사자성어 175개가 포함되어 있습니다.

## 로컬 실행
1. Node.js 20 이상 설치
2. 프로젝트 폴더에서 `npm install`
3. `npm start`
4. 브라우저에서 `http://localhost:3000`

## GitHub 업로드
1. GitHub에서 새 저장소를 만듭니다.
2. ZIP 압축을 풀고 폴더 안의 모든 파일을 저장소에 업로드합니다.
3. `package.json`, `server.js`, `render.yaml`, `public` 폴더가 저장소 최상단에 있어야 합니다.

## Render 배포
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/health`

## 운영 참고
- 방 정보는 서버 메모리에 저장되므로 Render 서버가 재시작되면 기존 방은 사라집니다.
- 무료 Render 인스턴스는 사용하지 않을 때 절전될 수 있어 첫 접속이 느릴 수 있습니다.
- 게임 진행 중에는 신규 입장이 차단되고, 로비 또는 최종 결과 화면에서는 입장할 수 있습니다.
- 방장이 나가면 남아 있는 참가자 중 한 명에게 방장이 자동 위임됩니다.

## 캐치마인드
- 방장이 3~5라운드 선택 (1라운드 = 전원 1회 출제)
- 출제자는 10초 안에 서로 겹치지 않는 제시어 후보 3개 중 하나 선택, 미선택 시 랜덤
- 80초 실시간 그림 그리기, 9색 팔레트와 전체 지우기
- 다른 참가자는 채팅으로 정답 입력, 정답 순서에 따라 40/30/15/5/5점 등 차등 지급
- 아무도 못 맞히면 출제자 +30점
- 제한시간 절반 이후 아무도 못 맞힌 경우 글자 힌트 순차 공개
- 한 게임 안에서 제시어 후보가 반복되지 않도록 관리


## 캐치마인드 시간 수정
- 제시어 선택: 10초
- 그림/정답 제한시간: 서버 기준 정확히 80초
- 힌트: 41초, 54초, 67초 후 공개
- 화면 카운트와 서버 종료 타이머가 동일 기준을 사용합니다.


## 2026-09-28 fixes
- Typing game now seeds initial words in room state and immediately syncs them to late joiners/recovering clients.
- Catchmind uses per-turn tokens so stale timers cannot end a later turn early or reveal hints from a previous turn. Drawing/guessing stays open for the full 80 seconds unless everyone has guessed correctly.
- Catchmind hint reveals exactly one character at each scheduled hint time.
- Liar game shows the category to the liar and waits 1.8 seconds after the third-round final explanation before opening voting.
- Invite codes ignore all whitespace when joining.


## 2026-09-28 추가 수정
- 라이어 3라운드 마지막 설명 후 투표까지 10초 카운트다운
- 캐치마인드 힌트: 2글자 이하 30초 1글자 / 3글자 30·45초 2글자 / 4글자 이상 30·45·60초 3글자
- 캐치마인드 지우개 기능 추가
- 초대코드 입력 시 공백 제거 및 복사 버튼 추가
- 폭탄 돌리기 폭발 1초 전 빨간 깜빡임 경고
- 물풍선 거북이/토끼 속도 효과 강화 및 아이템 드랍 확률 증가


## v5 fixes (2026-09-28)
- Catchmind eraser now redraws as white source-over strokes so replay/rerender keeps only the selected area erased on the drawer and participants.
- Liar final 10-second countdown now receives revealDeadline in the client room state, so the displayed 10→0 countdown updates in real time.
