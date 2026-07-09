let currentUser = null;

// HTML 요소 가져오기
const loginSection = document.getElementById("loginSection");
const teacherDashboard = document.getElementById("teacherDashboard");
const studentDashboard = document.getElementById("studentDashboard");
const userInfo = document.getElementById("userInfo");
const userGreeting = document.getElementById("userGreeting");

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
        } else {
            studentDashboard.classList.remove("hidden");
            teacherDashboard.classList.add("hidden");
        }
    }
}

// 3. 로그인 처리 (아이디 기반)
document.getElementById("loginBtn").addEventListener("click", async () => {
    const id = document.getElementById("idInput").value.trim(); 
    const password = document.getElementById("passwordInput").value;
    
    if (!id || !password) return alert("아이디와 비밀번호를 입력해주세요.");

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, password }) // id 전송
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

// 4. 로그아웃 처리
document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("tutor_user");
    currentUser = null;
    updateUI();
    document.getElementById("idInput").value = "";
    document.getElementById("passwordInput").value = "";
});

// 5. [선생님 전용] 신규 학생 계정 생성 (아이디 기반)
document.getElementById("createStudentBtn").addEventListener("click", async () => {
    const name = document.getElementById("newStudentName").value.trim();
    const id = document.getElementById("newStudentId").value.trim();
    
    if (!name || !id) return alert("학생 이름과 아이디를 모두 입력하세요.");
    if (/[^a-zA-Z0-9_]/.test(id)) return alert("아이디는 영어와 숫자, 언더바(_)만 가능합니다.");

    try {
        const res = await fetch('/api/createStudent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, id }) // id 전송
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error);

        alert(`✅ ${name} 학생 계정이 생성되었습니다!\n(아이디: ${id} / 기본비밀번호: 123456)`);
        document.getElementById("newStudentName").value = "";
        document.getElementById("newStudentId").value = "";
        
        // TODO: 여기서 학생 목록(Student List) 다시 불러오기 함수 호출 예정
    } catch (err) {
        alert("생성 실패: " + err.message);
    }
});
