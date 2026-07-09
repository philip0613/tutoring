let currentUser = null;
let selectedStudentId = null; // 클릭한 학생의 ID를 저장할 변수

// HTML 요소 가져오기
const loginSection = document.getElementById("loginSection");
const teacherDashboard = document.getElementById("teacherDashboard");
const studentDashboard = document.getElementById("studentDashboard");
const userInfo = document.getElementById("userInfo");
const userGreeting = document.getElementById("userGreeting");
const studentListUl = document.getElementById("studentList");
const myExamList = document.getElementById("myExamList");

// 1. 초기 상태 체크 (자동 로그인)
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
            loadMyExams(); // 🌟 학생 로그인 시 내 점수 불러오기 실행!
        }
    }
}

// 🌟 [추가됨] 학생이 자기 점수 불러오는 함수
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

// 3. 학생 목록 불러오기 및 클릭 이벤트
async function loadStudentList() {
    const studentListUl = document.getElementById("studentList");
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

        // 학생 목록 생성 및 클릭 이벤트 추가
        data.forEach(student => {
            const li = document.createElement("li");
            li.innerText = `👤 ${student.name} 학생`;
            
            // 리스트를 클릭했을 때 패널 열기
            li.addEventListener("click", () => {
                selectedStudentId = student.id; // 누구를 클릭했는지 ID 기억하기
                document.getElementById("studentManagePanel").classList.remove("hidden");
                document.getElementById("manageStudentTitle").innerText = `📝 ${student.name} 학생 상세 관리`;
            });
            
            studentListUl.appendChild(li);
        });

    } catch (err) {
        studentListUl.innerHTML = `<li class="placeholder-text" style="color:red;">에러: ${err.message}</li>`;
    }
}

// 4. 로그인 처리
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

        currentUser = {
            id: data.user.id,
            name: data.name,
            role: data.role,
            token: data.token
        };
        localStorage.setItem("tutor_user", JSON.stringify(currentUser));
        
        alert("로그인 성공!");
        updateUI();
    } catch (err) {
        alert("에러: " + err.message);
    }
});

// 5. 로그아웃 처리
document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("tutor_user");
    currentUser = null;
    selectedStudentId = null; // 로그아웃 시 선택된 학생도 초기화
    updateUI();
    document.getElementById("idInput").value = "";
    document.getElementById("passwordInput").value = "";
    document.getElementById("studentManagePanel").classList.add("hidden"); // 패널 닫기
});

// 6. [선생님 전용] 신규 학생 계정 생성
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
        
        loadStudentList(); // 리스트 새로고침
    } catch (err) {
        alert("생성 실패: " + err.message);
    }
});

// 7. [선생님 전용] 시험 점수 DB에 저장하기
document.getElementById("uploadExamBtn").addEventListener("click", async () => {
    if (!selectedStudentId) return alert("먼저 위에서 학생을 선택해주세요!");

    const title = document.getElementById("examTitle").value.trim();
    const score = document.getElementById("examScore").value;

    if (!title || !score) return alert("시험명과 점수를 모두 입력하세요.");

    try {
        const res = await fetch('/api/uploadExam', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                student_id: selectedStudentId, 
                exam_title: title, 
                score: parseInt(score) 
            }) 
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
