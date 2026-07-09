let currentUser = null;
let selectedStudentId = null;

// HTML 요소 가져오기
const loginSection = document.getElementById("loginSection");
const teacherDashboard = document.getElementById("teacherDashboard");
const studentDashboard = document.getElementById("studentDashboard");
const userInfo = document.getElementById("userInfo");
const userGreeting = document.getElementById("userGreeting");

const studentListUl = document.getElementById("studentList");
const myExamList = document.getElementById("myExamList");
const myQuestionList = document.getElementById("myQuestionList"); 
const questionListAdmin = document.getElementById("questionListAdmin"); // 🌟 선생님용 질문 리스트

// 1. 초기 상태 체크
window.onload = () => {
    const savedUser = localStorage.getItem("tutor_user");
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        updateUI();
    }
};

// 2. 화면 전환 UI 업데이트
function updateUI() {
    if (!currentUser) {
        loginSection.classList.remove("hidden");
        teacherDashboard.classList.add("hidden");
        studentDashboard.classList.add("hidden");
        userInfo.classList.add("hidden");
    } else {
        loginSection.classList.add("hidden");
        userInfo.classList.remove("hidden");
        userGreeting.innerText = `반갑습니다, ${currentUser.name}님!`;

        if (currentUser.role === "admin") {
            teacherDashboard.classList.remove("hidden");
            studentDashboard.classList.add("hidden");
            loadStudentList(); 
        } else {
            studentDashboard.classList.remove("hidden");
            teacherDashboard.classList.add("hidden");
            loadMyExams(); 
            loadMyQuestions(); 
        }
    }
}

// 3. 학생 목록 불러오기 (선생님용)
async function loadStudentList() {
    studentListUl.innerHTML = '<li class="placeholder-text">학생 목록을 불러오는 중... ⏳</li>';
    try {
        const res = await fetch('/api/getStudents');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        studentListUl.innerHTML = "";
        if (data.length === 0) {
            studentListUl.innerHTML = '<li class="placeholder-text">등록된 학생이 없습니다.</li>';
            return;
        }
        data.forEach(student => {
            const li = document.createElement("li");
            li.innerText = `👤 ${student.name} 학생`;
            
            li.addEventListener("click", () => {
                selectedStudentId = student.id; 
                document.getElementById("studentManagePanel").classList.remove("hidden");
                document.getElementById("manageStudentTitle").innerText = `📝 ${student.name} 학생 상세 관리`;
                
                // 🌟 [추가됨] 학생 클릭 시 해당 학생의 질문 리스트 싹 불러오기!
                loadStudentQuestionsAdmin(student.id);
            });
            studentListUl.appendChild(li);
        });
    } catch (err) {
        studentListUl.innerHTML = `<li class="placeholder-text" style="color:red;">에러: ${err.message}</li>`;
    }
}

// 🌟 4. [새로 추가됨] 특정 학생의 질문 목록 불러오기 (선생님용)
async function loadStudentQuestionsAdmin(studentId) {
    questionListAdmin.innerHTML = '<li class="placeholder-text">질문 목록을 불러오는 중... ⏳</li>';
    try {
        // 학생 화면에서 쓰던 getQuestions API를 똑같이 재활용!
        const res = await fetch(`/api/getQuestions?student_id=${studentId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        questionListAdmin.innerHTML = "";
        if (data.length === 0) {
            questionListAdmin.innerHTML = '<li class="placeholder-text">올라온 질문이 없습니다.</li>';
            return;
        }

        data.forEach(q => {
            const li = document.createElement("li");
            
            if (q.is_answered) {
                // 답변이 완료된 질문
                li.innerHTML = `
                    <span style="color:green">[답변완료]</span> <strong>Q:</strong> ${q.question_text}
                    <div style="margin-top:8px; padding:8px; background:#e8f8f5; border-radius:5px;">
                        <strong>👨‍🏫 내 답변:</strong> ${q.answer_text}
                    </div>
                `;
            } else {
                // 답변을 기다리는 질문 (입력창 렌더링)
                li.innerHTML = `
                    <span style="color:red">[답변대기]</span> <strong>Q:</strong> ${q.question_text}
                    <div style="margin-top:10px; display:flex; gap:10px;">
                        <input type="text" id="answerInput_${q.id}" placeholder="답변을 입력하세요..." style="flex:1; margin:0; padding:8px; font-size:13px;">
                        <button onclick="submitAnswer(${q.id})" class="secondary-btn" style="width:auto; margin:0; padding:8px 15px; font-size:13px;">답변 달기</button>
                    </div>
                `;
            }
            questionListAdmin.appendChild(li);
        });
    } catch (err) {
        questionListAdmin.innerHTML = `<li style="color:red;">에러: ${err.message}</li>`;
    }
}

// 🌟 5. [새로 추가됨] 질문에 답변 달기 (선생님용)
// 버튼의 onclick 이벤트에서 부를 수 있게 window. 전역 객체에 붙여줌
window.submitAnswer = async function(questionId) { 
    const answerText = document.getElementById(`answerInput_${questionId}`).value.trim();
    if (!answerText) return alert("답변 내용을 입력하세요.");

    try {
        const res = await fetch('/api/answerQuestion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question_id: questionId, answer_text: answerText })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        alert("✅ 답변이 성공적으로 등록되었습니다!");
        
        // 답변 완료 후 질문 리스트 부분만 새로고침
        loadStudentQuestionsAdmin(selectedStudentId); 
    } catch (err) {
        alert("답변 등록 실패: " + err.message);
    }
};

// 6. 내 시험 결과 불러오기 (학생용)
async function loadMyExams() {
    myExamList.innerHTML = '<li>불러오는 중... ⏳</li>';
    try {
        const res = await fetch(`/api/getExams?student_id=${currentUser.id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        myExamList.innerHTML = "";
        if (data.length === 0) {
            myExamList.innerHTML = '<li>아직 등록된 시험 점수가 없습니다.</li>';
        } else {
            data.forEach(exam => {
                const li = document.createElement("li");
                li.innerHTML = `<strong>${exam.exam_title}</strong>: ${exam.score}점`;
                myExamList.appendChild(li);
            });
        }
    } catch (err) {
        myExamList.innerHTML = `<li style="color:red;">에러: ${err.message}</li>`;
    }
}

// 7. 내 질문 내역 불러오기 (학생용)
async function loadMyQuestions() {
    myQuestionList.innerHTML = '<li>불러오는 중... ⏳</li>';
    try {
        const res = await fetch(`/api/getQuestions?student_id=${currentUser.id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        myQuestionList.innerHTML = "";
        if (data.length === 0) {
            myQuestionList.innerHTML = '<li>아직 등록된 질문이 없습니다.</li>';
        } else {
            data.forEach(q => {
                const li = document.createElement("li");
                const status = q.is_answered ? `<span style="color:green">[답변완료]</span>` : `<span style="color:red">[답변대기]</span>`;
                const answerText = q.is_answered ? `<div style="margin-top:8px; padding:8px; background:#e8f8f5; border-radius:5px;"><strong>👨‍🏫 선생님:</strong> ${q.answer_text}</div>` : '';
                li.innerHTML = `${status} <strong>나:</strong> ${q.question_text} ${answerText}`;
                myQuestionList.appendChild(li);
            });
        }
    } catch (err) {
        myQuestionList.innerHTML = `<li style="color:red;">에러: ${err.message}</li>`;
    }
}

// 8. 모르는 문제 질문 올리기 (학생용)
document.getElementById("askQuestionBtn").addEventListener("click", async () => {
    const questionText = document.getElementById("questionText").value.trim();
    if (!questionText) return alert("질문할 내용을 입력해주세요!");
    try {
        const res = await fetch('/api/askQuestion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id: currentUser.id, question_text: questionText }) 
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        alert("✅ 질문이 성공적으로 등록되었습니다!");
        document.getElementById("questionText").value = "";
        loadMyQuestions(); 
    } catch (err) {
        alert("질문 등록 실패: " + err.message);
    }
});

// 9. 로그인 처리
document.getElementById("loginBtn").addEventListener("click", async () => {
    const id = document.getElementById("idInput").value.trim(); 
    const password = document.getElementById("passwordInput").value;
    if (!id || !password) return alert("아이디와 비밀번호를 입력해주세요.");
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, password }) 
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        currentUser = { id: data.user.id, name: data.name, role: data.role, token: data.token };
        localStorage.setItem("tutor_user", JSON.stringify(currentUser));
        alert("로그인 성공!");
        updateUI();
    } catch (err) {
        alert("에러: " + err.message);
    }
});

// 10. 로그아웃 처리
document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("tutor_user");
    currentUser = null;
    selectedStudentId = null; 
    updateUI();
    document.getElementById("idInput").value = "";
    document.getElementById("passwordInput").value = "";
    if(document.getElementById("studentManagePanel")) document.getElementById("studentManagePanel").classList.add("hidden"); 
    document.getElementById("passwordFormContainer").classList.remove("active-form");
});

// 11. 신규 학생 계정 생성
document.getElementById("createStudentBtn").addEventListener("click", async () => {
    const name = document.getElementById("newStudentName").value.trim();
    const id = document.getElementById("newStudentId").value.trim(); 
    if (!name || !id) return alert("학생 이름과 아이디를 모두 입력하세요.");
    if (/[^a-zA-Z0-9_]/.test(id)) return alert("아이디는 영어와 숫자, 언더바(_)만 가능합니다.");
    try {
        const res = await fetch('/api/createStudent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, id })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        alert(`✅ ${name} 학생 계정이 생성되었습니다!\n(아이디: ${id} / 기본비밀번호: 123456)`);
        document.getElementById("newStudentName").value = "";
        document.getElementById("newStudentId").value = "";
        loadStudentList(); 
    } catch (err) {
        alert("생성 실패: " + err.message);
    }
});

// 12. 시험 점수 DB에 저장하기
document.getElementById("uploadExamBtn").addEventListener("click", async () => {
    if (!selectedStudentId) return alert("먼저 위에서 학생을 선택해주세요!");
    const title = document.getElementById("examTitle").value.trim();
    const score = document.getElementById("examScore").value;
    if (!title || !score) return alert("시험명과 점수를 모두 입력하세요.");
    try {
        const res = await fetch('/api/uploadExam', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id: selectedStudentId, exam_title: title, score: parseInt(score) }) 
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        alert("✅ 시험 점수가 성공적으로 저장되었습니다!");
        document.getElementById("examTitle").value = "";
        document.getElementById("examScore").value = "";
    } catch (err) {
        alert("저장 실패: " + err.message);
    }
});

// 13. 비밀번호 변경 토글
document.getElementById("togglePasswordBtn").addEventListener("click", () => {
    const formContainer = document.getElementById("passwordFormContainer");
    formContainer.classList.toggle("active-form"); 
});

// 14. 비밀번호 실제 변경 처리
document.getElementById("changePasswordBtn").addEventListener("click", async () => {
    const newPassword = document.getElementById("newPassword").value;
    if (newPassword.length < 6) return alert("비밀번호는 최소 6자리 이상이어야 합니다.");
    try {
        const res = await fetch('/api/changePassword', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPassword: newPassword, token: currentUser.token }) 
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        alert("✅ 비밀번호가 성공적으로 변경되었습니다!\n안전을 위해 다시 로그인해 주세요.");
        document.getElementById("newPassword").value = "";
        document.getElementById("logoutBtn").click(); 
    } catch (err) {
        alert("비밀번호 변경 실패: " + err.message);
    }
});
