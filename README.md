# 벌점제 웹앱 (Render 배포용) - Monorepo

구성
- client: React + Vite + Tailwind UI
- server: Node.js + Express + SQLite (better-sqlite3)
- 단일 Render Web Service로 배포 가능 (서버가 client 빌드 정적 파일 서빙)

중요: 이 대화에 SMS API 키/시크릿이 노출되었습니다.
- 즉시 CoolSMS 콘솔에서 해당 키를 폐기(rotate)하고 새 키를 발급하세요.
- 본 프로젝트에는 키를 코드에 하드코딩하지 않고 `.env` 환경변수로만 받도록 되어 있습니다.

## 1) 로컬 실행 (VSCode)

사전 준비
- Node.js 18+ 권장
- npm 사용

### 설치
터미널에서:
```bash
npm run setup
```

### 개발 모드 실행 (프론트/백 동시)
```bash
npm run dev
```

- client: http://localhost:5173
- server(API): http://localhost:8080

개발 모드에서는 client가 server로 프록시됩니다.

## 2) 환경변수(.env)

`server/.env` 파일을 만들고 아래를 채우세요.

```bash
# 서버 포트
PORT=8080

# SQLite DB 파일 경로 (Render에서는 /var/data/app.db 권장)
DB_PATH=./data/app.db

# CoolSMS (절대 코드에 하드코딩 금지)
COOLSMS_API_KEY=YOUR_KEY
COOLSMS_API_SECRET=YOUR_SECRET
COOLSMS_SENDER_PHONE=YOUR_SENDER_PHONE   # 발신번호 (사전 등록된 번호)
```

## 3) Render 배포 (단일 서비스)

Render에서 New -> Web Service 생성 후 GitHub 연결(또는 ZIP 업로드 후 GitHub로 푸시).

권장 설정
- Runtime: Node
- Build Command:
  ```bash
  npm run build
  ```
- Start Command:
  ```bash
  npm start
  ```

### Persistent Disk 설정(중요)
SQLite를 쓰므로 디스크가 필요합니다.
- Disk Name: data
- Mount Path: /var/data
- Size: 적당히(예: 1GB)

Environment Variables
- DB_PATH=/var/data/app.db
- COOLSMS_API_KEY=...
- COOLSMS_API_SECRET=...
- COOLSMS_SENDER_PHONE=...

## 4) 기능 요약 (요구사항 반영)

1페이지 학생 DB
- 엑셀 업로드로 학생 목록 채우기
- 웹에서 직접 수정/추가/삭제

2페이지 벌점 기록 보기/리셋
- 학생 이름 리스트
- 선택 학생의 벌점 내역과 누적 점수 표시
- 기간 선택 후 해당 기간 벌점 일괄 삭제(리셋)

3페이지 벌점 부여
- 학생 선택
- 날짜 선택(캘린더)
- 위반 항목(설정에서 만든 규칙) 선택 후 벌점 부여

4페이지 설정
- 위반 항목(규칙)과 점수 관리
- 누적 벌점 기준치/패널티(문자 템플릿 포함) 관리

5페이지 문자 발송(CoolSMS)
- 학생 정보 + 누적 벌점 표시
- 기준치 초과자 한눈에 확인(배지/강조)
- 선택 학생에게 문자 발송 (기본 템플릿 편집 가능)

6페이지 특이사항
- 학생별/날짜별 메모 CRUD

## 5) 엑셀 포맷
샘플 컬럼(헤더)
- ID
- 이름
- 학년
- 학생전화
- 보호자전화

헤더명은 위와 동일하면 가장 안정적으로 동작합니다.
