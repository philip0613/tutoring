// ==========================================
// 💡 전역 상태 관리 변수
// ==========================================
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
// 💡 유틸리티 및 이미지 압축 함수
// ==========================================

function extractDataArray(responseData) {
    if (!responseData) return [];
    if (Array.isArray(responseData)) return responseData; 
    if (responseData.data && Array.isArray(responseData.data)) return responseData.data; 
    for (const key in responseData) {
        if (Array.isArray(responseData[key])) return responseData[key];
    }
    return []; 
}

function processAndResizeImage(file) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/') || file.size <= 1.5 * 1024 * 1024) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                const MAX_WIDTH = 1280;
                const MAX_HEIGHT = 1280;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            };
        };
        reader.onerror = error => reject(error);
    });
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// 💡 [신규 추가] 시험지 이미지를 새 창/탭으로 안전하게 띄워주는 함수
function openExamPaper(imageUrl) {
    if (!imageUrl) {
        alert("이 시험은 등록된 시험지 이미지가 없습니다.");
        return;
    }
    // 새 탭에서 이미지 오픈
    const newWindow = window.open();
    newWindow.document.write(`
        <html lang="ko">
        <head>
            <title>시험지 보기</title>
            <style>
                body { margin: 0; background: #000; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                img { max-width: 100%; height: auto; box-shadow: 0 0 20px rgba(255,255,255,0.2); }
            </style>
        </head>
        <body>
            <img src="${imageUrl}" alt="시험지 원본">
        </body>
        </html>
    `);
}

// ==========================================
// 💡 화면 그리기(렌더링) 함수 모음
// ==========================================

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

function renderQuestionList(questionsRaw, containerElement, isAdmin = false) {
    containerElement.innerHTML = '';
    const questions = extractDataArray(questionsRaw);

    if (questions.length === 0) {
        containerElement.innerHTML = '<li style="text-align:center; color:#888;">아직 등록된 질문이 없습니다.</li>';
        return;
    }

    questions.forEach(q => {
        const li = document.createElement('li');
        li.style.position = 'relative';
        li.style.marginBottom = '15px';
        
        const dateStr = q.created_at ? new Date(q.created_at).toLocaleDateString() : '날짜 없음';
        let imgTag = q.question_image_url ? `<img src="${q.question_image_url}" alt="질문 이미지" style="max-width:100%; border-radius:4px; margin-top:10px; display:block;">` : '';
        
        let htmlContent = `
            <div class="question-box">
                <p><strong>🙋‍♂️ 질문:</strong> ${q.question_text || '내용 없음'}</p>
                ${imgTag}
                <div style="text-align: right; font-size: 0.8em; color: #aaa; margin-top: 5px;">${dateStr}</div>
            </div>
            <hr style="border: 0; border-top: 1px dashed #eee; margin: 10px 0;">
        `;

        if (q.answer_text) {
            let ansImgTag = q.answer_image_url ? `<img src="${q.answer_image_url}" alt="답변 이미지" style="max-width:100%; border-radius:4px; margin-top:10px; display:block;">` : '';
            htmlContent += `
                <div class="answer-box" style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 10px; border-radius: 4px; margin-top: 5px;">
                    <p><strong>👨‍🏫 선생님 답변:</strong> ${q.answer_text}</p>
                    ${ansImgTag}
                </div>
            `;
        } else {
            htmlContent += `<p style="font-size:0.9em; color:#999; font-style: italic;">💡 아직 등록된 답변이 없습니다.</p>`;
        }

        li.innerHTML = htmlContent;

        if (isAdmin && !q.answer_text) {
            const adminForm = document.createElement('div');
            adminForm.style.marginTop = '10px';
            adminForm.innerHTML = `
                <input type="text" id="ansText_${q.id}" placeholder="이 질문에 대한 답변을 입력하세요" style="width:70%; padding:8px; font-size:0.9rem;">
                <input type="file" id="ansImg_${q.id}" accept="image/*" style="width:25%; font-size:0.8rem; display:inline-block; margin-top:0;">
                <button id="ansBtn_${q.id}" class="small-btn" style="background:#22c55e; margin-top:5px; width:100%;">답변 등록하기</button>
            `;
            
            adminForm.querySelector(`#ansBtn_${q.id}`).addEventListener('click', () => {
                handleAnswerQuestion(q.id);
            });
            
            li.appendChild(adminForm);
        }

        containerElement.appendChild(li);
    });
}

// 💡 [완벽 복구] 관리자용 쪽지시험 내역 그리기 (클릭 시 이미지 오픈 연결)
function renderAdminExamList(exams, containerElement) {
    containerElement.innerHTML = '';
    if (exams.length === 0) {
        containerElement.innerHTML = '<li>아직 등록된 시험 결과가 없습니다.</li>';
        return;
    }
    
    exams.forEach(e => {
        const li = document.createElement('li');
        li.innerHTML = `📝 ${e.exam_title} : <strong style="color:#0284c7; cursor:pointer; text-decoration:underline;">${e.score}점</strong> <span style="font-size:0.8em; color:#888;">(클릭 시 시험지 보기)</span>`;
        // 점수 클릭 시 등록된 이미지 오픈
        li.querySelector('strong').addEventListener('click', () => openExamPaper(e.paper_image_url));
        containerElement.appendChild(li);
    });
}

// 💡 [완벽 복구] 학생용 본인 쪽지시험 내역 그리기 (클릭 시 이미지 오픈 연결)
function renderStudentExamList(exams, containerElement) {
    containerElement.innerHTML = '';
    if (exams.length === 0) {
        containerElement.innerHTML = '<li>아직 등록된 시험 결과가 없습니다.</li>';
        return;
    }
    
    exams.forEach(e => {
        const li = document.createElement('li');
        li.innerHTML = `📈 ${e.exam_title} : <strong style="color:#22c55e; cursor:pointer; text-decoration:underline;">${e.score}점</strong> <span style="font-size:0.8em; color:#888;">(클릭 시 시험지 보기)</span>`;
        // 점수 클릭 시 등록된 이미지 오픈
        li.querySelector('strong').addEventListener('click', () => openExamPaper(e.paper_image_url));
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
            list.innerHTML = '<li style="text-align:center; color:#888;">등록된 학생이 없습니다.</li>';
        }
    } catch (error) {
        console.error('학생 목록 로드 에러:', error);
    }
}

async function loadStudentDetail(studentId) {
    try {
        // 1. 쪽지시험 리스트 조회 및 렌더링 함수 적용
        const examRes = await fetch(`/api/getExams?studentId=${studentId}&student_id=${studentId}`);
        const exams = extractDataArray(await examRes.json());
        renderAdminExamList(exams, document.getElementById('examListAdmin'));

        // 2. 질문 내역 조회
        const questionRes = await fetch(`/api/getQuestions?studentId=${studentId}&student_id=${studentId}`);
        renderQuestionList(await questionRes.json(), document.getElementById('questionListAdmin'), true);

        // 3. 피드백 내역 조회
        const feedbackRes = await fetch(`/api/getFeedbacks?studentId=${studentId}&student_id=${studentId}`);
        renderFeedbackList(await feedbackRes.json(), document.getElementById('feedbackListAdmin'));

    } catch (error) {
        console.error('학생 상세정보 로드 에러:', error);
    }
}

async function loadStudentDashboard() {
    try {
        // 1. 본인 시험 결과 조회 및 렌더링 함수 적용
        const examRes = await fetch(`/api/getExams?studentId=${currentUser.id}&student_id=${currentUser.id}`);
        const exams = extractDataArray(await examRes.json());
        renderStudentExamList(exams, document.getElementById('myExamList'));

        // 2. 본인 질문 내역 조회
        const questionRes = await fetch(`/api/getQuestions?studentId=${currentUser.id}&student_id=${currentUser.id}`);
        renderQuestionList(await questionRes.json(), document.getElementById('myQuestionList'), false);

        // 3. 선생님 한마디(피드백) 조회
        const feedbackRes = await fetch(`/api/getFeedbacks?studentId=${currentUser.id}&student_id=${currentUser.id}`);
        renderFeedbackList(await feedbackRes.json(), document.getElementById('myFeedbackList'));

    } catch (error) {
        console.error('학생 대시보드 로드 에러:', error);
    }
}

// ==========================================
// 💡 로그인 및 세션 관리 로직
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
            alert('로그인 실패: ' + (data.message || data.error || '오류 발생'));
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
// 💡 관리자(선생님) 전용 API 통신 함수 모음
// ==========================================

async function handleAnswerQuestion(questionId) {
    const textInput = document.getElementById(`ansText_${questionId}`);
    const fileInput = document.getElementById(`ansImg_${questionId}`);
    const text = textInput.value.trim();

    if (!text) return alert('답변 내용을 입력해주세요.');

    const btn = document.getElementById(`ansBtn_${questionId}`);
    btn.innerText = "답변 등록 중... ⏳";
    btn.disabled = true;

    try {
        let image_base64 = null;
        let image_name = null;

        if (fileInput.files && fileInput.files.length > 0) {
            image_name = fileInput.files[0].name;
            image_base64 = await processAndResizeImage(fileInput.files[0]);
        }

        const res = await fetch('/api/answerQuestion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                questionId: questionId,
                id: questionId, 
                answer_text: text,
                answerText: text,
                image_base64: image_base64,
                image_name: image_name
            })
        });

        if (res.ok) {
            alert('✅ 답변이 성공적으로 등록되었습니다!');
            loadStudentDetail(currentStudentId); 
        } else {
            const err = await res.json().catch(() => ({}));
            alert('답변 등록 실패: ' + (err.error || err.message || '서버 오류'));
        }
    } catch (err) {
        alert('에러 발생: ' + err.message);
    } finally {
        btn.innerText = "답변 등록하기";
        btn.disabled = false;
    }
}

async function handleCreateStudent() {
    const nameInput = document.getElementById('newStudentName');
    const idInput = document.getElementById('newStudentId');
    const name = nameInput.value.trim();
    const loginId = idInput.value.trim();

    if (!name || !loginId) return alert('학생 이름과 아이디를 모두 입력하세요.');

    const btn = document.getElementById('createStudentBtn');
    btn.disabled = true;

    try {
        const res = await fetch('/api/createStudent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name: name, 
                studentName: name,
                login_id: loginId,
                loginId: loginId,
                id: loginId,
                userId: loginId
            })
        });
        if (res.ok) {
            alert('✅ 학생 계정 생성 완료! (기본 비밀번호: 123456)');
            nameInput.value = ''; 
            idInput.value = '';
            loadTeacherDashboard();
        } else {
            const err = await res.json().catch(() => ({}));
            alert('학생 생성 실패: ' + (err.error || err.message || '오류'));
        }
    } catch (err) { alert('에러 발생: ' + err.message); } 
    finally { btn.disabled = false; }
}

async function handleUploadExam() {
    if (!currentStudentId) return alert("먼저 학생을 선택해주세요!");
    const titleInput = document.getElementById("examTitle");
    const scoreInput = document.getElementById("examScore");
    const fileInput = document.getElementById("examImage");
    const title = titleInput.value.trim();
    const score = scoreInput.value;
    
    if (!title || !score) return alert("시험명과 점수를 모두 입력하세요.");
    const btn = document.getElementById("uploadExamBtn");
    btn.innerText = "업로드 중... ⏳"; btn.disabled = true;
    
    try {
        let image_base64 = null; let image_name = null;
        if (fileInput.files.length > 0) {
            image_name = fileInput.files[0].name;
            image_base64 = await processAndResizeImage(fileInput.files[0]);
        }
        const res = await fetch('/api/uploadExam', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id: currentStudentId, exam_title: title, score: parseInt(score), image_base64: image_base64, image_name: image_name })
        });
        if (res.ok) {
            alert("✅ 시험 점수 저장 완료!");
            titleInput.value = ""; scoreInput.value = ""; fileInput.value = "";
            loadStudentDetail(currentStudentId); 
        } else { alert('시험 점수 저장 실패'); }
    } catch (err) { alert("저장 실패: " + err.message); } 
    finally { btn.innerText = "시험지 업로드 및 저장"; btn.disabled = false; }
}

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
            body: JSON.stringify({ action: 'addFeedback', studentId: currentStudentId, feedbackTitle: title, feedbackText: text })
        });
        if (response.ok) {
            alert('✅ 피드백이 성공적으로 전송되었습니다!');
            titleInput.value = ''; textInput.value = '';
            loadStudentDetail(currentStudentId); 
        } else { alert('피드백 전송 실패'); }
    } catch (error) { console.error('피드백 전송 에러:', error); }
}

async function handleDeleteStudent() {
    if (!currentStudentId) return;
    if (!confirm('🚨 정말 이 학생의 모든 데이터를 삭제하시겠습니까? (복구 불가능)')) return;

    try {
        const res = await fetch('/api/adminAction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'deleteStudent', student_id: currentStudentId, studentId: currentStudentId }) 
        });
        if (res.ok) {
            alert('✅ 학생 계정 및 데이터 삭제 완료');
            document.getElementById('studentManagePanel').classList.add('hidden');
            currentStudentId = null;
            loadTeacherDashboard(); 
        } else { alert('학생 삭제 처리 중 에러 발생'); }
    } catch (err) { alert('에러 발생: ' + err.message); }
}

// ==========================================
// 💡 학생 전용 API 통신 함수 모음
// ==========================================

async function handleAskQuestion() {
    const textInput = document.getElementById('questionText');
    const fileInput = document.getElementById('questionImage');
    const text = textInput.value.trim();
    
    if (!text) return alert('질문 내용을 입력해주세요.');
    const btn = document.getElementById('askQuestionBtn');
    btn.innerText = "이미지 압축 및 업로드 중... ⏳"; btn.disabled = true;

    try {
        let image_base64 = null; 
        let image_name = "captured_image.jpg"; 
        
        if (fileInput.files && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            if (file.name) image_name = file.name;
            image_base64 = await processAndResizeImage(file);
        }

        const userId = currentUser.id || currentUser.student_id || currentUser.login_id;

        const res = await fetch('/api/askQuestion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                student_id: userId,
                studentId: userId,
                id: userId,
                userId: userId,
                question_text: text,
                questionText: text,
                image_base64: image_base64,
                image_name: image_name
            })
        });

        if (res.ok) {
            alert('✅ 질문이 성공적으로 등록되었습니다!');
            textInput.value = ''; fileInput.value = '';
            loadStudentDashboard(); 
        } else {
            const errData = await res.json().catch(() => ({}));
            alert('질문 등록 실패: ' + (errData.error || errData.message || '서버 오류'));
        }
    } catch (err) { alert('브라우저 하드웨어 제어 에러: ' + err.message); } 
    finally { btn.innerText = "질문 올리기"; btn.disabled = false; }
}

async function handleChangePassword() {
    const passwordInput = document.getElementById('newPassword');
    const newPw = passwordInput.value.trim();
    if (!newPw || newPw.length < 6) return alert('비밀번호는 최소 6자리 이상이어야 합니다.');

    try {
        const res = await fetch('/api/changePassword', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, newPassword: newPw })
        });
        if (res.ok) {
            alert('✅ 비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요!');
            passwordInput.value = '';
            handleLogout(); 
        } else { alert('비밀번호 변경 처리 실패'); }
    } catch (err) { alert('에러 발생: ' + err.message); }
}
