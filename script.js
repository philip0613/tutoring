// 💡 전역 상태 관리 변수
let currentUser = null; // 현재 로그인한 유저 정보 (role: 'admin' 또는 'student')
let currentStudentId = null; // 선생님이 현재 관리 중인(클릭한) 학생의 ID

document.addEventListener('DOMContentLoaded', () => {
    checkSession(); // 화면이 켜지면 로그인 상태인지 먼저 확인!

    // ==========================================
    // 1. 공통 및 로그인 이벤트
    // ==========================================
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // ==========================================
    // 2. 선생님(Admin) 대시보드 이벤트
    // ==========================================
    document.getElementById('createStudentBtn').addEventListener('click', handleCreateStudent);
    document.getElementById('uploadExamBtn').addEventListener('click', handleUploadExam);
    document.getElementById('sendFeedbackBtn').addEventListener('click', handleSendFeedback);
    document.getElementById('deleteStudentBtn').addEventListener('click', handleDeleteStudent);

    // ==========================================
    // 3. 학생(Student) 대시보드 이벤트
    // ==========================================
    document.getElementById('askQuestionBtn').addEventListener('click', handleAskQuestion);
    document.getElementById('togglePasswordBtn').addEventListener('click', () => {
        document.getElementById('passwordFormContainer').classList.toggle('hidden-form');
    });
    document.getElementById('changePasswordBtn').addEventListener('click', handleChangePassword);
});

// ==========================================
// 💡 핵심 렌더링 함수: 피드백 리스트 (아코디언 UI 적용)
// ==========================================
function renderFeedbackList(feedbacks, containerElement) {
    containerElement.innerHTML = ''; // 리스트 싹 비우기

    if (!feedbacks || feedbacks.length === 0) {
        containerElement.innerHTML = '<li style="text-align:center; color:#888;">아직 등록된 피드백이 없습니다.</li>';
        return;
    }

    feedbacks.forEach(fb => {
        const li = document.createElement('li');

        // 1. 아코디언 제목 버튼 생성
        const titleBtn = document.createElement('button');
        titleBtn.className = 'feedback-title-btn';
        
        // 기존 옛날 데이터(제목 없는 피드백) 호환성을 위한 처리
        const displayTitle = fb.feedback_title ? fb.feedback_title : '제목 없는 피드백'; 
        titleBtn.innerHTML = `📌 ${displayTitle} <span style="font-size: 0.8em; color: #888; font-weight: normal;">(클릭)</span>`;

        // 2. 피드백 상세 내용 영역 생성 (처음엔 CSS로 숨겨져 있음)
        const detailDiv = document.createElement('div');
        detailDiv.className = 'feedback-detail';
        const dateStr = new Date(fb.created_at).toLocaleDateString();
        detailDiv.innerHTML = `
            <p>${fb.feedback_text}</p>
            <div style="text-align: right; margin-top: 10px; font-size: 0.8em; color: #aaa;">${dateStr}</div>
        `;

        // 3. 클릭 시 내용이 열리고 닫히는 토글 이벤트
        titleBtn.addEventListener('click', () => {
            detailDiv.classList.toggle('show');
        });

        // 합체
        li.appendChild(titleBtn);
        li.appendChild(detailDiv);
        containerElement.appendChild(li);
    });
}

// ==========================================
// 💡 선생님 API 액션 함수
// ==========================================

// 피드백 전송 로직
async function handleSendFeedback() {
    const titleInput = document.getElementById('feedbackTitleAdmin');
    const textInput = document.getElementById('feedbackTextAdmin');
    
    const title = titleInput.value.trim();
    const text = textInput.value.trim();

    if (!title || !text) {
        alert('피드백 제목과 내용을 모두 입력해주세요!');
        return;
    }

    try {
        const response = await fetch('/api/adminAction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'addFeedback',
                studentId: currentStudentId,
                feedbackTitle: title,
                feedbackText: text
            })
        });

        if (response.ok) {
            alert('피드백이 성공적으로 전송되었습니다!');
            titleInput.value = '';
            textInput.value = '';
            loadStudentDetail(currentStudentId); // 화면 새로고침
        } else {
            alert('피드백 전송에 실패했습니다.');
        }
    } catch (error) {
        console.error('피드백 전송 에러:', error);
        alert('네트워크 에러가 발생했습니다.');
    }
}

// ==========================================
// 💡 로그인 및 세션 관리 로직 (수정 완료!)
// ==========================================

async function handleLogin() {
    const id = document.getElementById('idInput').value.trim();
    const password = document.getElementById('passwordInput').value.trim();

    if (!id || !password) return alert('아이디와 비밀번호를 입력하세요.');

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, password })
        });
        const data = await response.json();

        if (response.ok) {
            // 💡 백엔드 응답 형태에 맞게 안전하게 유저 데이터 추출
            const userData = data.user ? data.user : data; 
            
            localStorage.setItem('session', JSON.stringify(userData));
            checkSession();
        } else {
            alert('로그인 실패: ' + (data.message || data.error || '알 수 없는 오류'));
        }
    } catch (error) {
        console.error('로그인 에러:', error);
        alert('서버와 통신 중 문제가 발생했습니다.');
    }
}

function handleLogout() {
    localStorage.removeItem('session');
    checkSession();
}

function checkSession() {
    const sessionData = localStorage.getItem('session');
    if (sessionData) {
        currentUser = JSON.parse(sessionData);
        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('userInfo').classList.remove('hidden');
        
        // currentUser.name이 없으면 ID를 대신 표시하도록 안전장치 추가
        const displayName = currentUser.name || currentUser.id || '사용자';
        document.getElementById('userGreeting').textContent = `${displayName}님 환영합니다!`;

        if (currentUser.role === 'admin') {
            document.getElementById('teacherDashboard').classList.remove('hidden');
            document.getElementById('studentDashboard').classList.add('hidden');
            loadTeacherDashboard();
        } else {
            document.getElementById('studentDashboard').classList.remove('hidden');
            document.getElementById('teacherDashboard').classList.add('hidden');
            loadStudentDashboard();
        }
    } else {
        currentUser = null;
        document.getElementById('loginSection').classList.remove('hidden');
        document.getElementById('teacherDashboard').classList.add('hidden');
        document.getElementById('studentDashboard').classList.add('hidden');
        document.getElementById('userInfo').classList.add('hidden');
    }
}

// ==========================================
// 💡 대시보드 데이터 로드 로직
// ==========================================

// 선생님 대시보드 로드
async function loadTeacherDashboard() {
    try {
        const response = await fetch('/api/getStudents');
        const students = await response.json();
        const list = document.getElementById('studentList');
        list.innerHTML = '';

        if(students && students.length > 0) {
            students.forEach(student => {
                const li = document.createElement('li');
                li.textContent = `${student.name} (${student.login_id})`;
                li.style.cursor = 'pointer';
                li.addEventListener('click', () => {
                    currentStudentId = student.id;
                    document.getElementById('manageStudentTitle').textContent = `[${student.name}] 학생 상세 관리`;
                    document.getElementById('studentManagePanel').classList.remove('hidden');
                    loadStudentDetail(currentStudentId);
                });
                list.appendChild(li);
            });
        }
    } catch (error) {
        console.error('학생 목록 로드 에러:', error);
    }
}

// 특정 학생 상세 데이터 로드
async function loadStudentDetail(studentId) {
    try {
        const examRes = await fetch(`/api/getExams?studentId=${studentId}`);
        const exams = await examRes.json();
        const examList = document.getElementById('examListAdmin');
        if(exams && exams.length > 0) {
            examList.innerHTML = exams.map(e => `<li>${e.exam_title} : ${e.score}점</li>`).join('');
        } else {
            examList.innerHTML = '<li>아직 등록된 시험 결과가 없습니다.</li>';
        }

        const feedbackRes = await fetch(`/api/getFeedbacks?studentId=${studentId}`);
        const feedbacks = await feedbackRes.json();
        renderFeedbackList(feedbacks, document.getElementById('feedbackListAdmin'));

    } catch (error) {
        console.error('학생 상세정보 로드 에러:', error);
    }
}

// 학생 대시보드 로드
async function loadStudentDashboard() {
    try {
        const examRes = await fetch(`/api/getExams?studentId=${currentUser.id}`);
        const exams = await examRes.json();
        const myExamList = document.getElementById('myExamList');
        if(exams && exams.length > 0) {
            myExamList.innerHTML = exams.map(e => `<li>${e.exam_title} : ${e.score}점</li>`).join('');
        } else {
            myExamList.innerHTML = '<li>아직 등록된 시험 결과가 없습니다.</li>';
        }

        const feedbackRes = await fetch(`/api/getFeedbacks?studentId=${currentUser.id}`);
        const feedbacks = await feedbackRes.json();
        renderFeedbackList(feedbacks, document.getElementById('myFeedbackList'));

    } catch (error) {
        console.error('학생 대시보드 로드 에러:', error);
    }
}

// 기타 유지용 함수들
async function handleCreateStudent() { /* API 호출 로직 */ }
async function handleUploadExam() { /* API 호출 로직 */ }
async function handleDeleteStudent() { /* API 호출 로직 */ }
async function handleAskQuestion() { /* API 호출 로직 */ }
async function handleChangePassword() { /* API 호출 로직 */ }
