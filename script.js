let currentUser = null;

const loginSection = document.getElementById("loginSection");
const teacherDashboard = document.getElementById("teacherDashboard");
const studentDashboard = document.getElementById("studentDashboard");
const userInfo = document.getElementById("userInfo");
const userGreeting = document.getElementById("userGreeting");

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
            
            // 🌟 선생님 로그인 시 학생 목록 불러오기 실행!
            loadStudentList(); 
        } else {
            studentDashboard.classList.remove("hidden");
            teacherDashboard.classList.add("hidden");
        }
    }
}

// 🌟 [추가됨] 학생 목록을 DB에서 불러와 화면에 그려주는 함수
async function loadStudentList() {
    const studentListUl = document.getElementById("studentList");
    studentListUl.innerHTML = '<li class="placeholder-text">학생 목록을 불러오는 중... ⏳</li>';

    try {
        const res = await fetch('/api/getStudents');
        const data = await res.json();

        if (!res.ok) throw new Error(data.error);

        studentListUl.innerHTML = ""; // 기존 텍스트 지우기

        if (data.length === 0) {
            studentListUl.innerHTML = '<li class="placeholder-text">등록된 학생이 없습니다.</li>';
            return;
        }

        // 받아온 학생 수만큼 목록(li)을 생성해서 화면에 붙임
        data.forEach(student => {
            const li = document.createElement("li");
            li.innerText = `👤 ${student.name} 학생`;
            // TODO: 다음 단계에서 여기를 클릭하면 시험지 올리기 패널이 열리도록 할 예정!
            studentListUl.appendChild(li);
        });

    } catch (err) {
        studentListUl.innerHTML = `<li class="placeholder-text" style="color:red;">에러: ${err.message}</li>`;
    }
}

// 로그인 처리
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

// 로그아웃 처리
document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("tutor_user");
    currentUser = null;
    updateUI();
    document.getElementById("idInput").value = "";
    document.getElementById("passwordInput").value = "";
});

// 신규 학생 계정 생성
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

        alert(`✅ ${name} 학생 계정이 생성되었습니다! (아이디: ${id})`);
        document.getElementById("newStudentName").value = "";
        document.getElementById("newStudentId").value = "";
        
        // 🌟 학생을 새로 만들었으니 리스트 새로고침!
        loadStudentList(); 
    } catch (err) {
        alert("생성 실패: " + err.message);
    }
});
