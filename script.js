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
const questionListAdmin = document.getElementById("questionListAdmin"); 

// 사진 파일을 텍스트(Base64)로 변환해 주는 함수
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

window.onload = () => {
    const savedUser = localStorage.getItem("tutor_user");
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        updateUI();
    }
};

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

// [선생님용] 학생 목록
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
                loadStudentQuestionsAdmin(student.id);
            });
            studentListUl.appendChild(li);
        });
    } catch (err) {
        studentListUl.innerHTML = `<li style="color:red;">에러: ${err.message}</li>`;
    }
}

// [선생님용] 특정 학생의 질문 목록 (클릭 시 사진 토글)
async function loadStudentQuestionsAdmin(studentId) {
    questionListAdmin.innerHTML = '<li class="placeholder-text">질문 목록을 불러오는 중... ⏳</li>';
    try {
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
            li.style.cursor = "pointer"; // 마우스 커서를 손모양으로
            
            // 🌟 사진 컨테이너에 기본적으로 hidden 클래스를 부여해서 숨김!
            const imgHtml = q.question_image_url ? `<div class="img-container hidden" style="margin-top:10px;"><img src="${q.question_image_url}" style="max-width:100%; max-height:250px; border-radius:8px;"></div>` : '';
            
            if (q.is_answered) {
                li.innerHTML = `<span style="color:green">[답변완료]</span> <strong>Q:</strong> ${q.question_text} ${imgHtml}
                    <div style="margin-top:8px; padding:8px; background:#e8f8f5; border-radius:5px;"><strong>👨‍🏫 내 답변:</strong> ${q.answer_text}</div>`;
            } else {
                li.innerHTML = `<span style="color:red">[답변대기]</span> <strong>Q:</strong> ${q.question_text} ${imgHtml}
                    <div class="reply-box" style="margin-top:10px; display:flex; gap:10px;">
                        <input type="text" id="answerInput_${q.id}" placeholder="답변을 입력하세요..." style="flex:1; margin:0; padding:8px; font-size:13px;">
                        <button onclick="submitAnswer(${q.id})" class="secondary-btn" style="width:auto; margin:0; padding:8px 15px; font-size:13px;">답변 달기</button>
                    </div>`;
            }

            // 🌟 질문 클릭 시 사진 보이기/숨기기 토글 이벤트
            li.addEventListener("click", (e) => {
                // ⚠️ 답변 입력창(INPUT)이나 버튼(BUTTON)을 누를 때는 사진이 열리지 않도록 차단!
                if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") return;
                
                const imgContainer = li.querySelector(".img-container");
                if (imgContainer) imgContainer.classList.toggle("hidden");
            });

            questionListAdmin.appendChild(li);
        });
    } catch (err) {
        questionListAdmin.innerHTML = `<li style="color:red;">에러: ${err.message}</li>`;
    }
}

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
        alert("✅ 답변 등록 완료!");
        loadStudentQuestionsAdmin(selectedStudentId); 
    } catch (err) {
        alert("답변 등록 실패: " + err.message);
    }
};

// [학생용] 내 시험결과 (클릭 시 사진 토글)
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
                li.style.cursor = "pointer";
                
                let html = `<strong>${exam.exam_title}</strong>: ${exam.score}점`;
                // 🌟 기본적으로 hidden 상태로 컨테이너 생성
                if (exam.paper_image_url) {
                    html += `<div class="img-container hidden" style="margin-top:10px;"><img src="${exam.paper_image_url}" style="max-width:100%; max-height:250px; border-radius:8px;"></div>`;
                }
                li.innerHTML = html;

                // 🌟 시험 결과 클릭 시 사진 토글
                li.addEventListener("click", () => {
                    const imgContainer = li.querySelector(".img-container");
                    if (imgContainer) imgContainer.classList.toggle("hidden");
                });

                myExamList.appendChild(li);
            });
        }
    } catch (err) {
        myExamList.innerHTML = `<li style="color:red;">에러: ${err.message}</li>`;
    }
}

// [학생용] 내 질문 리스트 (클릭 시 사진 토글)
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
                li.style.cursor = "pointer";
                
                const status = q.is_answered ? `<span style="color:green">[답변완료]</span>` : `<span style="color:red">[답변대기]</span>`;
                const answerText = q.is_answered ? `<div style="margin-top:8px; padding:8px; background:#e8f8f5; border-radius:5px;"><strong>👨‍🏫 선생님:</strong> ${q.answer_text}</div>` : '';
                // 🌟 기본적으로 hidden 상태로 사진 숨김
                const imgHtml = q.question_image_url ? `<div class="img-container hidden" style="margin-top:10px;"><img src="${q.question_image_url}" style="max-width:100%; max-height:250px; border-radius:8px;"></div>` : '';
                
                li.innerHTML = `${status} <strong>나:</strong> ${q.question_text} ${imgHtml} ${answerText}`;
                
                // 🌟 내 질문 클릭 시 사진 토글
                li.addEventListener("click", () => {
                    const imgContainer = li.querySelector(".img-container");
                    if (imgContainer) imgContainer.classList.toggle("hidden");
                });

                myQuestionList.appendChild(li);
            });
        }
    } catch (err) {
        myQuestionList.innerHTML = `<li style="color:red;">에러: ${err.message}</li>`;
    }
}

// 로그인/로그아웃/학생생성 처리 관련 리스너
document.getElementById("loginBtn").addEventListener("click", async () => {
    const id = document.getElementById("idInput").value.trim(); 
    const password = document.getElementById("passwordInput").value;
    if (!id || !password) return alert("아이디와 비밀번호를 입력해주세요.");
    try {
        const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, password }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        currentUser = { id: data.user.id, name: data.name, role: data.role, token: data.token };
        localStorage.setItem("tutor_user", JSON.stringify(currentUser));
        alert("로그인 성공!");
        updateUI();
    } catch (err) { alert("에러: " + err.message); }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("tutor_user");
    currentUser = null; selectedStudentId = null; 
    updateUI();
    document.getElementById("idInput").value = ""; document.getElementById("passwordInput").value = "";
    if(document.getElementById("studentManagePanel")) document.getElementById("studentManagePanel").classList.add("hidden"); 
    document.getElementById("passwordFormContainer").classList.remove("active-form");
});

document.getElementById("createStudentBtn").addEventListener("click", async () => {
    const name = document.getElementById("newStudentName").value.trim();
    const id = document.getElementById("newStudentId").value.trim(); 
    if (!name || !id) return alert("학생 이름과 아이디를 모두 입력하세요.");
    if (/[^a-zA-Z0-9_]/.test(id)) return alert("아이디는 영어와 숫자, 언더바(_)만 가능합니다.");
    try {
        const res = await fetch('/api/createStudent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, id }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        alert(`✅ ${name} 학생 생성완료! (아이디: ${id})`);
        document.getElementById("newStudentName").value = ""; document.getElementById("newStudentId").value = "";
        loadStudentList(); 
    } catch (err) { alert("생성 실패: " + err.message); }
});

// 시험 점수 및 사진 저장
document.getElementById("uploadExamBtn").addEventListener("click", async () => {
    if (!selectedStudentId) return alert("먼저 학생을 선택해주세요!");
    const title = document.getElementById("examTitle").value.trim();
    const score = document.getElementById("examScore").value;
    const fileInput = document.getElementById("examImage");

    if (!title || !score) return alert("시험명과 점수를 모두 입력하세요.");

    const btn = document.getElementById("uploadExamBtn");
    btn.innerText = "업로드 중... ⏳";
    btn.disabled = true;

    try {
        let image_base64 = null;
        let image_name = null;

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            if (file.size > 4 * 1024 * 1024) throw new Error("파일 크기는 4MB를 넘을 수 없습니다.");
            image_base64 = await fileToBase64(file);
            image_name = file.name;
        }

        const res = await fetch('/api/uploadExam', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                student_id: selectedStudentId, 
                exam_title: title, 
                score: parseInt(score),
                image_base64: image_base64,
                image_name: image_name
            }) 
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        alert("✅ 시험 점수가 성공적으로 저장되었습니다!");
        document.getElementById("examTitle").value = "";
        document.getElementById("examScore").value = "";
        fileInput.value = ""; 
    } catch (err) {
        alert("저장 실패: " + err.message);
    } finally {
        btn.innerText = "시험지 업로드 및 점수 저장";
        btn.disabled = false;
    }
});

// 질문 올리기
document.getElementById("askQuestionBtn").addEventListener("click", async () => {
    const questionText = document.getElementById("questionText").value.trim();
    const fileInput = document.getElementById("questionImage");

    if (!questionText) return alert("질문할 내용을 입력해주세요!");

    const btn = document.getElementById("askQuestionBtn");
    btn.innerText = "질문 올리는 중... ⏳";
    btn.disabled = true;

    try {
        let image_base64 = null;
        let image_name = null;

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            if (file.size > 4 * 1024 * 1024) throw new Error("파일 크기는 4MB를 넘을 수 없습니다.");
            image_base64 = await fileToBase64(file);
            image_name = file.name;
        }

        const res = await fetch('/api/askQuestion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                student_id: currentUser.id, 
                question_text: questionText,
                image_base64: image_base64,
                image_name: image_name
            }) 
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        alert("✅ 질문이 성공적으로 등록되었습니다!");
        document.getElementById("questionText").value = "";
        fileInput.value = "";
        loadMyQuestions(); 
    } catch (err) {
        alert("질문 등록 실패: " + err.message);
    } finally {
        btn.innerText = "질문 올리기";
        btn.disabled = false;
    }
});

// 비밀번호 변경
document.getElementById("togglePasswordBtn").addEventListener("click", () => {
    document.getElementById("passwordFormContainer").classList.toggle("active-form"); 
});

document.getElementById("changePasswordBtn").addEventListener("click", async () => {
    const newPassword = document.getElementById("newPassword").value;
    if (newPassword.length < 6) return alert("비밀번호는 최소 6자리 이상이어야 합니다.");
    try {
        const res = await fetch('/api/changePassword', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newPassword: newPassword, token: currentUser.token }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        alert("✅ 비밀번호 변경 완료!\n다시 로그인해 주세요.");
        document.getElementById("newPassword").value = "";
        document.getElementById("logoutBtn").click(); 
    } catch (err) { alert("비밀번호 변경 실패: " + err.message); }
});
