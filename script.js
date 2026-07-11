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

// 💡 [UI 개선 핵심] 질문 리스트 렌더러 (선생님 답변 입력 폼 완전 개편)
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
        li.style.marginBottom = '20px'; // 여백 확장
        li.style.listStyle = 'none';
        
        const dateStr = q.created_at ? new Date(q.created_at).toLocaleDateString() : '날짜 없음';
        
        // 이미지 엑스박스 방어 로직
        let imgTag = q.question_image_url && q.question_image_url !== 'null' && q.question_image_url.trim() !== ''
            ? `<img src="${q.question_image_url}" alt="질문 이미지" onerror="this.style.display='none';" style="max-width:100%; border-radius:6px; margin-top:10px; display:block; border: 1px solid #e2e8f0;">` 
            : '';
        
        let htmlContent = `
            <div class="question-box" style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px;">
                <p style="margin: 0; color: #1e293b;"><strong>🙋‍♂️ 질문:</strong> ${q.question_text || '내용 없음'}</p>
                ${imgTag}
                <div style="text-align: right; font-size: 0.8em; color: #94a3b8; margin-top: 8px;">${dateStr}</div>
            </div>
            <div style="height: 10px;"></div>
        `;

        if (q.answer_text) {
            let ansImgTag = q.answer_image_url && q.answer_image_url !== 'null' && q.answer_image_url.trim() !== ''
                ? `<img src="${q.answer_image_url}" alt="답변 이미지" onerror="this.style.display='none';" style="max-width:100%; border-radius:6px; margin-top:10px; display:block; border: 1px solid #cbd5e1;">` 
                : '';
            htmlContent += `
                <div class="answer-box" style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; border-radius: 4px; margin-left: 15px; border: 1px solid #dcfce7; border-left-width: 4px;">
                    <p style="margin: 0; color: #166534;"><strong>👨‍🏫 선생님 답변:</strong> ${q.answer_text}</p>
                    ${ansImgTag}
                </div>
            `;
        } else {
            htmlContent += `
                <div style="margin-left: 15px; padding: 10px; background: #fffcf2; border: 1px dashed #fef08a; border-radius: 4px;">
                    <p style="font-size:0.85em; color:#ca8a04; margin:0; font-style: italic;">💡 아직 등록된 답변이 없습니다.</p>
                </div>
            `;
        }

        li.innerHTML = htmlContent;

        // 💡 [여기가 중요!] 선생님 계정 접속 시, 답변 안 달린 질문에 나타나는 입력 폼 UI 대폭 개선
        if (isAdmin && !q.answer_text) {
            const adminForm = document.createElement('div');
            adminForm.style.marginTop = '15px';
            adminForm.style.marginLeft = '15px';
            adminForm.style.padding = '15px';
            adminForm.style.background = '#ffffff';
            adminForm.style.borderRadius = '8px';
            adminForm.style.border = '1px solid #e2e8f0';
            adminForm.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
            
            // 입력 상자(textarea)를 넓게 배치하고, 하단 컨트롤 패널을 Flex로 깔끔하게 정리
            adminForm.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <textarea id="ansText_${q.id}" placeholder="여기에 답변 및 풀이 내용을 편하게 입력하세요..." 
                              style="width: 100%; min-height: 80px; padding: 12px; border-radius: 6px; border: 1px solid #cbd5e1; resize: vertical; font-size: 0.95rem; font-family: inherit; box-sizing: border-box; outline: none;" 
                              onfocus="this.style.borderColor='#22c55e'; this.style.boxShadow='0 0 0 2px rgba(34, 197, 94, 0.2)';" 
                              onblur="this.style.borderColor='#cbd5e1'; this.style.boxShadow='none';"></textarea>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <input type="file" id="ansImg_${q.id}" accept="image/*" 
                               style="font-size: 0.85rem; color: #475569; max-width: 200px; padding: 4px 0;">
                        
                        <button id="ansBtn_${q.id}" 
                                style="background: #22c55e; color: white; padding: 10px 20px; font-weight: bold; border-radius: 6px; border: none; cursor: pointer; font-size: 0.95rem; transition: background 0.2s;"
                                onmouseover="this.style.background='#16a34a'"
                                onmouseout="this.style.background='#22c55e'">
                            답변 등록하기
                        </button>
                    </div>
                </div>
            `;
            
            adminForm.querySelector(`#ansBtn_${q.id}`).addEventListener('click', () => {
                handleAnswerQuestion(q.id);
            });
            
            li.appendChild(adminForm);
        }

        containerElement.appendChild(li);
    });
}

// 💡 [요청 사항 반영] 둥근 회색 아코디언 테두리 형식을 살린 시험 목록
function renderAdminExamList(exams, containerElement) {
    containerElement.innerHTML = '';
    if (exams.length === 0) {
        containerElement.innerHTML = '<li style="text-align:center; color:#888;">아직 등록된 시험 결과가 없습니다.</li>';
        return;
    }
    
    exams.forEach(e => {
        const li = document.createElement('li');
        
        const titleBtn = document.createElement('button');
        titleBtn.className = 'feedback-title-btn'; 
        titleBtn.innerHTML = `📝 ${e.exam_title} : <strong>${e.score}점</strong> <span style="font-size: 0.8em; color: #888; font-weight: normal;">(클릭)</span>`;

        const detailDiv = document.createElement('div');
        detailDiv.className = 'feedback-detail'; 

        const imgUrl = e.paper_image_url || e.image_url || e.exam_image_url;
        const hasImg = imgUrl && imgUrl !== 'null' && imgUrl.trim() !== '';

        detailDiv.innerHTML = hasImg 
            ? `<div style="text-align: center; padding: 10px 0;">
                   <img src="${imgUrl}" alt="시험지 원본" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" style="max-width:100%; border-radius:4px; margin-top:10px; display:block; margin: 0 auto; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                   <p style="display:none; color:#ef4444; font-size:0.9em; margin-top:10px;">⚠️ 이미지를 불러올 수 없습니다. (삭제되었거나 파일 오류)</p>
               </div>`
            : `<p style="font-size:0.9em; color:#999; margin-top:10px;">등록된 시험지 사진이 없습니다.</p>`;

        titleBtn.addEventListener('click', () => detailDiv.classList.toggle('show'));

        li.appendChild(titleBtn);
        li.appendChild(detailDiv);
        containerElement.appendChild(li);
    });
}

function renderStudentExamList(exams, containerElement) {
    containerElement.innerHTML = '';
    if (exams.length === 0) {
        containerElement.innerHTML = '<li style="text-align:center; color:#888;">아직 등록된 시험 결과가 없습니다.</li>';
        return;
    }
    
    exams.forEach(e => {
        const li = document.createElement('li');
        
        const titleBtn = document.createElement('button');
        titleBtn.className = 'feedback-title-btn'; 
        titleBtn.innerHTML = `📈 ${e.exam_title} : <strong>${e.score}점</strong> <span style="font-size: 0.8em; color: #888; font-weight: normal;">(클릭)</span>`;

        const detailDiv = document.createElement('div');
        detailDiv.className = 'feedback-detail'; 

        const imgUrl = e.paper_image_url || e.image_url || e.exam_image_url;
        const hasImg = imgUrl && imgUrl !== 'null' && imgUrl.trim() !== '';

        detailDiv.innerHTML = hasImg 
            ? `<div style="text-align: center; padding: 10px 0;">
                   <img src="${imgUrl}" alt="시험지 원본" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" style="max-width:100%; border-radius:4px; margin-top:10px; display:block; margin: 0 auto; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                   <p style="display:none; color:#ef4444; font-size:0.9em; margin-top:10px;">⚠️ 이미지를 불러올 수 없습니다. (삭제되었거나 파일 오류)</p>
               </div>`
            : `<p style="font-size:0.9em; color:#999; margin-top:10px;">등록된 시험지 사진이 없습니다.</p>`;

        titleBtn.addEventListener('click', () => detailDiv.classList.toggle('show'));

        li.appendChild(titleBtn);
        li.appendChild(detailDiv);
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
        const examResponse = await fetch(`/api/getExams?studentId=${studentId}&student_id=${studentId}`);
        const examRawData = await examResponse.json();
        const exams = extractDataArray(examRawData);
        renderAdminExamList(exams, document.getElementById('examListAdmin'));

        const questionResponse = await fetch(`/api/getQuestions?studentId=${studentId}&student_id=${studentId}`);
        const questionRawData = await questionResponse.json();
        renderQuestionList(questionRawData, document.getElementById('questionListAdmin'), true);

        const feedbackResponse = await fetch(`/api/getFeedbacks?studentId=${studentId}&student_id=${studentId}`);
        const feedbackRawData = await feedbackResponse.json();
        renderFeedbackList(feedbackRawData, document.getElementById('feedbackListAdmin'));
    } catch (error) { 
        console.error('학생 상세정보 로드 에러:', error); 
    }
}

async function loadStudentDashboard() {
    try {
        const examResponse = await fetch(`/api/getExams?studentId=${currentUser.id}&student_id=${currentUser.id}`);
        const examRawData = await examResponse.json();
        const exams = extractDataArray(examRawData);
        renderStudentExamList(exams, document.getElementById('myExamList'));

        const questionResponse = await fetch(`/api/getQuestions?studentId=${currentUser.id}&student_id=${currentUser.id}`);
        const questionRawData = await questionResponse.json();
        renderQuestionList(questionRawData, document.getElementById('myQuestionList'), false);

        const feedbackResponse = await fetch(`/api/getFeedbacks?studentId=${currentUser.id}&student_id=${currentUser.id}`);
        const feedbackRawData = await feedbackResponse.json();
        renderFeedbackList(feedbackRawData, document.getElementById('myFeedbackList'));
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
