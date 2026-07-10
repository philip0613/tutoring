// ==========================================
// 💡 전역 상태 관리 변수
// ==========================================
let currentUser = null; 
let currentStudentId = null; 

document.addEventListener('DOMContentLoaded', () => {
    checkSession(); 

    // 1. 공통 및 로그인 이벤트
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // 2. 선생님(Admin) 대시보드 이벤트
    document.getElementById('createStudentBtn').addEventListener('click', handleCreateStudent);
    document.getElementById('uploadExamBtn').addEventListener('click', handleUploadExam);
    document.getElementById('sendFeedbackBtn').addEventListener('click', handleSendFeedback);
    document.getElementById('deleteStudentBtn').addEventListener('click', handleDeleteStudent);

    // 3. 학생(Student) 대시보드 이벤트
    document.getElementById('askQuestionBtn').addEventListener('click', handleAskQuestion);
    document.getElementById('togglePasswordBtn').addEventListener('click', () => {
        document.getElementById('passwordFormContainer').classList.toggle('hidden-form');
    });
    document.getElementById('changePasswordBtn').addEventListener('click', handleChangePassword);
});

// ==========================================
// 💡 유틸리티 함수 (마법의 도구들)
// ==========================================

// 1. 백엔드 데이터 껍데기 까기 (어떤 형태로 오든 배열 알맹이만 빼냄)
function extractDataArray(responseData) {
    if (!responseData) return [];
    if (Array.isArray(responseData)) return responseData; 
    if (responseData.data && Array.isArray(responseData.data)) return responseData.data; 
    for (const key in responseData) {
        if (Array.isArray(responseData[key])) return responseData[key];
    }
    return []; 
}

// 2. 파일(이미지)을 텍스트(Base64)로 변환해서 서버로 보내기 좋게 만드는 함수
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// ==========================================
// 💡 화면 그리기(렌더링) 함수 모음
// ==========================================

// 피드백 리스트 그리기 (아코디언 토글 적용)
function renderFeedbackList(feedbacksRaw, containerElement) {
    containerElement.innerHTML = ''; 
    const feedbacks = extractDataArray(feedbacksRaw);

    if (feedbacks.length === 0) {
        containerElement.innerHTML = '<li style="text-align:center; color:#888;">아직 등록된 피드백이 없습니다.</li>';
        return;
    }

    feedbacks.forEach(fb => {
        const li = document.createElement('li');
        const titleBtn = document.createElement('button');
        titleBtn.className = 'feedback-title-btn';
        
        const displayTitle = fb.feedback_title ? fb.feedback_title : '제목 없는 피드백'; 
        titleBtn.innerHTML = `📌 ${displayTitle} <span style="font-size: 0.8em; color: #888; font-weight: normal;">(클릭)</span>`;

        const detailDiv = document.createElement('div');
        detailDiv.className = 'feedback-detail';
        const dateStr = fb.created_at ? new Date(fb.created_at).toLocaleDateString() : '날짜 없음';
        
        detailDiv.innerHTML = `
            <p>${fb.feedback_text || '내용이 없습니다.'}</p>
            <div style="text-align: right; margin-top: 10px; font-size: 0.8em; color: #aaa;">${dateStr}</div>
        `;

        titleBtn.addEventListener('click', () => detailDiv.classList.toggle('show'));

        li.appendChild(titleBtn);
        li.appendChild(detailDiv);
        containerElement.appendChild(li);
    });
}

// 질문 리스트 그리기
function renderQuestionList(questionsRaw, containerElement) {
    containerElement.innerHTML = '';
    const questions = extractDataArray(questionsRaw);

    if (questions.length === 0) {
        containerElement.innerHTML = '<li style="text-align:center; color:#888;">아직 등록된 질문이 없습니다.</li>';
        return;
    }

    questions.forEach(q => {
        const li = document.createElement('li');
        const dateStr = q.created_at ? new Date(q.created_at).toLocaleDateString() : '';
        li.innerHTML = `
            <p><strong>🙋‍♂️ 질문:</strong> ${q.question_text || '내용 없음'}</p>
            <div style="text-align: right; margin-top: 5px; font-size: 0.8em; color: #aaa;">${dateStr}</div>
        `;
        containerElement.appendChild(li);
    });
}

// ==========================================
// 💡 대시보드 데이터 로드 로직
// ==========================================

async function loadTeacherDashboard() {
    try {
        const response = await fetch('/api/getStudents');
        const rawData = await response.json();
        const students = extractDataArray(rawData);

        const list = document.getElementById('studentList');
        list.innerHTML = '';

        if(students.length > 0) {
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
        } else {
            list.innerHTML = '<li>등록된 학생이 없습니다.</li>';
        }
    } catch (error) {
        console.error('학생 목록 로드 에러:', error);
    }
}

async function loadStudentDetail(studentId) {
    try {
        // 1. 시험 점수 로드
        const examRes = await fetch(`/api/getExams?studentId=${studentId}&student_id=${studentId}`);
        const exams = extractDataArray(await examRes.json());
        const examList = document.getElementById('examListAdmin');
        if(exams.length > 0) {
            examList.innerHTML = exams.map(e => `<li>${e.exam_title} : ${e.score}점</li>`).join('');
        } else {
            examList.innerHTML = '<li>아직 등록된 시험 결과가 없습니다.</li>';
        }

        // 2. 질문 내역 로드
        const questionRes = await fetch(`/api/getQuestions?studentId=${studentId}&student_id=${studentId}`);
        renderQuestionList(await questionRes.json(), document.getElementById('questionListAdmin'));

        // 3. 피드백 내역 로드
        const feedbackRes = await fetch(`/api/getFeedbacks?studentId=${studentId}&student_id=${studentId}`);
        renderFeedbackList(await feedbackRes.json(), document.getElementById('feedbackListAdmin'));

    } catch (error) {
        console.error('학생 상세정보 로드 에러:', error);
    }
}

async function loadStudentDashboard() {
    try {
        // 1. 내 시험 점수 로드
        const examRes = await fetch(`/api/getExams?studentId=${currentUser.id}&student_id=${currentUser.id}`);
        const exams = extractDataArray(await examRes.json());
        const myExamList = document.getElementById('myExamList');
        if(exams.length > 0) {
            myExamList.innerHTML = exams.map(e => `<li>${e.exam_title} : ${e.score}점</li>`).join('');
        } else {
            myExamList.innerHTML = '<li>아직 등록된 시험 결과가 없습니다.</li>';
        }

        // 2. 내 질문 내역 로드
        const questionRes = await fetch(`/api/getQuestions?studentId=${currentUser.id}&student_id=${currentUser.id}`);
        renderQuestionList(await questionRes.json(), document.getElementById('myQuestionList'));

        // 3. 내 피드백 내역 로드
        const feedbackRes = await fetch(`/api/getFeedbacks?studentId=${currentUser.id}&student_id=${currentUser.id}`);
        renderFeedbackList(await feedbackRes.json(), document.getElementById('myFeedbackList'));

    } catch (error) {
        console.error('학생 대시보드 로드 에러:', error);
    }
}

// ==========================================
// 💡 로그인 및 세션 유지 로직
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
            const userData = { ...(data.user || {}), ...data }; 
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
// 💡 [핵심 복구 완료] 관리자(선생님) 액션 함수 모음
// ==========================================

// 1. 학생 계정 생성
async function handleCreateStudent() {
    const name = document.getElementById('newStudentName').value.trim();
    const loginId = document.getElementById('newStudentId').value.trim();
    if (!name || !loginId) return alert('학생 이름과 아이디를 모두 입력하세요.');

    const btn = document.getElementById('createStudentBtn');
    btn.disabled = true;

    try {
        const res = await fetch('/api/createStudent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, login_id: loginId })
        });
        if (res.ok) {
            alert('✅ 학생 계정 생성 완료! (기본 비밀번호: 123456)');
            document.getElementById('newStudentName').value = '';
            document.getElementById('newStudentId').value = '';
            loadTeacherDashboard();
        } else {
            alert('학생 생성 실패 (서버 오류)');
        }
    } catch (err) { alert('에러 발생: ' + err.message); }
    finally { btn.disabled = false; }
}

// 2. 시험 점수 및 사진 업로드 (Base64)
async function handleUploadExam() {
    if (!currentStudentId) return alert("먼저 학생을 선택해주세요!");
    
    const title = document.getElementById("examTitle").value.trim();
    const score = document.getElementById("examScore").value;
    const fileInput = document.getElementById("examImage");
    
    if (!title || !score) return alert("시험명과 점수를 모두 입력하세요.");
    
    const btn = document.getElementById("uploadExamBtn");
    btn.innerText = "업로드 중... ⏳"; btn.disabled = true;
    
    try {
        let image_base64 = null; 
        let image_name = null;
        if (fileInput.files.length > 0) {
            image_base64 = await fileToBase64(fileInput.files[0]);
            image_name = fileInput.files[0].name;
        }
        
        const res = await fetch('/api/uploadExam', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                student_id: currentStudentId, 
                exam_title: title, 
                score: parseInt(score), 
                image_base64: image_base64, 
                image_name: image_name 
            })
        });

        if (res.ok) {
            alert("✅ 시험 점수 저장 완료!");
            document.getElementById("examTitle").value = "";
            document.getElementById("examScore").value = "";
            fileInput.value = "";
            loadStudentDetail(currentStudentId); 
        } else {
            alert('시험 저장 실패');
        }
    } catch (err) { alert("저장 실패: " + err.message); } 
    finally { btn.innerText = "시험지 업로드 및 저장"; btn.disabled = false; }
}

// 3. 개별 피드백 전송
async function handleSendFeedback() {
    const titleInput = document.getElementById('feedbackTitleAdmin');
    const textInput = document.getElementById('feedbackTextAdmin');
    const title = titleInput.value.trim();
    const text = textInput.value.trim();

    if (!title || !text) return alert('피드백 제목과 내용을 모두 입력해주세요!');

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
            alert('✅ 피드백이 성공적으로 전송되었습니다!');
            titleInput.value = '';
            textInput.value = '';
            loadStudentDetail(currentStudentId); 
        } else {
            alert('피드백 전송 실패');
        }
    } catch (error) { console.error('피드백 전송 에러:', error); }
}

// 4. 학생 계정 완전 삭제
async function handleDeleteStudent() {
    if (!currentStudentId) return;
    if (!confirm('🚨 정말 이 학생의 모든 데이터를 삭제하시겠습니까? (복구 불가능)')) return;

    try {
        const res = await fetch('/api/adminAction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // 백엔드가 요구하는 변수명에 맞게 둘 다 보냄
            body: JSON.stringify({ action: 'deleteStudent', student_id: currentStudentId, studentId: currentStudentId }) 
        });
        
        if (res.ok) {
            alert('✅ 학생 계정 및 데이터 삭제 완료');
            document.getElementById('studentManagePanel').classList.add('hidden');
            currentStudentId = null;
            loadTeacherDashboard(); // 학생 목록 새로고침
        } else {
            alert('학생 삭제 실패');
        }
    } catch (err) { alert('에러 발생: ' + err.message); }
}

// ==========================================
// 💡 [핵심 복구 완료] 학생 액션 함수 모음
// ==========================================

// 1. 모르는 문제 질문 올리기 (Base64 이미지 포함)
async function handleAskQuestion() {
    const text = document.getElementById('questionText').value.trim();
    const fileInput = document.getElementById('questionImage');
    
    if (!text) return alert('질문 내용을 입력해주세요.');

    const btn = document.getElementById('askQuestionBtn');
    btn.innerText = "업로드 중... ⏳"; btn.disabled = true;

    try {
        let image_base64 = null; 
        let image_name = null;
        if (fileInput.files.length > 0) {
            image_base64 = await fileToBase64(fileInput.files[0]);
            image_name = fileInput.files[0].name;
        }

        const res = await fetch('/api/uploadQuestion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                student_id: currentUser.id,
                question_text: text,
                image_base64: image_base64,
                image_name: image_name
            })
        });

        if (res.ok) {
            alert('✅ 질문이 성공적으로 등록되었습니다!');
            document.getElementById('questionText').value = '';
            fileInput.value = '';
            loadStudentDashboard(); // 질문 목록 새로고침
        } else {
            alert('질문 등록 실패');
        }
    } catch (err) { alert('에러 발생: ' + err.message); }
    finally { btn.innerText = "질문 올리기"; btn.disabled = false; }
}

// 2. 비밀번호 변경하기
async function handleChangePassword() {
    const newPw = document.getElementById('newPassword').value.trim();
    if (!newPw || newPw.length < 6) return alert('비밀번호는 최소 6자리 이상이어야 합니다.');

    try {
        const res = await fetch('/api/changePassword', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, newPassword: newPw })
        });
        
        if (res.ok) {
            alert('✅ 비밀번호가 변경되었습니다. 다시 로그인해주세요!');
            document.getElementById('newPassword').value = '';
            handleLogout(); // 강제 로그아웃
        } else {
            alert('비밀번호 변경 실패');
        }
    } catch (err) { alert('에러 발생: ' + err.message); }
}
