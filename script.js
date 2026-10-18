// ====================================================================
// 📚 Smart Tutoring Management System v2.0 - Core Script
// ====================================================================

// 💡 전역 상태 관리 변수
let currentUser = null;          // { user, role, name, token }
let currentStudentId = null;     // 관리 중인 학생 ID
let currentSubjectFilter = null; // 과목 필터 (null: 전체)
let mySubjects = [];             // 과목 목록
let allStudentsCache = [];       // 전체 학생 캐시

// 캘린더 상태
let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth();
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

    // 2. 탭 전환 이벤트 (메인 탭 & 서브 탭)
    setupTabs();
    setupSubTabs();

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

    // 창 포커스 시 최신 알림 자동 갱신
    window.addEventListener('focus', () => {
        if (currentUser) loadNotifications();
    });

    // 모달 닫기
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal-overlay')?.classList.add('hidden');
        });
    });
});

// ==========================================
// ✨ 로딩 UI & 스켈레톤 유틸리티
// ==========================================
function showSkeleton(containerId, count = 2) {
    const el = document.getElementById(containerId);
    if (!el) return;
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="skeleton-card">
                <div class="skeleton-line" style="width: 35%; height: 18px; margin-bottom: 12px;"></div>
                <div class="skeleton-line" style="width: 85%;"></div>
                <div class="skeleton-line" style="width: 60%;"></div>
            </div>
        `;
    }
    el.innerHTML = html;
}

function showLoading(containerId, message = '데이터를 불러오는 중입니다...') {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `
        <div class="loading-box">
            <div class="spinner"></div>
            <span style="font-size:0.88rem; font-weight:600; color:var(--text-secondary);">${escapeHtml(message)}</span>
        </div>
    `;
}

function setButtonLoading(btn, isLoading, loadingText = '처리 중...') {
    if (!btn) return;
    btn.disabled = isLoading;
    if (isLoading) {
        btn.dataset.origText = btn.innerHTML;
        btn.innerHTML = `<span class="spinner" style="width:15px; height:15px; border-width:2px; vertical-align:middle; margin-right:6px;"></span> ${loadingText}`;
    } else {
        btn.innerHTML = btn.dataset.origText || btn.innerHTML;
    }
}

// ==========================================
// 🔐 JWT 인증 래퍼 Fetch
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
// 🔔 웹 푸시 & 알림 센터
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

let knownUnreadIds = new Set();
let notificationPollTimer = null;
let isFirstNotificationLoad = true;

function showToast(title, body) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `
        <div style="font-size: 1.25rem;">🔔</div>
        <div style="flex: 1;">
            <div style="font-weight: 800; font-size: 0.92rem; margin-bottom: 2px;">${escapeHtml(title)}</div>
            <div style="font-size: 0.84rem; color: #cbd5e1; line-height: 1.4;">${escapeHtml(body)}</div>
        </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}

function startNotificationPolling() {
    if (notificationPollTimer) clearInterval(notificationPollTimer);
    notificationPollTimer = setInterval(() => {
        if (currentUser) loadNotifications();
    }, 10000); // 10초마다 실시간 체크
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

        const unreadList = list.filter(n => !n.is_read);
        const unreadCount = unreadList.length;

        // 새 알림 감지 시 토스트 알림 띄우기
        if (!isFirstNotificationLoad) {
            unreadList.forEach(item => {
                if (!knownUnreadIds.has(item.id)) {
                    showToast(item.title, item.body);
                }
            });
        }
        isFirstNotificationLoad = false;
        knownUnreadIds = new Set(unreadList.map(n => n.id));

        // 탭 타이틀 갱신
        if (unreadCount > 0) {
            document.title = `(${unreadCount}) 📚 스마트 과외 v2.0`;
        } else {
            document.title = '📚 스마트 과외 v2.0';
        }

        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        if (list.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px 0; font-size: 0.85rem;">새로운 알림이 없습니다.</div>';
            return;
        }

        container.innerHTML = list.map(item => `
            <div class="notification-item unread" style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="flex: 1; cursor: pointer;" onclick="handleNotificationClick(${item.id})">
                    <div style="font-weight: 700; color: var(--text-primary);">${escapeHtml(item.title)}</div>
                    <div style="color: var(--text-secondary); margin-top: 2px;">${escapeHtml(item.body)}</div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">${new Date(item.created_at).toLocaleString()}</div>
                </div>
                <button class="danger-link-btn" style="padding: 2px 6px; font-size: 1rem; line-height: 1;" onclick="handleNotificationClick(${item.id})" title="알림 확인 및 삭제">✕</button>
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
// 📑 메인 및 서브 탭 네비게이션
// ==========================================
function setupTabs() {
    document.querySelectorAll('.tab-bar').forEach(bar => {
        bar.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                bar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const targetId = btn.getAttribute('data-target');
                const parent = bar.parentElement;
                
                parent.querySelectorAll('[id$="Tab"]').forEach(tab => {
                    tab.classList.add('hidden');
                });
                
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

function setupSubTabs() {
    document.querySelectorAll('.sub-tab-bar').forEach(bar => {
        bar.querySelectorAll('.sub-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                bar.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const targetId = btn.getAttribute('data-subtarget');
                const parent = bar.parentElement;

                parent.querySelectorAll('[id^="student"][id$="Tab"]').forEach(tab => {
                    tab.classList.add('hidden');
                });

                const targetTab = document.getElementById(targetId);
                if (targetTab) targetTab.classList.remove('hidden');
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
    const btn = document.getElementById('loginBtn');

    if (!id || !password) {
        alert('아이디와 비밀번호를 모두 입력해 주세요.');
        return;
    }

    setButtonLoading(btn, true, '로그인 확인 중...');

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
    } finally {
        setButtonLoading(btn, false);
    }
}

function handleLogout() {
    currentUser = null;
    currentStudentId = null;
    currentSubjectFilter = null;
    if (notificationPollTimer) clearInterval(notificationPollTimer);
    knownUnreadIds.clear();
    isFirstNotificationLoad = true;
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
    startNotificationPolling();
}

// ==========================================
// 📚 과목 관리 로직
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
        container.innerHTML = '<span style="color:var(--text-muted); font-size:0.9rem;">아직 배정된 과목이 없습니다.</span>';
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
        if (currentStudentId) loadStudentDetail(currentStudentId);
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
    const btn = document.getElementById('saveSubjectBtn');

    if (!name) {
        alert('과목명을 입력해 주세요.');
        return;
    }

    setButtonLoading(btn, true, '과목 생성 중...');

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
    } finally {
        setButtonLoading(btn, false);
    }
}

// ==========================================
// 👥 학생 관리 로직 (로딩 UI 적용)
// ==========================================
async function initTeacherView() {
    await loadSubjects();
    await loadStudents();
    renderCalendar();
}

async function loadStudents() {
    showLoading('studentList', '학생 목록을 불러오는 중...');

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
            list.innerHTML = '<li style="text-align:center; color:var(--text-muted); padding:20px 0;">등록된 학생이 없습니다.</li>';
            return;
        }

        list.innerHTML = students.map(s => `
            <li style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding: 12px 14px; ${currentStudentId === s.id ? 'border: 2px solid var(--primary); background: var(--primary-light);' : ''}" onclick="selectStudent('${s.id}', '${escapeHtml(s.name)}')">
                <span style="font-weight: 700; color: var(--text-primary);">👤 ${escapeHtml(s.name)}</span>
                <span class="small-btn" style="background: var(--primary); color: white; border: none; font-size: 0.8rem; font-weight: 700;">상세보기</span>
            </li>
        `).join('');

        const schedStudentSel = document.getElementById('scheduleStudentSelect');
        if (schedStudentSel) {
            schedStudentSel.innerHTML = '<option value="">과목 전체 공통 수업</option>' + students.map(s => `
                <option value="${s.id}">${escapeHtml(s.name)}</option>
            `).join('');
        }
    } catch (err) {
        console.error('학생 로드 에러:', err);
        const list = document.getElementById('studentList');
        if (list) list.innerHTML = '<li style="text-align:center; color:var(--danger); padding:20px 0;">학생 목록을 불러오지 못했습니다.</li>';
    }
}

window.selectStudent = function(studentId, studentName) {
    currentStudentId = studentId;
    document.getElementById('manageStudentTitle').textContent = `👤 ${studentName} 학생 상세 관리`;
    document.getElementById('studentManagePanel').classList.remove('hidden');

    loadStudents();
    loadStudentDetail(studentId);

    document.getElementById('studentManagePanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

async function handleCreateStudent() {
    const name = document.getElementById('newStudentName').value.trim();
    const id = document.getElementById('newStudentId').value.trim();
    const subjectId = document.getElementById('newStudentSubjectSelect').value;
    const btn = document.getElementById('createStudentBtn');

    if (!name || !id) {
        alert('학생 이름과 부여할 아이디를 입력해 주세요.');
        return;
    }

    setButtonLoading(btn, true, '계정 생성 중...');

    try {
        const res = await authFetch('/api/createStudent', {
            method: 'POST',
            body: JSON.stringify({ name, id, subject_id: subjectId ? parseInt(subjectId) : null })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '학생 생성 실패');

        alert(`학생 [${name}] 계정이 생성되었습니다! (초기비번: 123456)`);
        document.getElementById('newStudentName').value = '';
        document.getElementById('newStudentId').value = '';
        await loadSubjects();
        await loadStudents();
    } catch (err) {
        alert(err.message);
    } finally {
        setButtonLoading(btn, false);
    }
}

function openEnrollModal() {
    const stuSel = document.getElementById('enrollTargetStudentSelect');
    const subjSel = document.getElementById('enrollTargetSubjectSelect');
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
    const btn = document.getElementById('saveEnrollmentBtn');

    if (!subjectId || !studentId) {
        alert('과목과 학생을 모두 선택해 주세요.');
        return;
    }

    setButtonLoading(btn, true, '과목에 등록 중...');

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
    } finally {
        setButtonLoading(btn, false);
    }
}

// ==========================================
// 🔍 학생 상세 피드 (스켈레톤 및 로딩 UI 적용)
// ==========================================
async function loadStudentDetail(studentId) {
    loadAdminQuestions(studentId);
    loadAdminExams(studentId);
    loadAdminFeedbacks(studentId);
}

// 1. 질문 관리 목록
async function loadAdminQuestions(studentId) {
    const list = document.getElementById('questionListAdmin');
    if (!list) return;

    showSkeleton('questionListAdmin', 2);

    let url = `/api/getQuestions?student_id=${studentId}`;
    if (currentSubjectFilter) url += `&subject_id=${currentSubjectFilter}`;

    try {
        const res = await authFetch(url);
        const data = await res.json();
        const questions = Array.isArray(data) ? data : [];

        document.getElementById('adminQuestionCount').textContent = questions.length;

        if (questions.length === 0) {
            list.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:30px 0;">아직 학생이 등록한 질문이 없습니다.</div>';
            return;
        }

        list.innerHTML = questions.map(q => {
            const hasAnswer = Boolean(q.is_answered || (q.answer_text && q.answer_text.trim() !== ''));
            const subjectBadge = q.subjects ? `<span class="badge" style="background:${q.subjects.color}20; color:${q.subjects.color}; border: 1px solid ${q.subjects.color}40;">📚 ${escapeHtml(q.subjects.name)}</span>` : '';
            const statusBadge = hasAnswer
                ? '<span class="badge badge-answered">✅ 답변완료</span>'
                : '<span class="badge badge-waiting">⏳ 답변대기</span>';

            return `
                <div class="feed-card" id="question-${q.id}">
                    <div class="feed-header">
                        <div style="display:flex; gap:6px; align-items:center;">
                            ${subjectBadge}
                            ${statusBadge}
                        </div>
                        <div style="display:flex; gap:6px;">
                            <button class="danger-link-btn" onclick="deleteRecord('Question', ${q.id})">삭제</button>
                        </div>
                    </div>

                    <div class="feed-title" style="margin-top: 4px;">
                        <span>Q. ${escapeHtml(q.question_text)}</span>
                    </div>

                    ${q.question_image_url ? `
                        <div class="image-preview-wrapper" onclick="window.open('${q.question_image_url}')" title="클릭하여 원본 사진 보기">
                            <img src="${q.question_image_url}" alt="문제 사진">
                        </div>
                    ` : ''}

                    <div class="answer-box">
                        ${hasAnswer ? `
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <strong style="color:var(--primary); font-size:0.9rem;">💡 선생님의 해설</strong>
                                <div>
                                    <button class="text-link-btn" onclick="promptEditAnswer(${q.id}, '${escapeHtml(q.answer_text || '')}')">수정</button>
                                    <button class="danger-link-btn" onclick="deleteRecord('Answer', ${q.id})">답변취소</button>
                                </div>
                            </div>
                            <p style="margin-top: 6px; font-size:0.95rem; white-space: pre-wrap;">${escapeHtml(q.answer_text || '')}</p>
                            ${q.answer_image_url ? `
                                <div class="image-preview-wrapper" style="margin-top:8px;" onclick="window.open('${q.answer_image_url}')">
                                    <img src="${q.answer_image_url}" alt="풀이 사진">
                                </div>
                            ` : ''}
                        ` : `
                            <div style="font-weight:700; font-size:0.88rem; color:var(--warning); margin-bottom: 6px;">✍️ 풀이 답변 작성하기</div>
                            <input type="text" id="ansText-${q.id}" placeholder="상세 풀이 설명을 적어주세요">
                            <input type="file" id="ansImg-${q.id}" accept="image/*">
                            <button class="primary-btn mt-12" style="padding: 8px 12px; font-size: 0.9rem;" onclick="submitAnswer(${q.id}, this)">답변 등록 완료</button>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('질문 로드 실패:', err);
        list.innerHTML = '<div style="text-align:center; color:var(--danger); padding:30px 0;">질문 목록을 불러오지 못했습니다.</div>';
    }
}

// 2. 시험 성적 목록
async function loadAdminExams(studentId) {
    const list = document.getElementById('examListAdmin');
    if (!list) return;

    showSkeleton('examListAdmin', 2);

    let url = `/api/getExams?student_id=${studentId}`;
    if (currentSubjectFilter) url += `&subject_id=${currentSubjectFilter}`;

    try {
        const res = await authFetch(url);
        const exams = await res.json();

        document.getElementById('adminExamCount').textContent = Array.isArray(exams) ? exams.length : 0;

        if (!Array.isArray(exams) || exams.length === 0) {
            list.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:30px 0;">등록된 시험 결과가 없습니다.</div>';
            return;
        }

        list.innerHTML = exams.map(e => {
            const subjectBadge = e.subjects ? `<span class="badge" style="background:${e.subjects.color}20; color:${e.subjects.color}; border: 1px solid ${e.subjects.color}40;">📚 ${escapeHtml(e.subjects.name)}</span>` : '';
            return `
                <div class="feed-card">
                    <div class="feed-header">
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${subjectBadge}
                            <span class="badge badge-score">${e.score}점</span>
                        </div>
                        <div style="display:flex; gap:4px;">
                            <button class="text-link-btn" onclick="promptEditExam(${e.id}, '${escapeHtml(e.exam_title)}', ${e.score})">수정</button>
                            <button class="danger-link-btn" onclick="deleteRecord('Exam', ${e.id})">삭제</button>
                        </div>
                    </div>

                    <div style="font-size:1.05rem; font-weight:800; color:var(--text-primary); margin: 6px 0;">
                        ${escapeHtml(e.exam_title)}
                    </div>

                    ${e.paper_image_url ? `
                        <div class="image-preview-wrapper" onclick="window.open('${e.paper_image_url}')" title="시험지 원본 사진 보기">
                            <img src="${e.paper_image_url}" alt="시험지 사진">
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('시험 로드 실패:', err);
        list.innerHTML = '<div style="text-align:center; color:var(--danger); padding:30px 0;">시험 목록을 불러오지 못했습니다.</div>';
    }
}

// 3. 피드백 목록
async function loadAdminFeedbacks(studentId) {
    const list = document.getElementById('feedbackListAdmin');
    if (!list) return;

    showSkeleton('feedbackListAdmin', 2);

    let url = `/api/getFeedbacks?student_id=${studentId}`;
    if (currentSubjectFilter) url += `&subject_id=${currentSubjectFilter}`;

    try {
        const res = await authFetch(url);
        const feedbacks = await res.json();

        document.getElementById('adminFeedbackCount').textContent = Array.isArray(feedbacks) ? feedbacks.length : 0;

        if (!Array.isArray(feedbacks) || feedbacks.length === 0) {
            list.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:30px 0;">작성된 과외 일지가 없습니다.</div>';
            return;
        }

        list.innerHTML = feedbacks.map(f => {
            const subjectBadge = f.subjects ? `<span class="badge" style="background:${f.subjects.color}20; color:${f.subjects.color}; border: 1px solid ${f.subjects.color}40;">📚 ${escapeHtml(f.subjects.name)}</span>` : '';
            return `
                <div class="feed-card" style="background: #ffffff;">
                    <div class="feed-header">
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${subjectBadge}
                            <span style="font-size:0.8rem; color:var(--text-muted);">${new Date(f.created_at).toLocaleDateString()}</span>
                        </div>
                        <div style="display:flex; gap:4px;">
                            <button class="text-link-btn" onclick="promptEditFeedback(${f.id}, '${escapeHtml(f.feedback_text)}')">수정</button>
                            <button class="danger-link-btn" onclick="deleteRecord('Feedback', ${f.id})">삭제</button>
                        </div>
                    </div>

                    <div style="font-size:1.05rem; font-weight:800; color:var(--text-primary); margin-bottom: 6px;">
                        📝 ${escapeHtml(f.feedback_title || '과외 일지')}
                    </div>
                    
                    <div style="background: #f8fafc; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); font-size: 0.95rem; white-space: pre-wrap; line-height: 1.6;">${escapeHtml(f.feedback_text)}</div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('피드백 로드 실패:', err);
        list.innerHTML = '<div style="text-align:center; color:var(--danger); padding:30px 0;">피드백을 불러오지 못했습니다.</div>';
    }
}

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
    const btn = document.getElementById('uploadExamBtn');

    if (!title || score === '') {
        alert('시험명과 점수를 입력해 주세요.');
        return;
    }

    setButtonLoading(btn, true, '시험지 저장 및 분석 중...');

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

        alert('시험 결과가 성공적으로 등록되었습니다! 📊');
        document.getElementById('examTitle').value = '';
        document.getElementById('examScore').value = '';
        document.getElementById('examImage').value = '';
        loadAdminExams(currentStudentId);
    } catch (err) {
        alert(err.message);
    } finally {
        setButtonLoading(btn, false);
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
    const btn = document.getElementById('sendFeedbackBtn');

    if (!text) {
        alert('피드백 내용을 입력해 주세요.');
        return;
    }

    setButtonLoading(btn, true, '피드백 발송 중...');

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
    } finally {
        setButtonLoading(btn, false);
    }
}

window.submitAnswer = async function(questionId, triggerBtn) {
    const text = document.getElementById(`ansText-${questionId}`)?.value.trim();
    const file = document.getElementById(`ansImg-${questionId}`)?.files[0];

    if (!text) {
        alert('답변 내용을 작성해 주세요.');
        return;
    }

    setButtonLoading(triggerBtn, true, '답변 등록 중...');

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
    } finally {
        setButtonLoading(triggerBtn, false);
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
// 🎓 학생(Student) 대시보드 로직 (로딩 UI 적용)
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

    showSkeleton('myExamList', 2);

    let url = `/api/getExams?student_id=${currentUser.userId}`;
    if (currentSubjectFilter) url += `&subject_id=${currentSubjectFilter}`;

    try {
        const res = await authFetch(url);
        const exams = await res.json();

        if (!Array.isArray(exams) || exams.length === 0) {
            list.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px 0;">시험 기록이 없습니다.</div>';
            return;
        }

        list.innerHTML = exams.map(e => {
            const subjectBadge = e.subjects ? `<span class="badge" style="background:${e.subjects.color}20; color:${e.subjects.color};">📚 ${escapeHtml(e.subjects.name)}</span>` : '';
            return `
                <div class="feed-card" style="padding:12px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            ${subjectBadge}
                            <strong style="margin-left:4px;">${escapeHtml(e.exam_title)}</strong>
                        </div>
                        <span class="badge badge-score">${e.score}점</span>
                    </div>
                    ${e.paper_image_url ? `
                        <div class="image-preview-wrapper" style="margin-top:8px;" onclick="window.open('${e.paper_image_url}')">
                            <img src="${e.paper_image_url}" alt="시험지 사진">
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('내 시험 로드 실패:', err);
        list.innerHTML = '<div style="text-align:center; color:var(--danger); padding:20px 0;">시험 기록을 불러오지 못했습니다.</div>';
    }
}

async function loadMyQuestions() {
    const list = document.getElementById('myQuestionList');
    if (!list) return;

    showSkeleton('myQuestionList', 2);

    let url = `/api/getQuestions?student_id=${currentUser.userId}`;
    if (currentSubjectFilter) url += `&subject_id=${currentSubjectFilter}`;

    try {
        const res = await authFetch(url);
        const questions = await res.json();

        if (!Array.isArray(questions) || questions.length === 0) {
            list.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:30px 0;">아직 질문한 내역이 없습니다.</div>';
            return;
        }

        list.innerHTML = questions.map(q => {
            const hasAnswer = Boolean(q.is_answered || (q.answer_text && q.answer_text.trim() !== ''));
            const subjectBadge = q.subjects ? `<span class="badge" style="background:${q.subjects.color}20; color:${q.subjects.color};">📚 ${escapeHtml(q.subjects.name)}</span>` : '';
            const statusBadge = hasAnswer
                ? '<span class="badge badge-answered">✅ 답변완료</span>'
                : '<span class="badge badge-waiting">⏳ 풀이중</span>';

            return `
                <div class="feed-card" id="question-${q.id}">
                    <div class="feed-header">
                        <div style="display:flex; gap:6px; align-items:center;">
                            ${subjectBadge}
                            ${statusBadge}
                        </div>
                    </div>

                    <div class="feed-title">
                        <span>Q. ${escapeHtml(q.question_text)}</span>
                    </div>

                    ${q.question_image_url ? `
                        <div class="image-preview-wrapper" onclick="window.open('${q.question_image_url}')">
                            <img src="${q.question_image_url}" alt="문제 사진">
                        </div>
                    ` : ''}

                    <div class="answer-box">
                        ${hasAnswer ? `
                            <strong style="color:var(--primary); font-size:0.9rem;">💡 선생님의 해설:</strong>
                            <p style="margin-top:4px; font-size:0.95rem; white-space: pre-wrap;">${escapeHtml(q.answer_text || '')}</p>
                            ${q.answer_image_url ? `
                                <div class="image-preview-wrapper" style="margin-top:8px;" onclick="window.open('${q.answer_image_url}')">
                                    <img src="${q.answer_image_url}" alt="풀이 사진">
                                </div>
                            ` : ''}
                        ` : `
                            <span style="color:var(--warning); font-weight:700; font-size:0.85rem;">⏳ 선생님이 풀이를 작성하고 있습니다...</span>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('내 질문 로드 실패:', err);
        list.innerHTML = '<div style="text-align:center; color:var(--danger); padding:30px 0;">질문 목록을 불러오지 못했습니다.</div>';
    }
}

async function loadMyFeedbacks() {
    const list = document.getElementById('myFeedbackList');
    if (!list) return;

    showSkeleton('myFeedbackList', 2);

    let url = `/api/getFeedbacks?student_id=${currentUser.userId}`;
    if (currentSubjectFilter) url += `&subject_id=${currentSubjectFilter}`;

    try {
        const res = await authFetch(url);
        const feedbacks = await res.json();

        if (!Array.isArray(feedbacks) || feedbacks.length === 0) {
            list.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:30px 0;">아직 도착한 과외 일지가 없습니다.</div>';
            return;
        }

        list.innerHTML = feedbacks.map(f => {
            const subjectBadge = f.subjects ? `<span class="badge" style="background:${f.subjects.color}20; color:${f.subjects.color};">📚 ${escapeHtml(f.subjects.name)}</span>` : '';
            return `
                <div class="feed-card" style="background: white;">
                    <div class="feed-header">
                        ${subjectBadge}
                        <span style="font-size:0.8rem; color:var(--text-muted);">${new Date(f.created_at).toLocaleDateString()}</span>
                    </div>
                    <div style="font-size:1.05rem; font-weight:800; color:var(--text-primary); margin-bottom: 6px;">
                        📝 ${escapeHtml(f.feedback_title || '과외 일지')}
                    </div>
                    <div style="background: #f8fafc; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); font-size: 0.95rem; white-space: pre-wrap; line-height: 1.6;">${escapeHtml(f.feedback_text)}</div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('내 피드백 로드 실패:', err);
        list.innerHTML = '<div style="text-align:center; color:var(--danger); padding:30px 0;">피드백을 불러오지 못했습니다.</div>';
    }
}

async function handleAskQuestion() {
    const text = document.getElementById('questionText').value.trim();
    const subjectId = document.getElementById('askQuestionSubjectSelect').value;
    const file = document.getElementById('questionImage').files[0];
    const btn = document.getElementById('askQuestionBtn');

    if (!text) {
        alert('질문 내용을 적어주세요.');
        return;
    }

    setButtonLoading(btn, true, '질문 등록 중...');

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
    } finally {
        setButtonLoading(btn, false);
    }
}

async function handleChangePassword() {
    const newPassword = document.getElementById('newPassword').value.trim();
    const btn = document.getElementById('changePasswordBtn');

    if (!newPassword || newPassword.length < 6) {
        alert('비밀번호는 6자리 이상 입력해 주세요.');
        return;
    }

    setButtonLoading(btn, true, '변경 중...');

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
    } finally {
        setButtonLoading(btn, false);
    }
}

// ==========================================
// 📅 수업 캘린더 로직 (로딩 UI 적용)
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

    const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();
    const lastDate = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const prevLastDate = new Date(calendarYear, calendarMonth, 0).getDate();

    const today = new Date();
    const isCurrentMonthYear = today.getFullYear() === calendarYear && today.getMonth() === calendarMonth;

    let cellsHtml = '';

    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const dayNum = prevLastDate - i;
        cellsHtml += `<div class="calendar-cell other-month"><div class="calendar-date-num">${dayNum}</div></div>`;
    }

    for (let d = 1; d <= lastDate; d++) {
        const isToday = isCurrentMonthYear && today.getDate() === d;
        const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        const daySchedules = currentMonthSchedules.filter(s => {
            const sDate = s.start_time.split('T')[0];
            return sDate === dateStr;
        });

        let eventsHtml = '';
        daySchedules.forEach(s => {
            const color = (s.subjects && s.subjects.color) || '#4f46e5';
            const time = new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            eventsHtml += `
                <div class="calendar-event-badge" style="background-color: ${color};" title="${escapeHtml(s.title)} (${time})">
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
        list.innerHTML = '<li style="text-align:center; color:var(--text-muted); padding:20px 0;">이날에는 예정된 수업이 없습니다.</li>';
        return;
    }

    list.innerHTML = daySchedules.map(s => {
        const startTime = new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const endTime = new Date(s.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const subjectName = (s.subjects && s.subjects.name) || '과목 미지정';
        const studentName = s.profiles ? `[${s.profiles.name} 1:1]` : '[과목 공통]';

        return `
            <li style="border-left: 4px solid ${(s.subjects && s.subjects.color) || '#4f46e5'};">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <span style="font-weight:800; font-size:1.05rem;">${escapeHtml(s.title)}</span>
                        <div style="color:var(--text-secondary); font-size:0.85rem; margin-top:2px;">
                            📚 ${escapeHtml(subjectName)} | 👤 ${escapeHtml(studentName)} | ⏰ ${startTime} ~ ${endTime}
                        </div>
                        ${s.notes ? `<div style="margin-top:6px; font-size:0.9rem; background:#f8fafc; padding:8px 12px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">📝 메모: ${escapeHtml(s.notes)}</div>` : ''}
                    </div>
                    ${isTeacher ? `
                        <div style="display:flex; gap:6px;">
                            <button class="small-btn" style="background:var(--success); color:white; border:none;" onclick="toggleScheduleStatus(${s.id}, '${s.status === 'completed' ? 'scheduled' : 'completed'}')">
                                ${s.status === 'completed' ? '완료취소' : '수업완료'}
                            </button>
                            <button class="danger-link-btn" onclick="deleteSchedule(${s.id})">삭제</button>
                        </div>
                    ` : ''}
                </div>
            </li>
        `;
    }).join('');

    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
    const btn = document.getElementById('saveScheduleBtn');

    if (!subjectId || !title || !startTime || !endTime) {
        alert('과목, 수업 제목, 시작 및 종료 시간을 모두 입력해 주세요.');
        return;
    }

    setButtonLoading(btn, true, '일정 저장 중...');

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
    } finally {
        setButtonLoading(btn, false);
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
