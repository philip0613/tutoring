// ====================================================================
// 📚 Smart Tutoring Management System v2.0 - Core Script
// ====================================================================

// 💡 전역 상태 관리 변수
let currentUser = null;        // { user, role, name, token }
let currentStudentId = null;   // 선생님이 현재 상세 관리 중인 학생 ID
let currentSubjectFilter = null; // 현재 선택된 과목 필터 (null이면 전체)
let mySubjects = [];           // 과목 목록
let allStudentsCache = [];     // 전체 학생 캐시

// 캘린더 상태
let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth(); // 0 ~ 11
let currentMonthSchedules = [];

// ==========================================
// 🚀 앱 초기화 및 이벤트 등록
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initServiceWorker();
    checkSession();

    // 1. 로그인 / 로그아웃
    document.getElementById('loginBtn')?.addEventListener('click', handleLogin);
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

    // 2. 탭 전환 이벤트
    setupTabs();

    // 3. 알림 및 푸시 이벤트
    document.getElementById('enablePushBtn')?.addEventListener('click', requestPushPermission);
    document.getElementById('notificationBellBtn')?.addEventListener('click', toggleNotificationDropdown);
    document.getElementById('markAllReadBtn')?.addEventListener('click', markAllNotificationsAsRead);

    // 4. 선생님 대시보드 이벤트
    document.getElementById('createStudentBtn')?.addEventListener('click', handleCreateStudent);
    document.getElementById('uploadExamBtn')?.addEventListener('click', handleUploadExam);
    document.getElementById('sendFeedbackBtn')?.addEventListener('click', handleSendFeedback);
    document.getElementById('deleteStudentBtn')?.addEventListener('click', handleDeleteStudent);
    document.getElementById('openAddSubjectModalBtn')?.addEventListener('click', () => openModal('addSubjectModal'));
    document.getElementById('saveSubjectBtn')?.addEventListener('click', handleCreateSubject);
    document.getElementById('enrollExistingStudentBtn')?.addEventListener('click', openEnrollModal);
    document.getElementById('saveEnrollmentBtn')?.addEventListener('click', handleSaveEnrollment);

    // 5. 캘린더 네비게이션 이벤트
    document.getElementById('prevMonthBtn')?.addEventListener('click', () => changeCalendarMonth(-1));
    document.getElementById('nextMonthBtn')?.addEventListener('click', () => changeCalendarMonth(1));
    document.getElementById('studentPrevMonthBtn')?.addEventListener('click', () => changeCalendarMonth(-1));
    document.getElementById('studentNextMonthBtn')?.addEventListener('click', () => changeCalendarMonth(1));
    document.getElementById('openAddScheduleModalBtn')?.addEventListener('click', openScheduleModal);
    document.getElementById('saveScheduleBtn')?.addEventListener('click', handleSaveSchedule);

    // 6. 학생 대시보드 이벤트
    document.getElementById('askQuestionBtn')?.addEventListener('click', handleAskQuestion);
    document.getElementById('togglePasswordBtn')?.addEventListener('click', () => {
        document.getElementById('passwordFormContainer')?.classList.toggle('hidden-form');
    });
    document.getElementById('changePasswordBtn')?.addEventListener('click', handleChangePassword);

    // 모달 닫기 버튼 이벤트 바인딩
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal-overlay')?.classList.add('hidden');
        });
    });
});

// ==========================================
// 🔐 JWT 인증 래퍼 Fetch 함수
// ==========================================
async function authFetch(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    if (currentUser && currentUser.token) {
        headers['Authorization'] = `Bearer ${currentUser.token}`;
    }

    const res = await fetch(url, {
        ...options,
        headers
    });

    if (res.status === 401) {
        alert('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.');
        handleLogout();
        throw new Error('Unauthorized');
    }

    return res;
}

// ==========================================
// 🔔 웹 푸시 & 알림 센터 로직
// ==========================================
async function initServiceWorker() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
            await navigator.serviceWorker.register('/sw.js');
        } catch (err) {
            console.warn('서비스 워커 등록 실패:', err);
        }
    }
}

async function requestPushPermission() {
    if (!('Notification' in window)) {
        alert('이 브라우저는 웹 푸시 알림을 지원하지 않습니다.');
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            alert('알림 권한이 거부되었습니다. 브라우저 설정에서 알림을 허용해 주세요.');
            return;
        }

        const registration = await navigator.serviceWorker.ready;
        const vapidRes = await authFetch('/api/push?action=vapid_public_key');
        const vapidData = await vapidRes.json();

        // VAPID 키가 서버에 설정되어 있는 경우
        if (vapidData.publicKey) {
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey)
            });

            await authFetch('/api/push', {
                method: 'POST',
                body: JSON.stringify({ action: 'subscribe', subscription })
            });
        }

        alert('🔔 웹 푸시 알림이 성공적으로 활성화되었습니다!');
        document.getElementById('enablePushBtn')?.classList.add('hidden');
    } catch (err) {
        console.error('푸시 구독 실패:', err);
        alert('푸시 알림 활성화 완료: 새로운 질문 및 답변 시 알림을 받습니다.');
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function loadNotifications() {
    if (!currentUser) return;
    try {
        const res = await authFetch('/api/push');
        if (!res.ok) return;
        const list = await res.json();

        const badge = document.getElementById('notificationBadge');
        const container = document.getElementById('notificationList');
        if (!container) return;

        const unreadCount = list.filter(n => !n.is_read).length;
        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        if (list.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 20px 0; font-size: 0.85rem;">새로운 알림이 없습니다.</div>';
            return;
        }

        container.innerHTML = list.map(item => `
            <div class="notification-item ${item.is_read ? '' : 'unread'}" onclick="handleNotificationClick(${item.id})">
                <div style="font-weight: 700; color: #1e293b;">${escapeHtml(item.title)}</div>
                <div style="color: #475569; margin-top: 2px;">${escapeHtml(item.body)}</div>
                <div class="notification-time">${new Date(item.created_at).toLocaleString()}</div>
            </div>
        `).join('');
    } catch (err) {
        console.error('알림 로드 실패:', err);
    }
}

window.handleNotificationClick = async function(id) {
    await authFetch('/api/push', {
        method: 'POST',
        body: JSON.stringify({ action: 'mark_read', id })
    });
    loadNotifications();
};

async function markAllNotificationsAsRead() {
    await authFetch('/api/push', {
        method: 'POST',
        body: JSON.stringify({ action: 'mark_all_read' })
    });
    loadNotifications();
}

function toggleNotificationDropdown(e) {
    e.stopPropagation();
    const dropdown = document.getElementById('notificationDropdown');
    dropdown?.classList.toggle('hidden');
    if (!dropdown?.classList.contains('hidden')) {
        loadNotifications();
    }
}

document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notificationDropdown');
    const bell = document.getElementById('notificationBellBtn');
    if (dropdown && !dropdown.contains(e.target) && e.target !== bell && !bell?.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

// ==========================================
// 📑 탭 네비게이션 관리
// ==========================================
function setupTabs() {
    document.querySelectorAll('.tab-bar').forEach(bar => {
        bar.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                bar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const targetId = btn.getAttribute('data-target');
                const parent = bar.parentElement;
                
                // 형제 탭 콘텐츠들 숨기기
                parent.querySelectorAll('[id$="Tab"]').forEach(tab => {
                    tab.classList.add('hidden');
                });
                
                // 선택된 탭 표시
                const targetTab = document.getElementById(targetId);
                if (targetTab) {
                    targetTab.classList.remove('hidden');
                    if (targetId.includes('Calendar')) {
                        renderCalendar();
                    }
                }
            });
        });
    });
}

// ==========================================
// 🔑 인증 및 세션 관리
// ==========================================
function checkSession() {
    const saved = localStorage.getItem('tutoring_user_v2') || sessionStorage.getItem('tutoring_user_v2');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            updateUIForLoggedInUser();
        } catch (e) {
            handleLogout();
        }
    }
}

async function handleLogin() {
    const id = document.getElementById('idInput').value.trim();
    const password = document.getElementById('passwordInput').value.trim();

    if (!id || !password) {
        alert('아이디와 비밀번호를 모두 입력해 주세요.');
        return;
    }

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, password })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '로그인 실패');

        currentUser = data;
        localStorage.setItem('tutoring_user_v2', JSON.stringify(currentUser));
        
        document.getElementById('idInput').value = '';
        document.getElementById('passwordInput').value = '';

        updateUIForLoggedInUser();
    } catch (err) {
        alert(err.message);
    }
}

function handleLogout() {
    currentUser = null;
    currentStudentId = null;
    currentSubjectFilter = null;
    localStorage.removeItem('tutoring_user_v2');
    sessionStorage.removeItem('tutoring_user_v2');

    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('userInfo').classList.add('hidden');
    document.getElementById('teacherDashboard').classList.add('hidden');
    document.getElementById('studentDashboard').classList.add('hidden');
}

function updateUIForLoggedInUser() {
    if (!currentUser) return;

    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('userInfo').classList.remove('hidden');

    const roleName = (currentUser.role === 'admin' || currentUser.role === 'teacher') ? '선생님' : '학생';
    document.getElementById('userGreeting').textContent = `${currentUser.name} ${roleName}`;

    if (currentUser.role === 'admin' || currentUser.role === 'teacher') {
        document.getElementById('teacherDashboard').classList.remove('hidden');
        document.getElementById('studentDashboard').classList.add('hidden');
        initTeacherView();
    } else {
        document.getElementById('studentDashboard').classList.remove('hidden');
        document.getElementById('teacherDashboard').classList.add('hidden');
        initStudentView();
    }

    loadNotifications();
}

// ==========================================
// 📚 과목(Subject) 관리 로직
// ==========================================
async function loadSubjects() {
    try {
        const res = await authFetch('/api/subjects');
        if (!res.ok) throw new Error('과목 목록 로드 실패');
        mySubjects = await res.json();

        if (currentUser.role === 'admin' || currentUser.role === 'teacher') {
            renderTeacherSubjectChips();
            updateSubjectSelectOptions();
        } else {
            renderStudentSubjectChips();
            updateStudentSubjectSelectOptions();
        }
    } catch (err) {
        console.error('과목 로드 에러:', err);
    }
}

function renderTeacherSubjectChips() {
    const container = document.getElementById('teacherSubjectChips');
    if (!container) return;

    let html = `
        <div class="subject-chip ${currentSubjectFilter === null ? 'active' : ''}" onclick="selectSubjectFilter(null)">
            전체 과목
        </div>
    `;

    mySubjects.forEach(s => {
        const studentCount = s.enrollments ? s.enrollments.length : 0;
        const isActive = currentSubjectFilter === s.id;
        html += `
            <div class="subject-chip ${isActive ? 'active' : ''}" onclick="selectSubjectFilter(${s.id})">
                <span class="subject-color-dot" style="background-color: ${s.color};"></span>
                <span>${escapeHtml(s.name)}</span>
                <span style="font-size:0.75rem; opacity:0.8;">(${studentCount}명)</span>
            </div>
        `;
    });

    container.innerHTML = html;
}

function renderStudentSubjectChips() {
    const container = document.getElementById('studentSubjectChips');
    if (!container) return;

    if (mySubjects.length === 0) {
        container.innerHTML = '<span style="color:#94a3b8; font-size:0.9rem;">아직 배정된 과목이 없습니다. 선생님께 문의해 주세요.</span>';
        return;
    }

    let html = `
        <div class="subject-chip ${currentSubjectFilter === null ? 'active' : ''}" onclick="selectSubjectFilter(null)">
            전체 과목
        </div>
    `;

    mySubjects.forEach(s => {
        const isActive = currentSubjectFilter === s.id;
        html += `
            <div class="subject-chip ${isActive ? 'active' : ''}" onclick="selectSubjectFilter(${s.id})">
                <span class="subject-color-dot" style="background-color: ${s.color};"></span>
                <span>${escapeHtml(s.name)}</span>
            </div>
        `;
    });

    container.innerHTML = html;
}

window.selectSubjectFilter = function(subjectId) {
    currentSubjectFilter = subjectId;
    if (currentUser.role === 'admin' || currentUser.role === 'teacher') {
        renderTeacherSubjectChips();
        loadStudents();
        if (currentStudentId) {
            loadStudentDetail(currentStudentId);
        }
    } else {
        renderStudentSubjectChips();
        loadStudentData();
    }
    renderCalendar();
};

function updateSubjectSelectOptions() {
    const selects = ['newStudentSubjectSelect', 'examSubjectSelect', 'feedbackSubjectSelect', 'enrollTargetSubjectSelect', 'scheduleSubjectSelect'];
    selects.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const currentVal = sel.value;
        let html = '<option value="">과목 선택</option>';
        mySubjects.forEach(s => {
            html += `<option value="${s.id}">${escapeHtml(s.name)}</option>`;
        });
        sel.innerHTML = html;
        if (currentVal) sel.value = currentVal;
    });
}

function updateStudentSubjectSelectOptions() {
    const sel = document.getElementById('askQuestionSubjectSelect');
    if (!sel) return;
    let html = '<option value="">질문할 과목 선택</option>';
    mySubjects.forEach(s => {
        html += `<option value="${s.id}">${escapeHtml(s.name)}</option>`;
    });
    sel.innerHTML = html;
}

async function handleCreateSubject() {
    const name = document.getElementById('modalSubjectName').value.trim();
    const desc = document.getElementById('modalSubjectDesc').value.trim();
    const color = document.getElementById('modalSubjectColor').value;

    if (!name) {
        alert('과목명을 입력해 주세요.');
        return;
    }

    try {
        const res = await authFetch('/api/subjects', {
            method: 'POST',
            body: JSON.stringify({ name, description: desc, color })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '과목 개설 실패');

        alert(`'${name}' 과목이 개설되었습니다! 🎉`);
        document.getElementById('modalSubjectName').value = '';
        document.getElementById('modalSubjectDesc').value = '';
        closeModal('addSubjectModal');
        await loadSubjects();
    } catch (err) {
        alert(err.message);
    }
}

// ==========================================
// 👥 학생 및 수강생 관리 로직
// ==========================================
async function initTeacherView() {
    await loadSubjects();
    await loadStudents();
    renderCalendar();
}

async function loadStudents() {
    try {
        let url = '/api/getStudents';
        if (currentSubjectFilter) {
            url += `?subject_id=${currentSubjectFilter}`;
        }

        const res = await authFetch(url);
        if (!res.ok) throw new Error('학생 목록 로드 실패');
        const students = await res.json();
        allStudentsCache = students;

        const list = document.getElementById('studentList');
        if (!list) return;

        if (students.length === 0) {
            list.innerHTML = '<li style="text-align:center; color:#94a3b8;">등록된 학생이 없습니다.</li>';
            return;
        }

        list.innerHTML = students.map(s => `
            <li style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; ${currentStudentId === s.id ? 'border: 2px solid #3b82f6; background:#eff6ff;' : ''}" onclick="selectStudent('${s.id}', '${escapeHtml(s.name)}')">
                <span style="font-weight: 600;">👤 ${escapeHtml(s.name)}</span>
                <span class="small-btn" style="background:#3b82f6; font-size:0.8rem;">관리</span>
            </li>
        `).join('');

        // 학생 셀렉트 박스 갱신 (모달용)
        const schedStudentSel = document.getElementById('scheduleStudentSelect');
        if (schedStudentSel) {
            schedStudentSel.innerHTML = '<option value="">과목 전체 공통 수업</option>' + students.map(s => `
                <option value="${s.id}">${escapeHtml(s.name)}</option>
            `).join('');
        }
    } catch (err) {
        console.error('학생 로드 에러:', err);
    }
}

window.selectStudent = function(studentId, studentName) {
    currentStudentId = studentId;
    document.getElementById('manageStudentTitle').textContent = `👤 ${studentName} 학생 상세 관리`;
    document.getElementById('studentManagePanel').classList.remove('hidden');

    loadStudents(); // 활성 상태 하이라이트 갱신
    loadStudentDetail(studentId);
};

async function handleCreateStudent() {
    const name = document.getElementById('newStudentName').value.trim();
    const id = document.getElementById('newStudentId').value.trim();
    const subjectId = document.getElementById('newStudentSubjectSelect').value;

    if (!name || !id) {
        alert('학생 이름과 부여할 아이디를 입력해 주세요.');
        return;
    }

    try {
        const res = await authFetch('/api/createStudent', {
            method: 'POST',
            body: JSON.stringify({ name, id, subject_id: subjectId ? parseInt(subjectId) : null })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '학생 생성 실패');

        alert(`학생 [${name}] 계정이 생성되었습니다! (초기 비밀번호: 123456)`);
        document.getElementById('newStudentName').value = '';
        document.getElementById('newStudentId').value = '';
        await loadSubjects();
        await loadStudents();
    } catch (err) {
        alert(err.message);
    }
}

function openEnrollModal() {
    const subjSel = document.getElementById('enrollTargetSubjectSelect');
    const stuSel = document.getElementById('enrollTargetStudentSelect');
    if (!stuSel) return;

    stuSel.innerHTML = allStudentsCache.map(s => `
        <option value="${s.id}">${escapeHtml(s.name)}</option>
    `).join('');

    if (currentSubjectFilter && subjSel) {
        subjSel.value = currentSubjectFilter;
    }

    openModal('enrollStudentModal');
}

async function handleSaveEnrollment() {
    const subjectId = document.getElementById('enrollTargetSubjectSelect').value;
    const studentId = document.getElementById('enrollTargetStudentSelect').value;

    if (!subjectId || !studentId) {
        alert('과목과 학생을 모두 선택해 주세요.');
        return;
    }

    try {
        const res = await authFetch('/api/enrollments', {
            method: 'POST',
            body: JSON.stringify({ subject_id: parseInt(subjectId), student_id: studentId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '수강 등록 실패');

        alert('학생이 과목에 성공적으로 배정되었습니다! 🎓');
        closeModal('enrollStudentModal');
        await loadSubjects();
        await loadStudents();
    } catch (err) {
        alert(err.message);
    }
}

// ==========================================
// 🔍 학생 상세 데이터 로드 (질문, 시험, 피드백)
// ==========================================
async function loadStudentDetail(studentId) {
    loadAdminQuestions(studentId);
    loadAdminExams(studentId);
    loadAdminFeedbacks(studentId);
}

async function loadAdminQuestions(studentId) {
    const list = document.getElementById('questionListAdmin');
    if (!list) return;

    let url = `/api/getQuestions?student_id=${studentId}`;
    if (currentSubjectFilter) url += `&subject_id=${currentSubjectFilter}`;

    try {
        const res = await authFetch(url);
        const data = await res.json();
        const questions = Array.isArray(data) ? data : [];

        if (questions.length === 0) {
            list.innerHTML = '<li style="text-align:center; color:#94a3b8;">올린 질문이 없습니다.</li>';
            return;
        }

        list.innerHTML = questions.map(q => {
            const subjectBadge = q.subjects ? `<span style="font-size:0.75rem; background:${q.subjects.color}; color:white; padding:2px 6px; border-radius:4px; margin-right:4px;">${escapeHtml(q.subjects.name)}</span>` : '';
            return `
                <li id="question-${q.id}">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            ${subjectBadge}
                            <strong>Q: ${escapeHtml(q.question_text)}</strong>
                        </div>
                        <button class="small-btn" style="background:#ef4444; font-size:0.75rem;" onclick="deleteRecord('Question', ${q.id})">삭제</button>
                    </div>
                    ${q.question_image_url ? `<img src="${q.question_image_url}" alt="문제 사진" style="max-height:220px; object-fit:contain; cursor:pointer;" onclick="window.open('${q.question_image_url}')">` : ''}

                    <div style="margin-top: 10px; padding: 10px; background: white; border-radius: 6px; border-left: 3px solid ${q.is_answered ? '#10b981' : '#f59e0b'};">
                        ${q.is_answered ? `
                            <div style="display:flex; justify-content:space-between;">
                                <strong style="color: #10b981;">💡 선생님 풀이 답변:</strong>
                                <div>
                                    <button class="text-link-btn" style="font-size:0.8rem; margin-right:6px;" onclick="promptEditAnswer(${q.id}, '${escapeHtml(q.answer_text || '')}')">수정</button>
                                    <button class="text-link-btn" style="color:#ef4444; font-size:0.8rem;" onclick="deleteRecord('Answer', ${q.id})">답변취소</button>
                                </div>
                            </div>
                            <p style="margin-top: 4px;">${escapeHtml(q.answer_text)}</p>
                            ${q.answer_image_url ? `<img src="${q.answer_image_url}" alt="풀이 사진" style="max-height:220px; object-fit:contain; cursor:pointer;" onclick="window.open('${q.answer_image_url}')">` : ''}
                        ` : `
                            <span style="color: #f59e0b; font-weight:600; font-size:0.85rem;">[답변 대기 중]</span>
                            <div style="margin-top: 6px;">
                                <input type="text" id="ansText-${q.id}" placeholder="풀이 답변 작성">
                                <input type="file" id="ansImg-${q.id}" accept="image/*" style="margin-top:4px;">
                                <button class="primary-btn" style="margin-top:6px; padding:6px;" onclick="submitAnswer(${q.id})">답변 등록</button>
                            </div>
                        `}
                    </div>
                </li>
            `;
        }).join('');
    } catch (err) {
        console.error('질문 로드 실패:', err);
    }
}

async function loadAdminExams(studentId) {
    const list = document.getElementById('examListAdmin');
    if (!list) return;

    let url = `/api/getExams?student_id=${studentId}`;
    if (currentSubjectFilter) url += `&subject_id=${currentSubjectFilter}`;

    try {
        const res = await authFetch(url);
        const exams = await res.json();

        if (!Array.isArray(exams) || exams.length === 0) {
            list.innerHTML = '<li style="text-align:center; color:#94a3b8;">시험 기록이 없습니다.</li>';
            return;
        }

        list.innerHTML = exams.map(e => {
            const subjectBadge = e.subjects ? `<span style="font-size:0.75rem; background:${e.subjects.color}; color:white; padding:2px 6px; border-radius:4px; margin-right:4px;">${escapeHtml(e.subjects.name)}</span>` : '';
            return `
                <li>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            ${subjectBadge}
                            <strong>${escapeHtml(e.exam_title)}: <span style="color:#2563eb; font-size:1.1rem;">${e.score}점</span></strong>
                        </div>
                        <div>
                            <button class="text-link-btn" style="font-size:0.8rem; margin-right:6px;" onclick="promptEditExam(${e.id}, '${escapeHtml(e.exam_title)}', ${e.score})">수정</button>
                            <button class="text-link-btn" style="color:#ef4444; font-size:0.8rem;" onclick="deleteRecord('Exam', ${e.id})">삭제</button>
                        </div>
                    </div>
                    ${e.paper_image_url ? `<img src="${e.paper_image_url}" alt="시험지 사진" style="max-height:180px; object-fit:contain; cursor:pointer;" onclick="window.open('${e.paper_image_url}')">` : ''}
                </li>
            `;
        }).join('');
    } catch (err) {
        console.error('시험 로드 실패:', err);
    }
}

async function loadAdminFeedbacks(studentId) {
    const list = document.getElementById('feedbackListAdmin');
    if (!list) return;

    let url = `/api/getFeedbacks?student_id=${studentId}`;
    if (currentSubjectFilter) url += `&subject_id=${currentSubjectFilter}`;

    try {
        const res = await authFetch(url);
        const feedbacks = await res.json();

        if (!Array.isArray(feedbacks) || feedbacks.length === 0) {
            list.innerHTML = '<li style="text-align:center; color:#94a3b8;">피드백 기록이 없습니다.</li>';
            return;
        }

        list.innerHTML = feedbacks.map(f => {
            const subjectBadge = f.subjects ? `<span style="font-size:0.75rem; background:${f.subjects.color}; color:white; padding:2px 6px; border-radius:4px; margin-right:4px;">${escapeHtml(f.subjects.name)}</span>` : '';
            return `
                <li>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            ${subjectBadge}
                            <button class="feedback-title-btn" onclick="toggleFeedbackDetail('admin-fb-${f.id}')">
                                📝 ${escapeHtml(f.feedback_title || '과외 일지')} <span style="font-size:0.8rem; color:#94a3b8;">(${new Date(f.created_at).toLocaleDateString()})</span>
                            </button>
                        </div>
                        <div>
                            <button class="text-link-btn" style="font-size:0.8rem; margin-right:6px;" onclick="promptEditFeedback(${f.id}, '${escapeHtml(f.feedback_text)}')">수정</button>
                            <button class="text-link-btn" style="color:#ef4444; font-size:0.8rem;" onclick="deleteRecord('Feedback', ${f.id})">삭제</button>
                        </div>
                    </div>
                    <div id="admin-fb-${f.id}" class="feedback-detail">
                        <p style="white-space: pre-wrap;">${escapeHtml(f.feedback_text)}</p>
                    </div>
                </li>
            `;
        }).join('');
    } catch (err) {
        console.error('피드백 로드 실패:', err);
    }
}

window.toggleFeedbackDetail = function(id) {
    document.getElementById(id)?.classList.toggle('show');
};

// ==========================================
// ✍️ 선생님 데이터 등록 (시험, 피드백, 답변, 삭제)
// ==========================================
async function handleUploadExam() {
    if (!currentStudentId) {
        alert('먼저 학생을 선택해 주세요.');
        return;
    }

    const title = document.getElementById('examTitle').value.trim();
    const score = document.getElementById('examScore').value.trim();
    const subjectId = document.getElementById('examSubjectSelect').value;
    const file = document.getElementById('examImage').files[0];

    if (!title || score === '') {
        alert('시험명과 점수를 입력해 주세요.');
        return;
    }

    try {
        let imageBase64 = null;
        let imageName = null;
        if (file) {
            imageBase64 = await processAndResizeImage(file);
            imageName = file.name;
        }

        const res = await authFetch('/api/uploadExam', {
            method: 'POST',
            body: JSON.stringify({
                student_id: currentStudentId,
                exam_title: title,
                score: parseInt(score, 10),
                subject_id: subjectId ? parseInt(subjectId) : null,
                image_base64: imageBase64,
                image_name: imageName
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '시험 등록 실패');

        alert('시험 결과가 성공적으로 등록되었습니다!');
        document.getElementById('examTitle').value = '';
        document.getElementById('examScore').value = '';
        document.getElementById('examImage').value = '';
        loadAdminExams(currentStudentId);
    } catch (err) {
        alert(err.message);
    }
}

async function handleSendFeedback() {
    if (!currentStudentId) {
        alert('먼저 학생을 선택해 주세요.');
        return;
    }

    const title = document.getElementById('feedbackTitleAdmin').value.trim();
    const text = document.getElementById('feedbackTextAdmin').value.trim();
    const subjectId = document.getElementById('feedbackSubjectSelect').value;

    if (!text) {
        alert('피드백 내용을 입력해 주세요.');
        return;
    }

    try {
        const res = await authFetch('/api/sendFeedback', {
            method: 'POST',
            body: JSON.stringify({
                student_id: currentStudentId,
                feedback_title: title || '과외 일지',
                feedback_text: text,
                subject_id: subjectId ? parseInt(subjectId) : null
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '피드백 등록 실패');

        alert('피드백이 전송되었습니다! 💌');
        document.getElementById('feedbackTitleAdmin').value = '';
        document.getElementById('feedbackTextAdmin').value = '';
        loadAdminFeedbacks(currentStudentId);
    } catch (err) {
        alert(err.message);
    }
}

window.submitAnswer = async function(questionId) {
    const text = document.getElementById(`ansText-${questionId}`)?.value.trim();
    const file = document.getElementById(`ansImg-${questionId}`)?.files[0];

    if (!text) {
        alert('답변 내용을 작성해 주세요.');
        return;
    }

    try {
        let imageBase64 = null;
        let imageName = null;
        if (file) {
            imageBase64 = await processAndResizeImage(file);
            imageName = file.name;
        }

        const res = await authFetch('/api/answerQuestion', {
            method: 'POST',
            body: JSON.stringify({
                questionId,
                answer_text: text,
                image_base64: imageBase64,
                image_name: imageName
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '답변 등록 실패');

        alert('풀이 답변이 등록되었습니다! 💡');
        loadAdminQuestions(currentStudentId);
    } catch (err) {
        alert(err.message);
    }
};

window.deleteRecord = async function(type, id) {
    if (!confirm(`정말 이 ${type} 항목을 삭제하시겠습니까? (복구 불가)`)) return;

    try {
        const res = await authFetch('/api/adminAction', {
            method: 'POST',
            body: JSON.stringify({ action: 'delete' + type, id })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '삭제 실패');

        alert('삭제 완료되었습니다.');
        if (currentStudentId) loadStudentDetail(currentStudentId);
    } catch (err) {
        alert(err.message);
    }
};

window.promptEditExam = async function(id, curTitle, curScore) {
    const title = prompt('시험명 수정:', curTitle);
    if (!title) return;
    const score = prompt('점수 수정:', curScore);
    if (score === null || score === '') return;

    try {
        const res = await authFetch('/api/adminAction', {
            method: 'POST',
            body: JSON.stringify({ action: 'editExam', id, exam_title: title, score })
        });
        if (res.ok) loadAdminExams(currentStudentId);
    } catch (err) {
        alert(err.message);
    }
};

window.promptEditFeedback = async function(id, curText) {
    const text = prompt('피드백 내용 수정:', curText);
    if (!text) return;

    try {
        const res = await authFetch('/api/adminAction', {
            method: 'POST',
            body: JSON.stringify({ action: 'editFeedback', id, feedbackText: text })
        });
        if (res.ok) loadAdminFeedbacks(currentStudentId);
    } catch (err) {
        alert(err.message);
    }
};

window.promptEditAnswer = async function(id, curText) {
    const text = prompt('답변 내용 수정:', curText);
    if (!text) return;

    try {
        const res = await authFetch('/api/adminAction', {
            method: 'POST',
            body: JSON.stringify({ action: 'editAnswer', id, answerText: text })
        });
        if (res.ok) loadAdminQuestions(currentStudentId);
    } catch (err) {
        alert(err.message);
    }
};

async function handleDeleteStudent() {
    if (!currentStudentId) return;
    if (!confirm('🚨 경고: 이 학생의 계정, 모든 사진, 질문, 시험, 피드백이 영구 삭제됩니다. 계속하시겠습니까?')) return;

    try {
        const res = await authFetch('/api/adminAction', {
            method: 'POST',
            body: JSON.stringify({ action: 'deleteStudent', studentId: currentStudentId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '삭제 실패');

        alert('학생 계정 및 데이터가 완전히 삭제되었습니다.');
        currentStudentId = null;
        document.getElementById('studentManagePanel').classList.add('hidden');
        await loadStudents();
    } catch (err) {
        alert(err.message);
    }
}

// ==========================================
// 🎓 학생(Student) 대시보드 로직
// ==========================================
async function initStudentView() {
    await loadSubjects();
    await loadStudentData();
    renderCalendar();
}

async function loadStudentData() {
    loadMyExams();
    loadMyQuestions();
    loadMyFeedbacks();
}

async function loadMyExams() {
    const list = document.getElementById('myExamList');
    if (!list) return;

    let url = `/api/getExams?student_id=${currentUser.userId}`;
    if (currentSubjectFilter) url += `&subject_id=${currentSubjectFilter}`;

    try {
        const res = await authFetch(url);
        const exams = await res.json();

        if (!Array.isArray(exams) || exams.length === 0) {
            list.innerHTML = '<li style="text-align:center; color:#94a3b8;">시험 기록이 없습니다.</li>';
            return;
        }

        list.innerHTML = exams.map(e => {
            const subjectBadge = e.subjects ? `<span style="font-size:0.75rem; background:${e.subjects.color}; color:white; padding:2px 6px; border-radius:4px; margin-right:4px;">${escapeHtml(e.subjects.name)}</span>` : '';
            return `
                <li>
                    ${subjectBadge}
                    <strong>${escapeHtml(e.exam_title)}: <span style="color:#2563eb; font-size:1.1rem;">${e.score}점</span></strong>
                    ${e.paper_image_url ? `<img src="${e.paper_image_url}" alt="시험지 사진" style="cursor:pointer;" onclick="window.open('${e.paper_image_url}')">` : ''}
                </li>
            `;
        }).join('');
    } catch (err) {
        console.error('내 시험 로드 실패:', err);
    }
}

async function loadMyQuestions() {
    const list = document.getElementById('myQuestionList');
    if (!list) return;

    let url = `/api/getQuestions?student_id=${currentUser.userId}`;
    if (currentSubjectFilter) url += `&subject_id=${currentSubjectFilter}`;

    try {
        const res = await authFetch(url);
        const questions = await res.json();

        if (!Array.isArray(questions) || questions.length === 0) {
            list.innerHTML = '<li style="text-align:center; color:#94a3b8;">아직 질문한 내역이 없습니다.</li>';
            return;
        }

        list.innerHTML = questions.map(q => {
            const subjectBadge = q.subjects ? `<span style="font-size:0.75rem; background:${q.subjects.color}; color:white; padding:2px 6px; border-radius:4px; margin-right:4px;">${escapeHtml(q.subjects.name)}</span>` : '';
            return `
                <li id="question-${q.id}">
                    <div>
                        ${subjectBadge}
                        <strong>Q: ${escapeHtml(q.question_text)}</strong>
                    </div>
                    ${q.question_image_url ? `<img src="${q.question_image_url}" alt="문제 사진" style="cursor:pointer;" onclick="window.open('${q.question_image_url}')">` : ''}

                    <div style="margin-top: 10px; padding: 10px; background: white; border-radius: 6px; border-left: 3px solid ${q.is_answered ? '#10b981' : '#f59e0b'};">
                        ${q.is_answered ? `
                            <strong style="color: #10b981;">💡 선생님 풀이 답변:</strong>
                            <p style="margin-top: 4px;">${escapeHtml(q.answer_text)}</p>
                            ${q.answer_image_url ? `<img src="${q.answer_image_url}" alt="풀이 사진" style="cursor:pointer;" onclick="window.open('${q.answer_image_url}')">` : ''}
                        ` : `
                            <span style="color: #f59e0b; font-weight:600; font-size:0.85rem;">⏳ 선생님이 풀이 중입니다...</span>
                        `}
                    </div>
                </li>
            `;
        }).join('');
    } catch (err) {
        console.error('내 질문 로드 실패:', err);
    }
}

async function loadMyFeedbacks() {
    const list = document.getElementById('myFeedbackList');
    if (!list) return;

    let url = `/api/getFeedbacks?student_id=${currentUser.userId}`;
    if (currentSubjectFilter) url += `&subject_id=${currentSubjectFilter}`;

    try {
        const res = await authFetch(url);
        const feedbacks = await res.json();

        if (!Array.isArray(feedbacks) || feedbacks.length === 0) {
            list.innerHTML = '<li style="text-align:center; color:#94a3b8;">아직 도착한 과외 일지가 없습니다.</li>';
            return;
        }

        list.innerHTML = feedbacks.map(f => {
            const subjectBadge = f.subjects ? `<span style="font-size:0.75rem; background:${f.subjects.color}; color:white; padding:2px 6px; border-radius:4px; margin-right:4px;">${escapeHtml(f.subjects.name)}</span>` : '';
            return `
                <li>
                    <button class="feedback-title-btn" onclick="toggleFeedbackDetail('student-fb-${f.id}')">
                        ${subjectBadge}
                        📝 ${escapeHtml(f.feedback_title || '과외 일지')} <span style="font-size:0.8rem; color:#94a3b8;">(${new Date(f.created_at).toLocaleDateString()})</span>
                    </button>
                    <div id="student-fb-${f.id}" class="feedback-detail">
                        <p style="white-space: pre-wrap;">${escapeHtml(f.feedback_text)}</p>
                    </div>
                </li>
            `;
        }).join('');
    } catch (err) {
        console.error('내 피드백 로드 실패:', err);
    }
}

async function handleAskQuestion() {
    const text = document.getElementById('questionText').value.trim();
    const subjectId = document.getElementById('askQuestionSubjectSelect').value;
    const file = document.getElementById('questionImage').files[0];

    if (!text) {
        alert('질문 내용을 적어주세요.');
        return;
    }

    try {
        let imageBase64 = null;
        let imageName = null;
        if (file) {
            imageBase64 = await processAndResizeImage(file);
            imageName = file.name;
        }

        const res = await authFetch('/api/askQuestion', {
            method: 'POST',
            body: JSON.stringify({
                question_text: text,
                subject_id: subjectId ? parseInt(subjectId) : null,
                image_base64: imageBase64,
                image_name: imageName
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '질문 등록 실패');

        alert('질문이 등록되었습니다! 선생님께 전달되었습니다 🙋‍♂️');
        document.getElementById('questionText').value = '';
        document.getElementById('questionImage').value = '';
        loadMyQuestions();
    } catch (err) {
        alert(err.message);
    }
}

async function handleChangePassword() {
    const newPassword = document.getElementById('newPassword').value.trim();
    if (!newPassword || newPassword.length < 6) {
        alert('비밀번호는 6자리 이상 입력해 주세요.');
        return;
    }

    try {
        const res = await authFetch('/api/changePassword', {
            method: 'POST',
            body: JSON.stringify({ newPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '비밀번호 변경 실패');

        alert('비밀번호가 변경되었습니다! 다음 로그인 시 사용하세요.');
        document.getElementById('newPassword').value = '';
        document.getElementById('passwordFormContainer').classList.add('hidden-form');
    } catch (err) {
        alert(err.message);
    }
}

// ==========================================
// 📅 수업 캘린더 (Class Calendar) 로직
// ==========================================
function changeCalendarMonth(offset) {
    calendarMonth += offset;
    if (calendarMonth < 0) {
        calendarMonth = 11;
        calendarYear--;
    } else if (calendarMonth > 11) {
        calendarMonth = 0;
        calendarYear++;
    }
    renderCalendar();
}

async function renderCalendar() {
    const isTeacher = currentUser && (currentUser.role === 'admin' || currentUser.role === 'teacher');
    const monthTitleId = isTeacher ? 'calendarCurrentMonthTitle' : 'studentCalendarMonthTitle';
    const gridId = isTeacher ? 'calendarGridDays' : 'studentCalendarGridDays';

    const monthTitle = document.getElementById(monthTitleId);
    const grid = document.getElementById(gridId);
    if (!monthTitle || !grid) return;

    monthTitle.textContent = `${calendarYear}년 ${calendarMonth + 1}월`;

    // 해당 월의 수업 일정 로드
    const startDate = new Date(calendarYear, calendarMonth, 1).toISOString();
    const endDate = new Date(calendarYear, calendarMonth + 1, 0, 23, 59, 59).toISOString();

    let url = `/api/schedules?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
    if (currentSubjectFilter) url += `&subject_id=${currentSubjectFilter}`;

    try {
        const res = await authFetch(url);
        currentMonthSchedules = await res.json();
        if (!Array.isArray(currentMonthSchedules)) currentMonthSchedules = [];
    } catch (err) {
        console.error('캘린더 일정 로드 실패:', err);
        currentMonthSchedules = [];
    }

    // 달력 날짜 계산
    const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay(); // 시작 요일 (0: 일)
    const lastDate = new Date(calendarYear, calendarMonth + 1, 0).getDate(); // 마지막 날짜
    const prevLastDate = new Date(calendarYear, calendarMonth, 0).getDate(); // 지난달 마지막 날짜

    const today = new Date();
    const isCurrentMonthYear = today.getFullYear() === calendarYear && today.getMonth() === calendarMonth;

    let cellsHtml = '';

    // 1. 이전 달 날짜들
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const dayNum = prevLastDate - i;
        cellsHtml += `<div class="calendar-cell other-month"><div class="calendar-date-num">${dayNum}</div></div>`;
    }

    // 2. 이번 달 날짜들
    for (let d = 1; d <= lastDate; d++) {
        const isToday = isCurrentMonthYear && today.getDate() === d;
        const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        // 이날의 일정 필터
        const daySchedules = currentMonthSchedules.filter(s => {
            const sDate = s.start_time.split('T')[0];
            return sDate === dateStr;
        });

        let eventsHtml = '';
        daySchedules.forEach(s => {
            const color = (s.subjects && s.subjects.color) || '#3b82f6';
            const time = new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            eventsHtml += `
                <div class="calendar-event-badge schedule-status-${s.status}" style="background-color: ${color};" title="${escapeHtml(s.title)} (${time})">
                    ${time} ${escapeHtml(s.title)}
                </div>
            `;
        });

        cellsHtml += `
            <div class="calendar-cell ${isToday ? 'today' : ''}" onclick="selectCalendarDate('${dateStr}')">
                <div class="calendar-date-num">${d}</div>
                ${eventsHtml}
            </div>
        `;
    }

    // 3. 다음 달 채우기
    const totalRendered = firstDayIndex + lastDate;
    const remaining = (7 - (totalRendered % 7)) % 7;
    for (let j = 1; j <= remaining; j++) {
        cellsHtml += `<div class="calendar-cell other-month"><div class="calendar-date-num">${j}</div></div>`;
    }

    grid.innerHTML = cellsHtml;
}

window.selectCalendarDate = function(dateStr) {
    const isTeacher = currentUser && (currentUser.role === 'admin' || currentUser.role === 'teacher');
    const cardId = isTeacher ? 'selectedDateScheduleCard' : 'studentSelectedDateCard';
    const titleId = isTeacher ? 'selectedDateTitle' : 'studentSelectedDateTitle';
    const listId = isTeacher ? 'selectedDateScheduleList' : 'studentSelectedDateList';

    const card = document.getElementById(cardId);
    const title = document.getElementById(titleId);
    const list = document.getElementById(listId);
    if (!card || !title || !list) return;

    const daySchedules = currentMonthSchedules.filter(s => s.start_time.split('T')[0] === dateStr);
    title.textContent = `📅 ${dateStr} 수업 일정 (${daySchedules.length}건)`;
    card.classList.remove('hidden');

    if (daySchedules.length === 0) {
        list.innerHTML = '<li style="text-align:center; color:#94a3b8;">이날에는 예정된 수업이 없습니다.</li>';
        return;
    }

    list.innerHTML = daySchedules.map(s => {
        const startTime = new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const endTime = new Date(s.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const subjectName = (s.subjects && s.subjects.name) || '과목 미지정';
        const studentName = s.profiles ? `[${s.profiles.name} 학생 1:1]` : '[과목 공통 수업]';

        return `
            <li style="border-left: 4px solid ${(s.subjects && s.subjects.color) || '#3b82f6'};">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <span style="font-weight:700; font-size:1.05rem;">${escapeHtml(s.title)}</span>
                        <div style="color:#64748b; font-size:0.85rem; margin-top:2px;">
                            📚 ${escapeHtml(subjectName)} | 👤 ${escapeHtml(studentName)} | ⏰ ${startTime} ~ ${endTime}
                        </div>
                        ${s.notes ? `<div style="margin-top:6px; font-size:0.9rem; background:white; padding:6px 10px; border-radius:4px; border:1px solid #e2e8f0;">📝 메모: ${escapeHtml(s.notes)}</div>` : ''}
                    </div>
                    ${isTeacher ? `
                        <div style="display:flex; gap:6px;">
                            <button class="small-btn" style="background:#10b981; font-size:0.75rem;" onclick="toggleScheduleStatus(${s.id}, '${s.status === 'completed' ? 'scheduled' : 'completed'}')">
                                ${s.status === 'completed' ? '완료취소' : '수업완료'}
                            </button>
                            <button class="small-btn" style="background:#ef4444; font-size:0.75rem;" onclick="deleteSchedule(${s.id})">삭제</button>
                        </div>
                    ` : ''}
                </div>
            </li>
        `;
    }).join('');
};

window.toggleScheduleStatus = async function(id, newStatus) {
    try {
        await authFetch('/api/schedules', {
            method: 'PUT',
            body: JSON.stringify({ id, status: newStatus })
        });
        renderCalendar();
    } catch (err) {
        alert(err.message);
    }
};

window.deleteSchedule = async function(id) {
    if (!confirm('수업 일정을 삭제하시겠습니까?')) return;
    try {
        await authFetch(`/api/schedules?id=${id}`, { method: 'DELETE' });
        renderCalendar();
    } catch (err) {
        alert(err.message);
    }
};

function openScheduleModal() {
    updateSubjectSelectOptions();
    loadStudents();

    // 시작 시간 기본값: 오늘 현재 시간에서 1시간 뒤
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    const startIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    now.setHours(now.getHours() + 2);
    const endIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    document.getElementById('scheduleStartTime').value = startIso;
    document.getElementById('scheduleEndTime').value = endIso;

    openModal('addScheduleModal');
}

async function handleSaveSchedule() {
    const subjectId = document.getElementById('scheduleSubjectSelect').value;
    const studentId = document.getElementById('scheduleStudentSelect').value;
    const title = document.getElementById('scheduleTitle').value.trim();
    const startTime = document.getElementById('scheduleStartTime').value;
    const endTime = document.getElementById('scheduleEndTime').value;
    const notes = document.getElementById('scheduleNotes').value.trim();

    if (!subjectId || !title || !startTime || !endTime) {
        alert('과목, 수업 제목, 시작 및 종료 시간을 모두 입력해 주세요.');
        return;
    }

    try {
        const res = await authFetch('/api/schedules', {
            method: 'POST',
            body: JSON.stringify({
                subject_id: parseInt(subjectId),
                student_id: studentId || null,
                title,
                start_time: new Date(startTime).toISOString(),
                end_time: new Date(endTime).toISOString(),
                notes: notes || null
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '수업 일정 등록 실패');

        alert('수업 일정이 등록되었습니다! 📅');
        closeModal('addScheduleModal');
        document.getElementById('scheduleTitle').value = '';
        document.getElementById('scheduleNotes').value = '';
        renderCalendar();
    } catch (err) {
        alert(err.message);
    }
}

// ==========================================
// 🛠 모달 헬퍼 및 이미지 유틸리티
// ==========================================
function openModal(id) {
    document.getElementById(id)?.classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id)?.classList.add('hidden');
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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
                let width = img.width; let height = img.height;
                const MAX_WIDTH = 1280; const MAX_HEIGHT = 1280;

                if (width > height) {
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                } else {
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                }

                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            };
        };
        reader.onerror = error => reject(error);
    });
}
