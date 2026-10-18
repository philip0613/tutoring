# 📚 스마트 과외 관리 시스템 v2.0
> **Smart Tutoring Management System v2.0**  
> 선생님과 학생을 연결하는 가장 가볍고 직관적인 1:1 & 소그룹 학습 관리 SaaS 플랫폼

<p align="left">
  <img src="https://img.shields.io/badge/Version-2.0.0-indigo?style=for-the-badge" alt="Version 2.0">
  <img src="https://img.shields.io/badge/Frontend-HTML5%20%7C%20CSS3%20%7C%20VanillaJS-orange?style=for-the-badge" alt="Frontend">
  <img src="https://img.shields.io/badge/Backend-Vercel%20Serverless-black?style=for-the-badge" alt="Backend">
  <img src="https://img.shields.io/badge/Database-Supabase%20PostgreSQL-emerald?style=for-the-badge" alt="Database">
</p>

---

## 💡 1. 프로젝트 소개

개인 과외나 소규모 공부방을 운영할 때 카카오톡이나 문자로 질문과 숙제를 주고받다 보면 **사진이 만료되고, 학생별 성적 변화와 피드백 기록이 파편화**되는 문제가 있었습니다.

**'스마트 과외 관리 시스템'**은 복잡한 설치 없이 모바일과 노트북 브라우저에서 문제 사진 질문, 풀이 첨삭, 시험지 성적표, 수업 캘린더를 한눈에 관리할 수 있도록 제작된 웹 애플리케이션입니다.

---

## 🚀 2. v1.0 vs v2.0 주요 변화

| 구분 | v1.0 (초기 버전) | ✨ v2.0 (현재 버전) |
| :--- | :--- | :--- |
| **선생님 관리 체제** | 단일 선생님(Admin) 중심 | **다중 선생님 체제 (멀티 테넌트)**: 교사별 독립 공간 |
| **학습 단위** | 학생 개인 직속 관리 | **과목(Subject) 중심 분류**: 중3 수학, 고1 영어 등 과목별 관리 |
| **수업 일정** | 일정 관리 기능 없음 | **월간 수업 캘린더**: 수업 스케줄, 출결 및 진도 메모 |
| **알림 시스템** | 사이트 접속 시에만 확인 | **웹 푸시(Web Push) & 실시간 인앱 알림 센터** |
| **보안 체계** | 파라미터 기반 단순 조회 | **JWT 토큰 인증**: 교사/학생 권한 검증 미들웨어 |
| **사용자 경험(UI)** | 단순 세로 스크롤 카드 | **모바일/노트북 반응형 UI + 서브 탭 + 로딩 스켈레톤** |
| **Vercel 아키텍처** | 개별 함수 (함수 개수 제한 직면) | **단일 통합 게이트웨이 라우터** (무료 12개 제한 완벽 극복) |

---

## ✨ 3. 핵심 기능 상세

### 👥 1) 다중 선생님 체제 & 과목(Subject) 분리 관리
- 선생님마다 본인의 과목(예: *중3 수학 심화*, *고2 공통영어*)을 생성하고 고유 색상을 지정할 수 있습니다.
- 학생을 특정 과목에 수강 배정하며, 질문/시험/과외 일지가 과목별로 묶여 관리되어 한 학생이 여러 과목을 들어도 데이터가 섞이지 않습니다.

### 📅 2) 수업 캘린더 (Class Schedule)
- 월별 달력 UI를 통해 다가오는 과외 일정과 시간을 직관적으로 확인합니다.
- 과목 공통 수업 또는 특정 학생과의 1:1 맞춤 수업을 등록할 수 있습니다.
- 수업 완료, 보강, 취소 상태를 실시간으로 토글 관리합니다.

### 🔔 3) 웹 푸시 알림 & 알림 센터 (Notification Center)
- **학생이 질문 등록** ➡️ 담당 선생님 브라우저/기기로 즉시 알림 발송
- **선생님이 답변/일지 등록** ➡️ 해당 학생에게 즉시 알림 발송
- 상단 헤더의 🔔 벨 아이콘을 눌러 최근 알림 내역을 확인하고 읽음 처리할 수 있습니다.

### ⚡ 4) 사용자 친화적 UI & 로딩 인디케이터
- **스켈레톤(Shimmer) & 스피너**: 네트워크 통신 및 DB 조회 시 은은하게 반짝이는 스켈레톤 UI를 제공하여 대기 시간을 체감하기 편합니다.
- **버튼 로딩 상태**: 저장/등록 버튼 클릭 시 미니 스피너가 돌며 비활성화되어 중복 등록을 원천 방지합니다.
- **서브 탭 분리**: 질문, 성적표, 과외 일지가 탭으로 분리되어 스마트폰에서도 스크롤 압박 없이 쾌적합니다.

### 🔐 5) JWT 기반 강력한 보안 체계
- 클라이언트의 `Authorization: Bearer <JWT>` 토큰을 백엔드에서 실시간 검증합니다.
- 학생은 타인의 성적과 질문에 일체 접근할 수 없으며, 선생님은 본인 담당 과목/학생 데이터만 제어할 수 있습니다.

---

## 🏗️ 4. 시스템 구조 및 Vercel 최적화

```
[클라이언트 (모바일/PC 브라우저)]
       │
       ▼ (HTTPS 요청: /api/schedules, /api/login 등)
[Vercel Serverless 단일 통합 라우터 (api/index.js)]  <-- Hobby 플랜 12개 함수 제한 완벽 해결!
       │
       ├─ JWT 인증 검증 (api/_routes/_auth.js)
       ├─ 내부 모듈 분기 (api/_routes/*.js)
       │
       ▼
[Supabase (PostgreSQL + Auth + Storage tutor_files)]
```

> **💡 Vercel 12개 함수 제한 극복 솔루션**  
> Vercel Hobby 무료 플랜은 프로젝트당 최대 12개의 서버리스 함수만 허용합니다.  
> 이를 해결하기 위해 실제 비즈니스 로직은 `api/_routes/` 폴더로 모듈화하고, 최상단의 단 1개의 게이트웨이 함수([`api/index.js`](./api/index.js))가 모든 요청을 처리하도록 단일 라우터 패턴을 적용했습니다.

---

## 📂 5. 디렉토리 구조

```bash
📦 tutoring-management-system
 ┣ 📂 api                      # Vercel Serverless Functions
 ┃ ┣ 📜 index.js               # [핵심] 12개 제한을 극복하는 단일 통합 게이트웨이 라우터
 ┃ ┗ 📂 _routes                # 내부 라우트 모듈 (Vercel 함수 개수에 카운트되지 않음)
 ┃   ┣ 📜 _auth.js             # JWT 인증 미들웨어 및 Supabase 헬퍼
 ┃   ┣ 📜 subjects.js          # 과목(Subject) 관리 API
 ┃   ┣ 📜 enrollments.js       # 학생 과목 수강 배정 API
 ┃   ┣ 📜 schedules.js         # 수업 캘린더 API
 ┃   ┣ 📜 push.js              # 웹 푸시 및 알림 센터 API
 ┃   ┣ 📜 login.js             # 통합 로그인 및 토큰 발급
 ┃   ┣ 📜 askQuestion.js       # 학생 질문 등록 (교사 알림 연동)
 ┃   ┣ 📜 answerQuestion.js    # 교사 풀이 답변 (학생 알림 연동)
 ┃   ┣ 📜 getExams.js          # 시험 결과 조회
 ┃   ┣ 📜 uploadExam.js        # 시험 성적 및 시험지 업로드
 ┃   ┣ 📜 getFeedbacks.js      # 과외 일지 조회
 ┃   ┣ 📜 sendFeedback.js      # 과외 일지 등록
 ┃   ┣ 📜 getStudents.js       # 담당 학생 조회
 ┃   ┣ 📜 createStudent.js     # 학생 계정 생성
 ┃   ┣ 📜 changePassword.js    # 비밀번호 변경
 ┃   ┗ 📜 adminAction.js       # 데이터 수정 및 캐스케이딩 사진 완전 폐기
 ┣ 📜 index.html               # SPA 메인 화면 마크업
 ┣ 📜 style.css                # 모바일/노트북 반응형 모던 디자인 및 애니메이션
 ┣ 📜 script.js                # 프론트엔드 비즈니스 로직 및 스켈레톤 로더
 ┣ 📜 sw.js                    # Web Push Service Worker
 ┣ 📜 vercel.json              # Vercel URL Rewrite 설정
 ┗ 📜 supabase_v2_migration.sql # v2.0 데이터베이스 마이그레이션 SQL
```

---

## ⚙️ 6. Supabase 데이터베이스 세팅 가이드

v2.0 기능을 활성화하려면 Supabase 대시보드에서 마이그레이션을 1회 실행합니다.

1. **Supabase 대시보드** 접속 ➡️ 좌측 메뉴 **SQL Editor** 클릭
2. 본 프로젝트의 [`supabase_v2_migration.sql`](./supabase_v2_migration.sql) 파일 내용을 전체 복사하여 붙여넣기
3. **[Run]** 버튼 클릭 (기존 v1 데이터는 100% 안전하게 보존되며 필요한 테이블과 컬럼만 안전하게 추가됩니다.)

---

## 👨‍💻 Developer
- **개발자:** 서유민
