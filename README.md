# 인계는 누구? — 경강 미니게임

실시간 Socket.IO 기반 미니게임 사이트입니다. 최대 10명이 같은 초대코드로 참여할 수 있습니다.

## 포함 게임
- 사다리 타기
- 5×5 빙고
- 실시간 똥피하기
- 스페이스바 레이싱
- 2인용 오목

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
1. Render에서 New → Blueprint를 선택합니다.
2. GitHub 저장소를 연결합니다.
3. 저장소의 `render.yaml`이 자동 인식됩니다.
4. Deploy를 누릅니다.
5. 배포가 끝나면 Render가 제공하는 주소로 접속합니다.

Blueprint 대신 Web Service를 직접 만들 경우:
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/health`

## 운영 참고
- 방 정보는 서버 메모리에 저장되므로 Render 서버가 재시작되면 기존 방은 사라집니다.
- 무료 Render 인스턴스는 사용하지 않을 때 절전될 수 있어 첫 접속이 느릴 수 있습니다.
- 게임 진행 중에는 신규 입장이 차단되고, 로비 또는 최종 결과 화면에서는 입장할 수 있습니다.
- 방장이 나가면 남아 있는 참가자 중 한 명에게 방장이 자동 위임됩니다.
