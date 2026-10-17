# 인계자 정하기 — 경강 미니게임

실시간 Socket.IO 기반 미니게임 사이트입니다. 최대 10명이 같은 초대코드로 참여할 수 있습니다.

## 포함 게임
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


## 지뢰찾기 클리어 기록 TOP 10 (영구 저장)
- 10×10, 20×20, 30×30, 40×40, 50×50 기록을 각각 분리합니다.
- 성공한 기록만 저장하며, 닉네임·클리어 시간·날짜를 빠른 순으로 TOP 10에 표시합니다.
- Render 재배포 후에도 기록을 보존하려면 PostgreSQL 데이터베이스를 만들고 웹 서비스의 `DATABASE_URL` 환경변수에 내부 연결 URL을 설정해야 합니다. 서버가 시작될 때 `minesweeper_records` 테이블을 자동으로 생성합니다.
- Render의 Environment 메뉴에서 `DATABASE_URL`을 설정한 뒤 재배포하세요. 데이터베이스를 연결하지 않으면 TOP 10은 동작하지 않으며, 기록은 영구 저장되지 않습니다.

## v31 update (2026-10-05)
- Catchmind: preserve draft text and caret across realtime room updates; keep chat scrolled to latest messages.
- Typing: increased word count, gradually faster fall, synchronized birth times, and delayed shared removal after a word is claimed so slower devices can see it.
- Waterball: stronger range/speed item upgrades, longer invincibility, and prominent pickup feedback.
- Minesweeper: added 5×5 board (5 mines) and size-specific record support.
- Twenty questions: explain that each question needs an answer before the next question; allow repeated wrong intermediate guesses with -10 points per miss.


## 무궁화 꽃이 피었습니다 (멀티플레이 규칙)

- 2명 이상 참가해야 시작할 수 있고, 서버가 술래 1명을 무작위로 선정합니다.
- 술래가 `구호 시작하기`를 누르면 최대 5초 동안 초록색 구호 단계가 됩니다. 도전자는 오른쪽 방향키 또는 D 키로 결승선을 향해 이동합니다.
- 술래가 `뒤돌아보기 (얼음!)`를 누르거나 5초가 지나면 빨간색 정지 단계가 됩니다. 정지 단계에서 이동 입력을 보내면 서버 판정으로 탈락합니다.
- 먼저 결승선에 도착한 순서대로 순위를 기록하며, 모든 도전자가 완주하거나 탈락하면 게임이 끝납니다.
- 술래 선정, 이동 위치, 단계 전환, 탈락 및 완주 판정은 서버가 관리하고 방 참가자에게 동기화합니다.


## v48 additions
- Added a solo Apple Game (17×10 board, 170 apples, 120-second timer, rectangular sum-to-10 selections, score per apple, clear-time result).
- Removed Ladder Game from game selection and removed its client/server implementation.

## v49 updates (2026-10-11)
- Apple Game now saves score attempts and displays the top 10, ordered by score; ties at a full-clear score are ordered by fastest clear time. Records use the existing PostgreSQL `minigame_records` table and require `DATABASE_URL` for persistence.
- Moved Apple Game to immediately after Red Light Green Light in both game selection lists and added the `1인용` badge.
- Red Light Green Light now automatically switches to `얼음!` after a random 2–5 seconds, and the next chant can start after 0.5 seconds.
- Added explicit arrow-key controls to the Tagger lobby instructions.


## 뮤직톡톡 (1인용)
- 20개 스테이지의 리듬 액션 게임입니다. 시작 전 `3, 2, 1, 시작!` 카운트다운을 표시합니다. 방향키 패턴은 방향키로, 얼굴/아이템 노트는 스페이스바로 입력합니다. 롱노트는 표시된 방향키를 연타합니다.
- 시작 시 목숨 3개, 기본 제한시간 3분입니다. 틀리거나 타이밍을 놓치면 목숨이 줄고, 시계 아이템은 8초, 하트 아이템은 목숨 1개를 추가합니다.
- 게임 종료 시 도달 스테이지와 플레이 시간을 TOP 10 기록에 저장합니다. 완주 기록은 빠른 시간 순으로 정렬됩니다.
- 기록을 영구 보존하려면 Render의 PostgreSQL `DATABASE_URL` 환경변수가 설정되어 있어야 합니다.


## v51 updates (2026-10-11)
- Added one-use `섞기` during an Apple Game run. It shuffles only the values in the remaining occupied apple cells, preserving the number of apples already cleared and remaining.
- Changed Music Talk Talk user-facing life terminology from `음표펫` to `목숨`.
- Added a pre-game `3, 2, 1, 시작!` countdown; the 3-minute play timer starts after the countdown.


## v52 추가: 오락실 슈팅
- 기존 게임을 유지하고 게임 선택 목록 맨 마지막에 1인용 종스크롤 슈팅을 추가했습니다.
- 방향키 이동, 스페이스바 연속 발사, 시작 목숨 3개, 점점 강해지는 적/탄막과 보스 적을 지원합니다.
- 게임 종료 시 점수·웨이브·생존 시간을 PostgreSQL `minigame_records`의 `arcadeshooter` 키로 저장하고 TOP 10을 표시합니다.
- Render에서 기록을 영구 저장하려면 `DATABASE_URL`이 설정되어 있어야 합니다.


## v71 update (2026-10-17) — TOP 10 기록 관리자 및 버블 슈터 저장 수정
- `/admin-records.html` 관리자 페이지를 추가했습니다. 기존 TOP 10 기록을 가진 10개 게임(버블 슈터, 똥피하기, 타자게임, 테트리스, 블록게임, 슈팅게임, 뮤직톡톡, 사과게임, 미로찾기, 지뢰게임)의 기록을 조회하고 수기 추가/수정/삭제할 수 있습니다.
- 관리자 페이지는 Render 웹 서비스의 Environment에 `ADMIN_RECORDS_PASSWORD`를 설정해야 활성화됩니다. 충분히 길고 추측하기 어려운 비밀번호를 사용하고 공유하지 마세요. 비밀번호를 설정하지 않으면 관리자 기록 변경 API는 비활성 상태입니다.
- 접속 주소: 배포한 사이트 주소 뒤에 `/admin-records.html`을 붙입니다.
- 버블 슈터는 같은 방에서 `다시 도전하기`로 재시작할 때 기록 저장 보호 플래그가 초기화되지 않아 두 번째 판부터 저장 요청이 건너뛰어질 수 있던 문제를 수정했습니다. 저장 요청이 실패하면 결과 화면에서 다시 저장을 시도할 수 있습니다.
- 기존 데이터베이스의 기록을 자동 복구하지는 않습니다. 누락된 기록은 관리자 페이지에서 직접 입력해야 하며, 수기 입력 시 기록 시각은 실제 플레이 시각이 아니라 입력한 시각으로 저장됩니다.
