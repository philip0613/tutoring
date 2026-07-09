let currentUser = null;
let selectedStudentId = null;

const loginSection = document.getElementById("loginSection");
const teacherDashboard = document.getElementById("teacherDashboard");
const studentDashboard = document.getElementById("studentDashboard");
const userInfo = document.getElementById("userInfo");
const userGreeting = document.getElementById("userGreeting");

const studentListUl = document.getElementById("studentList");
const myExamList = document.getElementById("myExamList");
const myQuestionList = document.getElementById("myQuestionList"); 
const questionListAdmin = document.getElementById("questionListAdmin"); 
const feedbackListAdmin = document.getElementById("feedbackListAdmin");
const myFeedbackList = document.getElementById("myFeedbackList");
const examListAdmin = document.getElementById("examListAdmin"); 

// 🌟 [통합됨] 하나의 만능 API(adminAction)로 수정/삭제 통신!
async function universalUpdate(table, id, updateData) {
    const res = await fetch('/api/adminAction', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', table, id, updateData })
    });
    if (!res.ok) throw new Error("수정 실패");
}

async function universalDelete(table, id) {
    const res = await fetch('/api/adminAction', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', table, id })
    });
    if (!res.ok) throw new Error("삭제 실패");
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

function createActionButtons(onEdit, onDelete) {
    const container = document.createElement("div");
    container.style.cssText = "display:inline-flex; gap:5px; margin-left:10px;";
    
    const editBtn = document.createElement("button");
    editBtn.innerText = "수정";
    editBtn.style.cssText = "padding:3px 8px; font-size:11px; background:#f39c12; color:white; border:none; border-radius:4px; cursor:pointer;";
    editBtn.onclick = (e) => { e.stopPropagation(); onEdit(); }; 

    const delBtn = document.createElement("button");
    delBtn.innerText = "삭제";
    delBtn.style.cssText = "padding:3px 8px; font-size:11px; background:#e74c3c; color:white; border:none; border-radius:4px; cursor:pointer;";
    delBtn.onclick = (e) => { e.stopPropagation(); onDelete(); };

    container.appendChild(editBtn);
    container.appendChild(delBtn);
    return container;
}

window.onload = () => {
    const savedUser = localStorage.getItem("tutor_user");
    if (savedUser) { currentUser = JSON.parse(savedUser); updateUI(); }
};

function updateUI() {
    if (!currentUser) {
        loginSection.classList.remove("hidden"); teacherDashboard.classList.add("hidden"); studentDashboard.classList.add("hidden"); userInfo.classList.add("hidden");
    } else {
        loginSection.classList.add("hidden"); userInfo.classList.remove("hidden"); userGreeting.innerText = `반갑습니다, ${currentUser.name}님!`;
        if (currentUser.role === "admin") {
            teacherDashboard.classList.remove("hidden"); studentDashboard.classList.add("hidden"); loadStudentList(); 
        } else {
            studentDashboard.classList.remove("hidden"); teacherDashboard.classList.add("hidden"); loadMyExams(); loadMyQuestions(); loadMyFeedbacks(); 
        }
    }
}

async function loadStudentList() {
    studentListUl.innerHTML = '<li class="placeholder-text">학생 목록을 불러오는 중... ⏳</li>';
    try {
        const res = await fetch('/api/getStudents'); const data = await res.json();
        studentListUl.innerHTML = "";
        if (data.length === 0) return studentListUl.innerHTML = '<li class="placeholder-text">등록된 학생이 없습니다.</li>';
        
        data.forEach(student => {
            const li = document.createElement("li");
            li.innerText = `👤 ${student.name} 학생`;
            li.addEventListener("click", () => {
                selectedStudentId = student.id; 
                document.getElementById("studentManagePanel").classList.remove("hidden");
                document.getElementById("manageStudentTitle").innerText = `📝 ${student.name} 학생 상세 관리`;
                loadStudentQuestionsAdmin(student.id);
                loadStudentFeedbacksAdmin(student.id); 
                loadStudentExamsAdmin(student.id); 
            });
            studentListUl.appendChild(li);
        });
    } catch (err) { studentListUl.innerHTML = `<li style="color:red;">에러: ${err.message}</li>`; }
}

async function loadStudentExamsAdmin(studentId) {
    examListAdmin.innerHTML = '<li class="placeholder-text">점수를 불러오는 중...</li>';
    try {
        const res = await fetch(`/api/getExams?student_id=${studentId}`); const data = await res.json();
        examListAdmin.innerHTML = "";
        if(data.length === 0) return examListAdmin.innerHTML = '<li class="placeholder-text">입력된 점수가 없습니다.</li>';
        
        data.forEach(exam => {
            const li = document.createElement("li");
            li.innerHTML = `<strong>${exam.exam_title}</strong>: ${exam.score}점`;
            
            const btnGroup = createActionButtons(
                async () => {
                    const newTitle = prompt("수정할 시험명을 입력하세요:", exam.exam_title);
                    if(newTitle === null) return;
                    const newScore = prompt("수정할 점수를 입력하세요:", exam.score);
                    if(newScore === null) return;
                    
                    try {
                        await universalUpdate('exams', exam.id, { exam_title: newTitle, score: parseInt(newScore) });
                        loadStudentExamsAdmin(studentId); 
                    } catch(e) { alert(e.message); }
                },
                async () => {
                    if(!confirm("정말 이 시험 점수를 삭제하시겠습니까?")) return;
                    try {
                        await universalDelete('exams', exam.id);
                        loadStudentExamsAdmin(studentId);
                    } catch(e) { alert(e.message); }
                }
            );
            li.appendChild(btnGroup);
            examListAdmin.appendChild(li);
        });
    } catch (err) { examListAdmin.innerHTML = `<li>에러: ${err.message}</li>`; }
}

async function loadStudentFeedbacksAdmin(studentId) {
    feedbackListAdmin.innerHTML = '<li class="placeholder-text">기록을 불러오는 중...</li>';
    try {
        const res = await fetch(`/api/getFeedbacks?student_id=${studentId}`); const data = await res.json();
        feedbackListAdmin.innerHTML = "";
        if(data.length === 0) return feedbackListAdmin.innerHTML = '<li class="placeholder-text">작성된 피드백이 없습니다.</li>';
        
        data.forEach(f => {
            const li = document.createElement("li");
            const date = new Date(f.created_at).toLocaleDateString();
            li.innerHTML = `<small style="color:#888;">[${date}]</small> ${f.feedback_text}`;
            
            const btnGroup = createActionButtons(
                async () => { 
                    const newText = prompt("피드백 내용을 수정하세요:", f.feedback_text);
                    if(newText && newText !== f.feedback_text) {
                        try {
                            await universalUpdate('feedbacks', f.id, { feedback_text: newText });
                            loadStudentFeedbacksAdmin(studentId);
                        } catch(e) { alert(e.message); }
                    }
                },
                async () => {
                    if(!confirm("이 피드백을 삭제하시겠습니까?")) return;
                    try {
                        await universalDelete('feedbacks', f.id);
                        loadStudentFeedbacksAdmin(studentId);
                    } catch(e) { alert(e.message); }
                }
            );
            li.appendChild(btnGroup);
            feedbackListAdmin.appendChild(li);
        });
    } catch (err) { feedbackListAdmin.innerHTML = `<li>에러: ${err.message}</li>`; }
}

document.getElementById("sendFeedbackBtn").addEventListener("click", async () => {
    if (!selectedStudentId) return alert("선택된 학생이 없습니다.");
    const text = document.getElementById("feedbackTextAdmin").value.trim();
    if (!text) return alert("피드백 내용을 입력해 주세요.");
    try {
        await fetch('/api/sendFeedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: selectedStudentId, feedback_text: text }) });
        alert("✅ 피드백 등록 완료!"); document.getElementById("feedbackTextAdmin").value = "";
        loadStudentFeedbacksAdmin(selectedStudentId); 
    } catch (err) { alert("등록 실패: " + err.message); }
});

async function loadStudentQuestionsAdmin(studentId) {
    questionListAdmin.innerHTML = '<li class="placeholder-text">질문 목록을 불러오는 중... ⏳</li>';
    try {
        const res = await fetch(`/api/getQuestions?student_id=${studentId}`); const data = await res.json();
        questionListAdmin.innerHTML = "";
        if (data.length === 0) return questionListAdmin.innerHTML = '<li class="placeholder-text">올라온 질문이 없습니다.</li>';
        
        data.forEach(q => {
            const li = document.createElement("li"); li.style.cursor = "pointer"; 
            const imgHtml = q.question_image_url ? `<div class="img-container hidden" style="margin-top:10px;"><img src="${q.question_image_url}" style="max-width:100%; max-height:250px; border-radius:8px;"></div>` : '';
            const ansImgHtml = q.answer_image_url ? `<div style="margin-top:10px;"><img src="${q.answer_image_url}" style="max-width:100%; max-height:250px; border-radius:8px;"></div>` : '';

            if (q.is_answered) {
                li.innerHTML = `<span style="color:green">[답변완료]</span> <strong>Q:</strong> ${q.question_text} ${imgHtml}
                    <div style="margin-top:8px; padding:8px; background:#e8f8f5; border-radius:5px;"><strong>👨‍🏫 내 답변:</strong> ${q.answer_text} ${ansImgHtml}</div>`;
            } else {
                li.innerHTML = `<span style="color:red">[답변대기]</span> <strong>Q:</strong> ${q.question_text} ${imgHtml}
                    <div class="reply-box" style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">
                        <input type="text" id="answerInput_${q.id}" placeholder="답변 텍스트를 입력하세요..." style="width:100%; margin:0; padding:8px; font-size:13px;">
                        <div style="display:flex; gap:10px;">
                            <input type="file" id="answerImage_${q.id}" accept="image/*" style="flex:1; margin:0; font-size:12px; padding:6px; border:1px solid #ddd; border-radius:4px;">
                            <button id="answerBtn_${q.id}" onclick="submitAnswer(${q.id})" class="secondary-btn" style="width:auto; margin:0; padding:8px 15px; font-size:13px;">답변 등록</button>
                        </div>
                    </div>`;
            }
            li.addEventListener("click", (e) => {
                if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") return;
                const imgContainer = li.querySelector(".img-container"); if (imgContainer) imgContainer.classList.toggle("hidden");
            });
            questionListAdmin.appendChild(li);
        });
    } catch (err) { questionListAdmin.innerHTML = `<li style="color:red;">에러: ${err.message}</li>`; }
}

window.submitAnswer = async function(questionId) { 
    const answerText = document.getElementById(`answerInput_${questionId}`).value.trim();
    const fileInput = document.getElementById(`answerImage_${questionId}`);
    const btn = document.getElementById(`answerBtn_${questionId}`);
    if (!answerText) return alert("답변 내용을 입력하세요.");
    btn.innerText = "등록 중... ⏳"; btn.disabled = true;
    try {
        let image_base64 = null; let image_name = null;
        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0]; image_base64 = await fileToBase64(file); image_name = file.name;
        }
        await fetch('/api/answerQuestion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question_id: questionId, answer_text: answerText, image_base64: image_base64, image_name: image_name }) });
        alert("✅ 답변 등록 완료!"); loadStudentQuestionsAdmin(selectedStudentId); 
    } catch (err) { alert("답변 등록 실패: " + err.message); } 
    finally { btn.innerText = "답변 등록"; btn.disabled = false; }
};

async function loadMyExams() {
    myExamList.innerHTML = '<li>불러오는 중... ⏳</li>';
    try {
        const res = await fetch(`/api/getExams?student_id=${currentUser.id}`); const data = await res.json();
        myExamList.innerHTML = "";
        if (data.length === 0) return myExamList.innerHTML = '<li>아직 등록된 시험 점수가 없습니다.</li>';
        data.forEach(exam => {
            const li = document.createElement("li"); li.style.cursor = "pointer";
            let html = `<strong>${exam.exam_title}</strong>: ${exam.score}점`;
            if (exam.paper_image_url) html += `<div class="img-container hidden" style="margin-top:10px;"><img src="${exam.paper_image_url}" style="max-width:100%; max-height:250px; border-radius:8px;"></div>`;
            li.innerHTML = html;
            li.addEventListener("click", () => { const imgContainer = li.querySelector(".img-container"); if (imgContainer) imgContainer.classList.toggle("hidden"); });
            myExamList.appendChild(li);
        });
    } catch (err) { myExamList.innerHTML = `<li style="color:red;">에러: ${err.message}</li>`; }
}

async function loadMyQuestions() {
    myQuestionList.innerHTML = '<li>불러오는 중... ⏳</li>';
    try {
        const res = await fetch(`/api/getQuestions?student_id=${currentUser.id}`); const data = await res.json();
        myQuestionList.innerHTML = "";
        if (data.length === 0) return myQuestionList.innerHTML = '<li>아직 등록된 질문이 없습니다.</li>';
        
        data.forEach(q => {
            const li = document.createElement("li"); li.style.cursor = "pointer";
            const status = q.is_answered ? `<span style="color:green">[답변완료]</span>` : `<span style="color:red">[답변대기]</span>`;
            const imgHtml = q.question_image_url ? `<div class="img-container hidden" style="margin-top:10px;"><img src="${q.question_image_url}" style="max-width:100%; max-height:250px; border-radius:8px;"></div>` : '';
            const ansImgHtml = q.answer_image_url ? `<div style="margin-top:10px;"><img src="${q.answer_image_url}" style="max-width:100%; max-height:250px; border-radius:8px;"></div>` : '';
            const answerText = q.is_answered ? `<div style="margin-top:8px; padding:8px; background:#e8f8f5; border-radius:5px;"><strong>👨‍🏫 선생님:</strong> ${q.answer_text} ${ansImgHtml}</div>` : '';
            
            li.innerHTML = `${status} <strong>나:</strong> <span class="q-text">${q.question_text}</span> ${imgHtml} ${answerText}`;
            
            const btnGroup = createActionButtons(
                async () => {
                    const newText = prompt("질문 내용을 수정하세요:", q.question_text);
                    if(newText && newText !== q.question_text) {
                        try {
                            await universalUpdate('questions', q.id, { question_text: newText });
                            loadMyQuestions();
                        } catch(e) { alert(e.message); }
                    }
                },
                async () => {
                    if(!confirm("정말 이 질문을 삭제하시겠습니까? (선생님 답변도 함께 사라집니다)")) return;
                    try {
                        await universalDelete('questions', q.id);
                        loadMyQuestions();
                    } catch(e) { alert(e.message); }
                }
            );
            
            li.insertBefore(btnGroup, li.querySelector('.img-container') || li.querySelector('div') || null);

            li.addEventListener("click", (e) => {
                if(e.target.tagName === "BUTTON") return; 
                const imgContainer = li.querySelector(".img-container"); if (imgContainer) imgContainer.classList.toggle("hidden");
            });
            myQuestionList.appendChild(li);
        });
    } catch (err) { myQuestionList.innerHTML = `<li style="color:red;">에러: ${err.message}</li>`; }
}

async function loadMyFeedbacks() {
    myFeedbackList.innerHTML = '<li>불러오는 중...</li>';
    try {
        const res = await fetch(`/api/getFeedbacks?student_id=${currentUser.id}`); const data = await res.json();
        myFeedbackList.innerHTML = "";
        if(data.length === 0) return myFeedbackList.innerHTML = '<li class="placeholder-text">아직 도착한 알림장/피드백이 없습니다.</li>';
        data.forEach(f => {
            const li = document.createElement("li"); const date = new Date(f.created_at).toLocaleDateString();
            li.innerHTML = `<small style="color:#3498db; font-weight:bold;">[📅 ${date} 과외 일지]</small><br><p style="margin-top:5px; font-size:14px; color:#444;">${f.feedback_text}</p>`;
            li.style.cursor = "default"; li.style.background = "#fff"; myFeedbackList.appendChild(li);
        });
    } catch (err) { myFeedbackList.innerHTML = `<li style="color:red;">에러: ${err.message}</li>`; }
}

document.getElementById("loginBtn").addEventListener("click", async () => {
    const id = document.getElementById("idInput").value.trim(); const password = document.getElementById("passwordInput").value;
    if (!id || !password) return alert("아이디와 비밀번호를 입력해주세요.");
    try {
        const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, password }) });
        const data = await res.json(); if (!res.ok) throw new Error(data.error);
        currentUser = { id: data.user.id, name: data.name, role: data.role, token: data.token };
        localStorage.setItem("tutor_user", JSON.stringify(currentUser)); alert("로그인 성공!"); updateUI();
    } catch (err) { alert("에러: " + err.message); }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("tutor_user"); currentUser = null; selectedStudentId = null; updateUI();
    document.getElementById("idInput").value = ""; document.getElementById("passwordInput").value = "";
    if(document.getElementById("studentManagePanel")) document.getElementById("studentManagePanel").classList.add("hidden"); 
    document.getElementById("passwordFormContainer").classList.remove("active-form");
});

document.getElementById("createStudentBtn").addEventListener("click", async () => {
    const name = document.getElementById("newStudentName").value.trim(); const id = document.getElementById("newStudentId").value.trim(); 
    if (!name || !id) return alert("학생 이름과 아이디를 모두 입력하세요.");
    if (/[^a-zA-Z0-9_]/.test(id)) return alert("아이디는 영어와 숫자, 언더바(_)만 가능합니다.");
    try {
        await fetch('/api/createStudent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, id }) });
        alert(`✅ ${name} 학생 생성완료!`); document.getElementById("newStudentName").value = ""; document.getElementById("newStudentId").value = ""; loadStudentList(); 
    } catch (err) { alert("생성 실패: " + err.message); }
});

document.getElementById("uploadExamBtn").addEventListener("click", async () => {
    if (!selectedStudentId) return alert("먼저 학생을 선택해주세요!");
    const title = document.getElementById("examTitle").value.trim(); const score = document.getElementById("examScore").value;
    const fileInput = document.getElementById("examImage");
    if (!title || !score) return alert("시험명과 점수를 모두 입력하세요.");
    const btn = document.getElementById("uploadExamBtn"); btn.innerText = "업로드 중... ⏳"; btn.disabled = true;
    try {
        let image_base64 = null; let image_name = null;
        if (fileInput.files.length > 0) { image_base64 = await fileToBase64(fileInput.files[0]); image_name = fileInput.files[0].name; }
        await fetch('/api/uploadExam', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: selectedStudentId, exam_title: title, score: parseInt(score), image_base64: image_base64, image_name: image_name }) });
        alert("✅ 시험 점수 저장 완료!"); document.getElementById("examTitle").value = ""; document.getElementById("examScore").value = ""; fileInput.value = ""; 
        loadStudentExamsAdmin(selectedStudentId); 
    } catch (err) { alert("저장 실패: " + err.message); } finally { btn.innerText = "시험지 업로드 및 저장"; btn.disabled = false; }
});

document.getElementById("askQuestionBtn").addEventListener("click", async () => {
    const questionText = document.getElementById("questionText").value.trim(); const fileInput = document.getElementById("questionImage");
    if (!questionText) return alert("질문할 내용을 입력해주세요!");
    const btn = document.getElementById("askQuestionBtn"); btn.innerText = "올리는 중... ⏳"; btn.disabled = true;
    try {
        let image_base64 = null; let image_name = null;
        if (fileInput.files.length > 0) { image_base64 = await fileToBase64(fileInput.files[0]); image_name = fileInput.files[0].name; }
        await fetch('/api/askQuestion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: currentUser.id, question_text: questionText, image_base64: image_base64, image_name: image_name }) });
        alert("✅ 질문 등록 완료!"); document.getElementById("questionText").value = ""; fileInput.value = ""; loadMyQuestions(); 
    } catch (err) { alert("질문 등록 실패: " + err.message); } finally { btn.innerText = "질문 올리기"; btn.disabled = false; }
});

document.getElementById("togglePasswordBtn").addEventListener("click", () => { document.getElementById("passwordFormContainer").classList.toggle("active-form"); });
document.getElementById("changePasswordBtn").addEventListener("click", async () => {
    const newPassword = document.getElementById("newPassword").value;
    if (newPassword.length < 6) return alert("최소 6자리 이상이어야 합니다.");
    try {
        await fetch('/api/changePassword', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newPassword: newPassword, token: currentUser.token }) });
        alert("✅ 비밀번호 변경 완료! 다시 로그인해 주세요."); document.getElementById("newPassword").value = ""; document.getElementById("logoutBtn").click(); 
    } catch (err) { alert("변경 실패: " + err.message); }
});

// 🌟 [통합됨] 학생 정보 완전 삭제 기능도 adminAction API로 통신
document.getElementById("deleteStudentBtn").addEventListener("click", async () => {
    if (!selectedStudentId) return alert("선택된 학생이 없습니다.");
    if (!confirm("🚨 정말 삭제하시겠습니까? 데이터가 복구 불가능하게 지워집니다.")) return; 
    try {
        await fetch('/api/adminAction', { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ action: 'deleteStudent', student_id: selectedStudentId }) 
        });
        alert("✅ 삭제되었습니다."); document.getElementById("studentManagePanel").classList.add("hidden"); selectedStudentId = null; loadStudentList(); 
    } catch (err) { alert("삭제 실패: " + err.message); }
});
