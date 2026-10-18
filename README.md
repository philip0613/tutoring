# 📚 스마트 과외 관리 시스템 v2.0 (Smart Tutoring Management System v2.0)

> 선생님과 학생을 연결하는 가장 가볍고 직관적인 1:1 및 소그룹 학습 관리 플랫폼 <br>
> **v2.0 대규모 업데이트**: 다중 선생님 체제(멀티 테넌트), 과목별 분리 관리, 수업 캘린더, 웹 푸시 알림, JWT 보안 강화

<br>

## 🎯 1. 프로젝트 개요 및 v2.0 신규 기능

'스마트 과외 관리 시스템 v2.0'은 단순한 1:1 문답을 넘어, 여러 명의 선생님이 각자의 과목을 개설하고 학생과 일정을 체계적으로 관리할 수 있는 **멀티 테넌트 SaaS형 교육 관리 플랫폼**입니다.

### ✨ v2.0 핵심 변경점

1. **👥 다중 선생님 체제 (멀티 테넌트 & 데이터 격리)**
   - 여러 명의 선생님이 각각 가입하여 본인만의 과목과 학생을 독립적으로 관리합니다.
   - 타 교사의 학생 및 과목 데이터와 철저하게 분리됩니다.

2. **📖 과목별 관리 (Subjects & Course System)**
   - 학생을 바로 관리하는 대신, 선생님이 과목(예: 중3 수학, 고1 영어)을 개설하고 학생을 수강생으로 배정합니다.
   - 질문, 시험 성적, 피드백이 과목별로 묶여 관리되어 한 학생이 여러 과목을 수강해도 혼선이 없습니다.

3. **📅 수업 캘린더 (Class Schedule & Calendar)**
   - 월별 달력 UI를 통해 수업 일정(일시, 과목, 학생, 수업 메모)을 등록하고 출결/수업 완료 상태를 체크할 수 있습니다.
   - 학생 대시보드에서도 본인의 수업 일정을 달력으로 실시간 확인합니다.

4. **🔔 웹 푸시 알림 및 알림 센터 (Web Push & Notification Center)**
   - Service Worker 기반 브라우저 푸시 알림을 지원합니다.
   - 학생이 질문을 올리면 담당 선생님에게 즉시 알림, 선생님이 답변이나 피드백을 등록하면 학생에게 즉시 알림이 발송됩니다.
   - 인앱 알림 벨(🔔)을 통해 최근 알림 히스토리를 확인하고 읽음 처리할 수 있습니다.

5. **🔐 보안 강화 (JWT 토큰 기반 인증 및 인가)**
   - 모든 백엔드 API 호출 시 클라이언트의 JWT Access Token을 헤더(`Authorization: Bearer <token>`)로 검증합니다.
   - 학생은 타인의 데이터에 접근할 수 없으며, 선생님은 본인 담당 과목의 데이터만 제어할 수 있도록 강력하게 인가(Authorization)를 적용했습니다.

<br>

## 🏗️ 2. 시스템 아키텍처

* **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+), Service Worker (`sw.js`)
* **Backend:** Vercel Serverless Functions (Node.js)
* **Database & Storage:** Supabase (PostgreSQL, Supabase Auth, Supabase Storage `tutor_files`)
* **Deployment:** Vercel

<br>

## 📂 3. 디렉토리 구조

```bash
📦 tutoring-management-system
 ┣ 📂 api                      # Vercel Serverless 백엔드 API
 ┃ ┣ 📜 _auth.js               # [보안] 공통 JWT 토큰 인증 및 Supabase 통신 헬퍼
 ┃ ┣ 📜 subjects.js            # [v2] 과목(Subject) CRUD API
 ┃ ┣ 📜 enrollments.js         # [v2] 학생 과목 수강 배정 API
 ┃ ┣ 📜 schedules.js           # [v2] 수업 캘린더 일정 관리 API
 ┃ ┣ 📜 push.js                # [v2] 웹 푸시 구독 및 알림 센터 API
 ┃ ┣ 📜 login.js               # 통합 로그인 및 JWT 세션 발급
 ┃ ┣ 📜 adminAction.js         # 데이터 수정, 캐스케이딩 사진 폐기 및 삭제
 ┃ ┣ 📜 askQuestion.js         # 학생 질문 등록 (과목 연계 및 교사 알림)
 ┃ ┣ 📜 answerQuestion.js      # 교사 풀이 답변 (학생 알림)
 ┃ ┣ 📜 sendFeedback.js        # 교사 과외 일지 (과목 연계 및 학생 알림)
 ┃ ┣ 📜 uploadExam.js          # 쪽지시험 및 시험지 사진 업로드
 ┃ ┣ 📜 getStudents.js         # 교사별/과목별 담당 학생 조회
 ┃ ┣ 📜 getQuestions.js        # 질문 목록 조회 (과목/학생 필터)
 ┃ ┣ 📜 getExams.js            # 시험 결과 조회
 ┃ ┣ 📜 getFeedbacks.js        # 피드백 목록 조회
 ┃ ┣ 📜 createStudent.js       # 학생 계정 생성 및 과목 배정
 ┃ ┗ 📜 changePassword.js      # 비밀번호 변경
 ┣ 📜 index.html               # SPA 메인 마크업 (탭, 캘린더, 과목, 알림 UI)
 ┣ 📜 style.css                # 모바일 반응형 스타일시트 및 캘린더 디자인
 ┣ 📜 script.js                # v2 프론트엔드 비즈니스 로직
 ┣ 📜 sw.js                    # 웹 푸시 Service Worker
 ┗ 📜 supabase_v2_migration.sql # v2 데이터베이스 마이그레이션 SQL
```

<br>

## ⚙️ 4. v2.0 Supabase DB 세팅 가이드

기존 v1.0 데이터베이스를 v2.0으로 확장하려면:

1. **Supabase 대시보드** 접속 ➡️ 좌측 메뉴 **SQL Editor** 클릭
2. 본 프로젝트의 [`supabase_v2_migration.sql`](./supabase_v2_migration.sql) 파일 내용을 복사하여 붙여넣기
3. **[Run]** 버튼을 눌러 실행합니다. (기존 데이터는 안전하게 보존되며 필요한 테이블과 컬럼만 추가됩니다.)

---

> **Developer:** 서유민
