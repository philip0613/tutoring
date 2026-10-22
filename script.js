// ====================================================================
// 📚 Smart Tutoring Management System v2.0 - Core Script
// ====================================================================

// 💡 전역 상태 관리 변수
let currentUser = null;          // { user, role, name, token }
let currentStudentId = null;     // 관리 중인 학생 ID
let currentSubjectFilter = null; // 과목 필터 (null: 전체)
let mySubjects = [];             // 과목 목록
let allStudentsCache = [];       // 현재 학생 캐시
let totalStudentsCache = [];     // 전체 학생 캐시 (필터와 무관한 전체 고유 목록)
let myQuestionsCache = [];       // 학생 본인 질문 캐시
let myExamsCache = [];           // 학생 본인 시험 캐시
let tokenRefreshTimer = null;    // 로그인 세션 자동 연장 타이머
let isRefreshingToken = false;   // 토큰 갱신 중복 방지 플래그
let refreshPromise = null;       // 토큰 갱신 동시 요청 제어 프로미스

// 캘린더 상태
let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth();
let currentMonthSchedules = [];

// 정제된 SVG 아이콘 세트 (이모지 남용 배제)
const ICONS = {
    check: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px;"><polyline points="20 6 9 17 4 12"/></svg>`,
    clock: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    user: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    book: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
    calendar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    edit: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    trash: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
    bell: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`
};

// ==========================================
// 🚀 앱 초기화 및 이벤트 등록
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initServiceWorker();

    // 로그인 유지 체크박스 기본값 복원 (저장된 설정 없으면 기본 true)
    const rememberMeBox = document.getElementById('rememberMeCheckbox');
    if (rememberMeBox) {
        const savedPref = localStorage.getItem('tutoring_remember_me');
        rememberMeBox.checked = (savedPref === null || savedPref === 'true');
    }

    checkSession();

    // 1. 로그인 / 로그아웃
    document.getElementById('loginBtn')?.addEventListener('click', handleLogin);
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

    // 2. 탭 전환 이벤트 (메인 탭 & 서브 탭 & 하단 플로팅 독 & 가로 스와이프 제스처)
    setupTabs();
    setupSubTabs();
    setupBottomDock();
    setupInstagramSwipeNavigation();
    setTimeout(autoFitButtonText, 100);

    // 3. 알림 및 푸시 이벤트
    document.getElementById('enablePushBtn')?.addEventListener('click', requestPushPermission);
    document.getElementById('notificationBellBtn')?.addEventListener('click', toggleNotificationDropdown);
    document.getElementById('markAllReadBtn')?.addEventListener('click', markAllNotificationsAsRead);
    document.getElementById('modalMarkAllReadBtn')?.addEventListener('click', markAllNotificationsAsRead);
    syncPushNotificationState();

    // 외부 링크/푸시 알림 클릭으로 해시 진입 시 자동 탭 이동 및 스크롤
    if (window.location.hash) {
        setTimeout(() => {
            navigateToLink(window.location.hash);
        }, 600);
    }
    window.addEventListener('hashchange', () => {
        if (window.location.hash) {
            navigateToLink(window.location.hash);
        }
    });

    // 4. 선생님 대시보드 이벤트
    document.getElementById('createStudentBtn')?.addEventListener('click', handleCreateStudent);
    document.getElementById('uploadExamBtn')?.addEventListener('click', handleUploadExam);
    document.getElementById('sendFeedbackBtn')?.addEventListener('click', handleSendFeedback);
    document.getElementById('deleteStudentBtn')?.addEventListener('click', handleDeleteStudent);
    document.getElementById('openAddSubjectModalBtn')?.addEventListener('click', () => {
        renderModalSubjectList();
        openModal('addSubjectModal');
    });
    document.getElementById('saveSubjectBtn')?.addEventListener('click', handleCreateSubject);
    document.getElementById('enrollExistingStudentBtn')?.addEventListener('click', openEnrollModal);
    document.getElementById('saveEnrollmentBtn')?.addEventListener('click', handleSaveEnrollment);

    // 5. 캘린더 네비게이션 이벤트
    document.getElementById('prevMonthBtn')?.addEventListener('click', () => changeCalendarMonth(-1));
    document.getElementById('nextMonthBtn')?.addEventListener('click', () => changeCalendarMonth(1));
    document.getElementById('todayBtn')?.addEventListener('click', goToToday);
    document.getElementById('studentPrevMonthBtn')?.addEventListener('click', () => changeCalendarMonth(-1));
    document.getElementById('studentNextMonthBtn')?.addEventListener('click', () => changeCalendarMonth(1));
    document.getElementById('studentTodayBtn')?.addEventListener('click', goToToday);
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

    // 모달 및 바텀 시트 스와이프 제스처 & 닫기 초기화
    setupBottomSheetSwipeToDismiss();
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
                <div class="skeleton-line" style="width: 35%; height: 16px; margin-bottom: 12px;"></div>
                <div class="skeleton-line" style="width: 85%;"></div>
                <div class="skeleton-line" style="width: 60%;"></div>
            </div>
        `;
    }
    el.innerHTML = html;
}

function showLoading(containerId, message = '불러오는 중입니다...') {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `
        <div class="loading-box">
            <div class="spinner"></div>
            <span style="font-size:0.86rem; font-weight:500; color:var(--text-muted);">${escapeHtml(message)}</span>
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
// 🔐 JWT 인증 및 로그인 세션 자동 연장 로직
// ==========================================
async function tryRefreshToken() {
    if (!currentUser || !currentUser.refreshToken) return null;

    try {
        const res = await fetch('/api/refreshToken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: currentUser.refreshToken })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '토큰 갱신 실패');

        currentUser.token = data.token;
        if (data.refreshToken) currentUser.refreshToken = data.refreshToken;
        if (data.expiresAt) currentUser.expiresAt = data.expiresAt;
        if (data.user) currentUser.user = data.user;
        if (data.role) currentUser.role = data.role;
        if (data.name) currentUser.name = data.name;

        // 저장소에 갱신된 정보 동기화
        const storage = currentUser.rememberMe ? localStorage : sessionStorage;
        storage.setItem('tutoring_user_v2', JSON.stringify(currentUser));
        return data.token;
    } catch (err) {
        console.warn('Silent token refresh warning:', err);
        return null;
    }
}

function startTokenRefreshTimer() {
    if (tokenRefreshTimer) clearInterval(tokenRefreshTimer);
    // 로그인 유지(rememberMe)가 켜져 있고 refreshToken이 있는 경우 40분마다 백그라운드에서 자동 연장
    if (currentUser && currentUser.rememberMe && currentUser.refreshToken) {
        tokenRefreshTimer = setInterval(() => {
            tryRefreshToken();
        }, 40 * 60 * 1000);
    }
}

async function authFetch(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    if (currentUser && currentUser.token) {
        headers['Authorization'] = `Bearer ${currentUser.token}`;
    }

    let res = await fetch(url, {
        ...options,
        headers
    });

    // 401 Unauthorized 발생 시: 토큰 갱신 가능한 경우 백그라운드에서 자동 갱신 후 1회 재시도
    if (res.status === 401) {
        if (currentUser && currentUser.refreshToken) {
            if (!isRefreshingToken) {
                isRefreshingToken = true;
                refreshPromise = tryRefreshToken().finally(() => {
                    isRefreshingToken = false;
                });
            }
            const newToken = await refreshPromise;
            if (newToken) {
                const retryHeaders = {
                    ...headers,
                    'Authorization': `Bearer ${newToken}`
                };
                return fetch(url, {
                    ...options,
                    headers: retryHeaders
                });
            }
        }

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

// 푸시 알림 권한 및 UI 상태 동기화
async function syncPushNotificationState(isUserAction = false) {
    const enableBtn = document.getElementById('enablePushBtn');
    const modalBtn = document.getElementById('modalPushBtn');

    if (!('Notification' in window)) {
        if (enableBtn) enableBtn.classList.add('hidden');
        if (modalBtn) {
            modalBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                <span>이 기기는 푸시 미지원</span>
            `;
            modalBtn.disabled = true;
        }
        if (isUserAction) alert('이 브라우저/기기는 웹 푸시 알림을 지원하지 않습니다.');
        return;
    }

    const permission = Notification.permission;

    if (permission === 'granted') {
        // 이미 권한이 허용된 경우: 상단 '알림 켜기' 버튼 영구 숨김
        if (enableBtn) enableBtn.classList.add('hidden');
        localStorage.setItem('tutoring_push_permission', 'granted');

        if (modalBtn) {
            modalBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                <span style="color: #10b981; font-weight: 600;">웹 푸시 알림 허용됨 (정상 작동)</span>
            `;
            modalBtn.title = '이미 푸시 알림이 켜져 있습니다.';
        }

        // 백그라운드에서 조용히 푸시 구독 동기화 (alert 없이)
        silentRegisterPush();

        if (isUserAction) {
            alert('이미 푸시 알림이 정상적으로 허용되어 있습니다.');
        }
    } else if (permission === 'denied') {
        if (enableBtn) enableBtn.classList.add('hidden');
        if (modalBtn) {
            modalBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                <span style="color: #ef4444;">알림 차단됨 (설정에서 허용 필요)</span>
            `;
        }
        if (isUserAction) {
            alert('알림 권한이 차단되어 있습니다. 브라우저 또는 기기 설정에서 알림을 허용해 주세요.');
        }
    } else {
        // 'default' (아직 권한을 묻지 않은 상태)
        if (currentUser) {
            if (enableBtn) enableBtn.classList.remove('hidden');
        } else {
            if (enableBtn) enableBtn.classList.add('hidden');
        }
        if (modalBtn) {
            modalBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                <span>웹 푸시 알림 설정</span>
            `;
        }
    }
}

async function silentRegisterPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
        const registration = await navigator.serviceWorker.ready;
        const vapidRes = await authFetch('/api/push?action=vapid_public_key');
        if (!vapidRes.ok) return;
        const vapidData = await vapidRes.json();

        if (vapidData.publicKey) {
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey)
                });
            }

            if (subscription && currentUser) {
                await authFetch('/api/push', {
                    method: 'POST',
                    body: JSON.stringify({ action: 'subscribe', subscription })
                });
            }
        }
    } catch (err) {
        // 백그라운드 동기화 실패는 조용히 로그만 기록
        console.warn('푸시 백그라운드 등록 상태:', err.message);
    }
}

async function requestPushPermission() {
    if (!('Notification' in window)) {
        alert('이 브라우저는 웹 푸시 알림을 지원하지 않습니다.');
        return;
    }

    if (Notification.permission === 'granted') {
        syncPushNotificationState(true);
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            localStorage.setItem('tutoring_push_permission', 'granted');
            await silentRegisterPush();
            syncPushNotificationState();
            alert('웹 푸시 알림이 활성화되었습니다.');
        } else if (permission === 'denied') {
            syncPushNotificationState();
            alert('알림 권한이 거부되었습니다. 브라우저 설정에서 알림을 허용해 주세요.');
        } else {
            syncPushNotificationState();
        }
    } catch (err) {
        console.error('푸시 권한 요청 실패:', err);
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

// 알림 텍스트 정제 함수 (인위적인 AI 이모지 및 부자연스러운 문구를 깔끔하고 전문적인 서비스 알림 양식으로 변환)
function formatNotificationText(text) {
    if (!text || typeof text !== 'string') return '';
    let cleaned = text
        .replace(/\p{Extended_Pictographic}/gu, '')
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}-\u{2B55}\u{203C}-\u{2049}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{FE0F}]/gu, '')
        .replace(/!\s*$/, '.')
        .replace(/\s+/g, ' ')
        .trim();

    // 기존 DB에 저장되어 있던 레거시 문구들도 깔끔한 규격으로 자동 마이그레이션
    if (cleaned.startsWith('새 질문 도착')) {
        const m = cleaned.match(/\((.*?)\s*학생\)/);
        const name = m ? m[1] : '';
        cleaned = name ? `[새 질문] ${name} 학생의 질문이 등록되었습니다.` : '[새 질문] 새로운 질문이 등록되었습니다.';
    } else if (cleaned.includes('선생님의 풀이 답변이 등록되었습니다')) {
        cleaned = '[풀이 완료] 질문하신 문제의 풀이 답변이 등록되었습니다.';
    } else if (cleaned.includes('오늘의 과외 일지') || cleaned.includes('피드백)가 도착')) {
        cleaned = '[과외 일지] 오늘의 수업 피드백이 등록되었습니다.';
    } else if (cleaned.includes('새로운 시험 성적이 등록되었습니다')) {
        cleaned = '[성적 등록] 새로운 시험 결과가 등록되었습니다.';
    } else if (cleaned.includes('새로운 수업 일정이 등록되었습니다')) {
        cleaned = '[수업 일정] 새로운 수업 일정이 등록되었습니다.';
    }

    return cleaned;
}

function showToast(title, body) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const cleanTitle = formatNotificationText(title);
    const cleanBody = formatNotificationText(body);

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <div class="toast-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </div>
        <div class="toast-body-wrap">
            <div class="toast-title">${escapeHtml(cleanTitle)}</div>
            <div class="toast-desc">${escapeHtml(cleanBody)}</div>
        </div>
        <button type="button" class="toast-close-btn" aria-label="닫기">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
    `;

    let dismissed = false;
    const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        toast.classList.add('toast-dismissing');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 260);
    };

    // 토스트 본체 탭 시 부드럽게 닫기
    toast.addEventListener('click', dismiss);

    // 닫기 버튼 전용 클릭 시 이벤트 전파 차단 후 닫기
    const closeBtn = toast.querySelector('.toast-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dismiss();
        });
    }

    container.appendChild(toast);

    setTimeout(() => {
        dismiss();
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
            document.title = `(${unreadCount}) 과외노트 v2.0`;
        } else {
            document.title = '과외노트 v2.0';
        }

        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        const teacherBadge = document.getElementById('teacherNotifBadge');
        const studentBadge = document.getElementById('studentNotifBadge');
        [teacherBadge, studentBadge].forEach(dockBadge => {
            if (!dockBadge) return;
            if (unreadCount > 0) {
                dockBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                dockBadge.classList.remove('hidden');
            } else {
                dockBadge.classList.add('hidden');
            }
        });

        const modalContainer = document.getElementById('modalNotificationList');
        const modalBadge = document.getElementById('modalNotifCountBadge');
        const teacherMyPageContainer = document.getElementById('teacherMyPageNotifList');
        const studentMyPageContainer = document.getElementById('studentMyPageNotifList');
        const teacherMyPageBadge = document.getElementById('teacherMyPageNotifBadge');
        const studentMyPageBadge = document.getElementById('studentMyPageNotifBadge');
        const teacherTopNotifBadge = document.getElementById('teacherTopNotifBadge');
        const studentTopNotifBadge = document.getElementById('studentTopNotifBadge');

        [modalBadge, teacherMyPageBadge, studentMyPageBadge, teacherTopNotifBadge, studentTopNotifBadge].forEach(badgeEl => {
            if (!badgeEl) return;
            if (unreadCount > 0) {
                badgeEl.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badgeEl.classList.remove('hidden');
            } else {
                badgeEl.classList.add('hidden');
            }
        });

        if (list.length === 0) {
            const emptyHtml = '<div class="empty-hint" style="padding:16px 0; font-size:0.84rem;">새로운 알림이 없습니다.</div>';
            container.innerHTML = '<div class="empty-hint">새로운 알림이 없습니다.</div>';
            if (modalContainer) modalContainer.innerHTML = emptyHtml;
            if (teacherMyPageContainer) teacherMyPageContainer.innerHTML = emptyHtml;
            if (studentMyPageContainer) studentMyPageContainer.innerHTML = emptyHtml;
            return;
        }

        const itemsHtml = list.map(item => {
            const displayTitle = formatNotificationText(item.title);
            const displayBody = formatNotificationText(item.body);
            return `
            <div class="notification-item unread" style="display:flex; justify-content:space-between; align-items:flex-start; padding: 12px 14px; margin-bottom: 8px; border-radius: var(--radius-sm); background: var(--bg-surface); border: 1px solid var(--border-color); box-shadow: var(--shadow-xs);">
                <div style="flex: 1; cursor: pointer;" onclick="handleNotificationClick(${item.id}, '${escapeHtml(item.link || '')}')">
                    <div style="font-weight: 700; color: var(--text-primary); font-size: 0.9rem;">${escapeHtml(displayTitle)}</div>
                    <div style="color: var(--text-secondary); font-size: 0.84rem; margin-top: 3px; line-height: 1.4;">${escapeHtml(displayBody)}</div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 5px;">${new Date(item.created_at).toLocaleString()}</div>
                </div>
                <button class="danger-link-btn" style="padding: 3px 8px; font-size: 0.9rem; line-height: 1; margin-left: 8px;" onclick="handleNotificationClick(${item.id})" title="알림 확인 및 삭제">✕</button>
            </div>
            `;
        }).join('');

        container.innerHTML = itemsHtml;
        if (modalContainer) modalContainer.innerHTML = itemsHtml;
        if (teacherMyPageContainer) teacherMyPageContainer.innerHTML = itemsHtml;
        if (studentMyPageContainer) studentMyPageContainer.innerHTML = itemsHtml;
    } catch (err) {
        console.error('알림 로드 실패:', err);
    }
}

window.handleNotificationClick = async function(id, link) {
    try {
        await authFetch('/api/push', {
            method: 'POST',
            body: JSON.stringify({ action: 'mark_read', id })
        });
    } catch (e) {}

    // 모달 및 드롭다운 닫기
    closeModal('accountProfileModal');
    document.getElementById('notificationDropdown')?.classList.add('hidden');

    // 해당 콘텐츠 링크로 즉시 이동
    if (link) {
        navigateToLink(link);
    }

    loadNotifications();
};

// 🧭 알림 링크(해시 및 탭) 자동 네비게이션 함수
function navigateToLink(link) {
    if (!link || !currentUser) return;
    const isTeacher = (currentUser.role === 'admin' || currentUser.role === 'teacher');

    if (link.includes('CalendarTab') || link.includes('calendar')) {
        switchMainTab(isTeacher ? 'teacherCalendarTab' : 'studentCalendarTab');
    } else if (link.includes('question-')) {
        const questionId = link.split('question-')[1];
        if (isTeacher) {
            switchMainTab('teacherQnaTab');
        } else {
            switchMainTab('studentStudyTab');
        }

        setTimeout(() => {
            const el = document.getElementById(`question-${questionId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.4)';
                el.style.transition = 'box-shadow 0.4s ease';
                setTimeout(() => { el.style.boxShadow = ''; }, 2500);
            }
        }, 350);
    } else if (link.includes('feedback')) {
        if (!isTeacher) {
            switchMainTab('studentReportTab');
            setTimeout(() => {
                document.getElementById('myFeedbackList')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
        }
    } else if (link.includes('exam')) {
        if (!isTeacher) {
            switchMainTab('studentReportTab');
            setTimeout(() => {
                document.getElementById('myExamList')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
        }
    }
}

async function markAllNotificationsAsRead() {
    await authFetch('/api/push', {
        method: 'POST',
        body: JSON.stringify({ action: 'mark_all_read' })
    });
    loadNotifications();
}

// 🔔 상단 알림 벨 클릭 핸들러 (인라인 onclick 및 리스너 공용)
window.handleBellClick = function(e) {
    if (e) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }

    // 📱 모바일 환경(768px 이하 또는 독 활성화)에서는 헤더 종 버튼 클릭 시
    // 마이페이지 (알림 센터) 화면으로 즉시 전환
    if (window.innerWidth <= 768 || document.body.classList.contains('has-dock')) {
        const isTeacher = (currentUser?.role === 'admin' || currentUser?.role === 'teacher');
        switchMainTab(isTeacher ? 'teacherProfileTab' : 'studentProfileTab');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    const dropdown = document.getElementById('notificationDropdown');
    dropdown?.classList.toggle('hidden');
    if (!dropdown?.classList.contains('hidden')) {
        loadNotifications();
    }
};

function toggleNotificationDropdown(e) {
    window.handleBellClick(e);
}

document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notificationDropdown');
    const bell = document.getElementById('notificationBellBtn');
    if (dropdown && !dropdown.contains(e.target) && e.target !== bell && !bell?.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

// ==========================================
// 📑 메인 및 서브 탭 네비게이션 & 하단 독 네비게이션
// ==========================================
// 🌟 iOS 스타일 유체 슬라이딩 액티브 인디케이터 계산 및 부드러운 이동 함수
function moveDockIndicator(dockId, activeBtn) {
    const dock = document.getElementById(dockId);
    if (!dock || !activeBtn) return;
    const indicator = dock.querySelector('.dock-sliding-pill');
    const dockInner = dock.querySelector('.bottom-dock-inner');
    if (!indicator || !dockInner) return;

    dock.querySelectorAll('.dock-item:not(.dock-action-item)').forEach(item => {
        item.classList.remove('active');
    });
    activeBtn.classList.add('active');

    if (dock.offsetParent === null && window.innerWidth > 768) return;

    const innerRect = dockInner.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();

    let leftOffset = btnRect.left - innerRect.left;
    let width = btnRect.width;

    if (width === 0) {
        leftOffset = activeBtn.offsetLeft;
        width = activeBtn.offsetWidth;
    }

    if (width > 0) {
        indicator.style.width = `${width}px`;
        indicator.style.transform = `translateX(${leftOffset}px)`;
        indicator.classList.add('ready');
    }
}

// 🌟 iOS / Toss 스타일 세그먼트형 상단 탭 유체 슬라이딩 인디케이터 계산 및 애니메이션 함수
function moveTabIndicator(tabBar, activeBtn, animate = true) {
    if (!tabBar || !activeBtn) return;
    let indicator = tabBar.querySelector('.tab-sliding-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'tab-sliding-indicator';
        tabBar.prepend(indicator);
    }

    const barRect = tabBar.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();

    let leftOffset = btnRect.left - barRect.left;
    let width = btnRect.width;

    if (width === 0 || barRect.width === 0) {
        leftOffset = activeBtn.offsetLeft;
        width = activeBtn.offsetWidth;
    }

    if (!animate) {
        indicator.style.transition = 'none';
    }

    if (width > 0) {
        indicator.style.width = `${width}px`;
        indicator.style.transform = `translateX(${leftOffset}px)`;
        indicator.classList.add('ready');
    }

    if (!animate) {
        requestAnimationFrame(() => {
            setTimeout(() => {
                indicator.style.transition = '';
            }, 50);
        });
    }
}

function updateAllTabIndicators(animate = false) {
    document.querySelectorAll('.tab-bar').forEach(bar => {
        if (bar.offsetParent !== null) {
            const activeBtn = bar.querySelector('.tab-btn.active');
            if (activeBtn) moveTabIndicator(bar, activeBtn, animate);
        }
    });
    document.querySelectorAll('.qna-filter-bar').forEach(bar => {
        if (bar.offsetParent !== null) {
            const activeBtn = bar.querySelector('.qna-filter-btn.active');
            if (activeBtn) moveTabIndicator(bar, activeBtn, animate);
        }
    });
}

// 창 크기 변경 시 모든 활성 탭 인디케이터 위치 재조정
window.addEventListener('resize', () => {
    updateAllTabIndicators(false);
});

// ==========================================
// 📱 기기별/화면 크기별 버튼 텍스트 자동 크기 최적화 (Auto-fit font size to container box)
// ==========================================
function autoFitButtonText() {
    const selector = '.outline-btn-sm, .primary-btn-sm, .danger-btn-sm, .small-btn, .section-header-inline button';
    document.querySelectorAll(selector).forEach(btn => {
        btn.style.fontSize = '';
        btn.style.whiteSpace = 'nowrap';

        // 텍스트 너비가 버튼의 가용 너비(clientWidth)를 초과할 경우 한 줄로 맞춰지도록 폰트 크기 미세 조절
        if (btn.scrollWidth > btn.clientWidth && btn.clientWidth > 0) {
            let currentSize = parseFloat(window.getComputedStyle(btn).fontSize);
            let loops = 0;
            while (btn.scrollWidth > btn.clientWidth && currentSize > 9.5 && loops < 12) {
                currentSize -= 0.5;
                btn.style.fontSize = `${currentSize}px`;
                loops++;
            }
        }
    });
}

// 📑 메인 탭 통합 전환 함수 (상단 탭 바 + 하단 독 + 가로 뷰페이저 트랙 공용)
function switchMainTab(targetId, animate = true) {
    if (!targetId || !currentUser) return;
    const isTeacher = (currentUser.role === 'admin' || currentUser.role === 'teacher');
    const dashboardId = isTeacher ? 'teacherDashboard' : 'studentDashboard';
    const dockId = isTeacher ? 'teacherBottomDock' : 'studentBottomDock';

    const tabList = isTeacher 
        ? ['teacherClassTab', 'teacherCalendarTab', 'teacherQnaTab', 'teacherProfileTab']
        : ['studentStudyTab', 'studentCalendarTab', 'studentReportTab', 'studentProfileTab'];

    const dockMap = isTeacher
        ? {
            'teacherClassTab': 'dockTeacherStudents',
            'teacherCalendarTab': 'dockTeacherCalendar',
            'teacherQnaTab': 'dockTeacherQna',
            'teacherProfileTab': 'dockTeacherProfile'
        }
        : {
            'studentStudyTab': 'dockStudentHome',
            'studentCalendarTab': 'dockStudentCalendar',
            'studentReportTab': 'dockStudentReport',
            'studentProfileTab': 'dockStudentProfile'
        };

    const targetIdx = tabList.indexOf(targetId);
    if (targetIdx === -1) return;

    const trackId = isTeacher ? 'teacherTabTrack' : 'studentTabTrack';
    const track = document.getElementById(trackId);
    const shouldAnimate = (animate !== false);

    // 1. 모바일 트랙 뷰페이저 가로 이동 (4개 탭 기준: 1개당 25%)
    if (track) {
        if (track._transitionTimeout) {
            clearTimeout(track._transitionTimeout);
            track._transitionTimeout = null;
        }

        if (shouldAnimate) {
            track.classList.add('is-transitioning');
            track.style.transition = 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)';
            track.style.transform = `translate3d(-${targetIdx * 25}%, 0, 0)`;

            track._transitionTimeout = setTimeout(() => {
                track.classList.remove('is-transitioning');
                track._transitionTimeout = null;
            }, 330);
        } else {
            track.classList.remove('is-transitioning');
            track.style.transition = 'none';
            track.style.transform = `translate3d(-${targetIdx * 25}%, 0, 0)`;
        }
    }

    // 2. 탭 페이지 active 클래스 동기화 (데스크톱 및 비활성 페이지 높이 제어용)
    tabList.forEach(id => {
        const page = document.getElementById(id);
        if (page) {
            page.classList.toggle('active-tab-page', id === targetId);
            page.classList.remove('hidden', 'tab-slide-right', 'tab-slide-left');
        }
    });

    // 3. 상단 탭 바 (Segmented Control) 활성 상태 및 유체 인디케이터 동기화
    const tabBar = document.querySelector(`#${dashboardId} .tab-bar`);
    if (tabBar) {
        tabBar.querySelectorAll('.tab-btn').forEach(btn => {
            const isMatch = (btn.getAttribute('data-target') === targetId);
            btn.classList.toggle('active', isMatch);
            if (isMatch) {
                moveTabIndicator(tabBar, btn, shouldAnimate);
            }
        });
    }

    // 4. 하단 플로팅 독 활성 상태 및 인디케이터 동기화
    const dockBtnId = dockMap[targetId];
    if (dockBtnId) {
        const dockBtn = document.getElementById(dockBtnId);
        if (dockBtn) {
            moveDockIndicator(dockId, dockBtn);
        }
    }

    // 5. 탭별 비동기 데이터 갱신
    if (targetId.includes('Calendar')) {
        renderCalendar();
    } else if (targetId === 'teacherQnaTab') {
        loadAllTeacherQuestions();
    } else if (targetId === 'studentReportTab') {
        loadMyExams();
        loadMyFeedbacks();
    } else if (targetId === 'studentStudyTab') {
        loadMyQuestions();
    } else if (targetId === 'teacherProfileTab' || targetId === 'studentProfileTab') {
        renderMyPage();
    }
}

function setupTabs() {
    document.querySelectorAll('.tab-bar').forEach(bar => {
        // 인디케이터 엘리먼트 보장
        if (!bar.querySelector('.tab-sliding-indicator')) {
            const ind = document.createElement('div');
            ind.className = 'tab-sliding-indicator';
            bar.prepend(ind);
        }

        bar.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-target');
                if (targetId) {
                    switchMainTab(targetId, 'auto');
                }
            });
        });

        // 초기 인디케이터 위치 세팅
        const initialActive = bar.querySelector('.tab-btn.active');
        if (initialActive) {
            setTimeout(() => moveTabIndicator(bar, initialActive, false), 80);
        }
    });
}

function setupSubTabs() {
    document.querySelectorAll('.sub-tab-bar').forEach(bar => {
        bar.querySelectorAll('.sub-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                bar.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const targetId = btn.getAttribute('data-subtarget');

                // 해당 서브 탭 바가 관리하는 서브 탭들만 숨김 처리
                bar.querySelectorAll('.sub-tab-btn').forEach(b => {
                    const tid = b.getAttribute('data-subtarget');
                    if (tid) document.getElementById(tid)?.classList.add('hidden');
                });

                const targetTab = document.getElementById(targetId);
                if (targetTab) targetTab.classList.remove('hidden');

                // 선생님 독 탭 동기화
                if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'teacher')) {
                    if (targetId === 'studentQuestionsTab') {
                        const qnaBtn = document.getElementById('dockTeacherQna');
                        if (qnaBtn) moveDockIndicator('teacherBottomDock', qnaBtn);
                    } else {
                        const stuBtn = document.getElementById('dockTeacherStudents');
                        if (stuBtn) moveDockIndicator('teacherBottomDock', stuBtn);
                    }
                }
            });
        });
    });
}

function setupBottomDock() {
    setupTeacherBottomDock();
    setupStudentBottomDock();

    // 프로필 모달 공통 버튼 이벤트
    document.getElementById('modalPushBtn')?.addEventListener('click', () => {
        closeModal('accountProfileModal');
        requestPushPermission();
    });

    document.getElementById('modalPasswordBtn')?.addEventListener('click', () => {
        closeModal('accountProfileModal');
        document.querySelector('#studentDashboard .tab-btn[data-target="studentStudyTab"]')?.click();
        const homeBtn = document.getElementById('dockStudentHome');
        if (homeBtn) moveDockIndicator('studentBottomDock', homeBtn);

        const form = document.getElementById('passwordFormContainer');
        form?.classList.remove('hidden-form');
        const passInput = document.getElementById('newPassword');
        if (passInput) {
            passInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => passInput.focus(), 350);
        }
    });

    document.getElementById('modalLogoutBtn')?.addEventListener('click', () => {
        closeModal('accountProfileModal');
        handleLogout();
    });

    // 화면 회전이나 리사이즈 시 활성 인디케이터 위치 재계산 및 버튼 폰트 크기 최적화
    window.addEventListener('resize', () => {
        if (currentUser) {
            const isTeacher = (currentUser.role === 'admin' || currentUser.role === 'teacher');
            const dockId = isTeacher ? 'teacherBottomDock' : 'studentBottomDock';
            const activeBtn = document.querySelector(`#${dockId} .dock-item.active`);
            if (activeBtn) moveDockIndicator(dockId, activeBtn);
        }
        autoFitButtonText();
    });
}

// 👨‍🏫 1. 선생님 전용 하단 독 네비게이션
function setupTeacherBottomDock() {
    // 1. 학생·과목 관리
    document.getElementById('dockTeacherStudents')?.addEventListener('click', () => {
        switchMainTab('teacherClassTab');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 2. 수업 캘린더
    document.getElementById('dockTeacherCalendar')?.addEventListener('click', () => {
        switchMainTab('teacherCalendarTab');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 3. 중앙 빠른 추가 액션 (+) - 모달 열기 (스와이프 순서에서는 제외)
    document.getElementById('dockTeacherQuick')?.addEventListener('click', () => {
        openModal('teacherQuickActionModal');
    });

    // 빠른 작업 모달 내 액션들
    document.getElementById('quickAddScheduleBtn')?.addEventListener('click', () => {
        closeModal('teacherQuickActionModal');
        openScheduleModal();
    });

    document.getElementById('quickManageScheduleBtn')?.addEventListener('click', () => {
        closeModal('teacherQuickActionModal');
        switchMainTab('teacherCalendarTab');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.getElementById('quickAddSubjectBtn')?.addEventListener('click', () => {
        closeModal('teacherQuickActionModal');
        renderModalSubjectList();
        openModal('addSubjectModal');
    });

    // 4. 질문 풀이 (Q&A)
    document.getElementById('dockTeacherQna')?.addEventListener('click', () => {
        switchMainTab('teacherQnaTab');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 5. 마이페이지 (내 정보 및 알림 센터)
    document.getElementById('dockTeacherProfile')?.addEventListener('click', () => {
        switchMainTab('teacherProfileTab');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// 🧑‍🎓 2. 학생 전용 하단 독 네비게이션
function setupStudentBottomDock() {
    // 1. 홈 / 내 학습
    document.getElementById('dockStudentHome')?.addEventListener('click', () => {
        switchMainTab('studentStudyTab');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 2. 내 캘린더
    document.getElementById('dockStudentCalendar')?.addEventListener('click', () => {
        switchMainTab('studentCalendarTab');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 3. 중앙 질문하기 (+) - 전용 바텀 시트 모달 호출 (선생님 페이지처럼 팝업)
    document.getElementById('dockStudentAsk')?.addEventListener('click', () => {
        openStudentAskModal();
    });

    // 4. 성적 & 일지 리포트
    document.getElementById('dockStudentReport')?.addEventListener('click', () => {
        switchMainTab('studentReportTab');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 5. 마이페이지 (내 계정 & 알림)
    document.getElementById('dockStudentProfile')?.addEventListener('click', () => {
        switchMainTab('studentProfileTab');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// 📱 인스타그램 스타일 실시간 1:1 터치 추적 및 스프링 스냅 가로 스와이프 제스처 네비게이션
function setupInstagramSwipeNavigation() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let currentIdx = 0;
    let trackWidth = 0;
    let isTracking = false;
    let isSwiping = false;
    let directionLocked = null; // null | 'horizontal' | 'vertical' | 'child-scroll'
    let activeTrack = null;
    let activeTabList = [];
    let wasSwiping = false;
    let touchStartTarget = null;

    // 1. 스와이프 제스처 직후 손가락을 뗄 때 박스/버튼/입력창의 원치 않는 오발 클릭 및 포커스를 100% 캡처하여 차단
    window.addEventListener('click', (e) => {
        if (wasSwiping) {
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();
        }
    }, true);

    window.addEventListener('focusin', (e) => {
        if (wasSwiping || isSwiping) {
            if (e.target && typeof e.target.blur === 'function') {
                e.target.blur();
            }
        }
    }, true);

    // 2. 가로 스크롤 가능한 내부 자식 요소(과목 칩 등) 여부 및 여유 스크롤 공간 지능형 판별 함수
    function canElementScrollHorizontally(target, deltaX) {
        let el = target;
        while (el && el !== document.body && el !== document.documentElement) {
            if (el.classList.contains('tab-page') || el.classList.contains('tab-track') || el.classList.contains('tab-viewport')) {
                break;
            }
            // 오직 과목 칩 리스트나 가로 서브 탭 등 명시적인 가로 스크롤 컨테이너만 체크
            if (el.classList.contains('subject-chip-list') || el.classList.contains('sub-tab-bar') || el.hasAttribute('data-horizontal-scroll')) {
                const maxScroll = el.scrollWidth - el.clientWidth;
                if (maxScroll > 10) {
                    // 왼쪽으로 스와이프 (손가락 좌측 이동 -> 컨텐츠 우측으로 스크롤)
                    if (deltaX < 0 && el.scrollLeft < maxScroll - 4) {
                        return true;
                    }
                    // 오른쪽으로 스와이프 (손가락 우측 이동 -> 컨텐츠 좌측으로 스크롤)
                    if (deltaX > 0 && el.scrollLeft > 4) {
                        return true;
                    }
                }
            }
            el = el.parentElement;
        }
        return false;
    }

    // 3. 진짜 스와이프에서 제외해야 할 대상 (오직 열려있는 팝업 모달창 및 라이트박스 뷰어 내부만 제외)
    // 텍스트 입력창(input, textarea) 위에서도 탭(클릭)이 아닌 가로 스와이프 시 자연스럽게 탭 전환이 동작하도록 포함
    const STRICT_EXCLUDED_SELECTORS = '.modal-overlay:not(.hidden), .image-lightbox-modal:not(.hidden)';

    window.addEventListener('touchstart', (e) => {
        // 모바일 화면(768px 이하) 및 로그인 상태에서만 동작
        if (window.innerWidth > 768 || !currentUser) return;

        touchStartTarget = e.target;

        // 열려있는 모달창이나 라이트박스 뷰어 내부 터치 시에만 스와이프 제외 (그 외 모든 카드, 박스, 입력창은 스와이프 허용)
        if (touchStartTarget.closest(STRICT_EXCLUDED_SELECTORS)) return;

        const isTeacher = (currentUser.role === 'admin' || currentUser.role === 'teacher');
        activeTabList = isTeacher 
            ? ['teacherClassTab', 'teacherCalendarTab', 'teacherQnaTab', 'teacherProfileTab']
            : ['studentStudyTab', 'studentCalendarTab', 'studentReportTab', 'studentProfileTab'];

        const trackId = isTeacher ? 'teacherTabTrack' : 'studentTabTrack';
        activeTrack = document.getElementById(trackId);
        if (!activeTrack) return;

        // 진행 중이던 애니메이션 타임아웃 해제
        if (activeTrack._transitionTimeout) {
            clearTimeout(activeTrack._transitionTimeout);
            activeTrack._transitionTimeout = null;
        }
        activeTrack.classList.remove('is-transitioning');

        // 현재 활성 탭 인덱스 찾기
        currentIdx = activeTabList.findIndex(id => {
            const el = document.getElementById(id);
            return el && el.classList.contains('active-tab-page');
        });
        if (currentIdx === -1) currentIdx = 0;

        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchStartTime = Date.now();
        trackWidth = activeTrack.parentElement ? activeTrack.parentElement.clientWidth : window.innerWidth;
        isTracking = true;
        isSwiping = false;
        directionLocked = null;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (!isTracking || !activeTrack || e.touches.length > 1) return;

        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStartX;
        const deltaY = touch.clientY - touchStartY;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        // 제스처 방향 판별 단계 (지능형 각도 & 엄지손가락 자연 곡률 판별: 박스 및 입력창 위에서도 부드럽게 감지)
        if (!directionLocked) {
            if (absX < 6 && absY < 6) {
                return; // 미세한 초기 터치 떨림 무시
            }

            // 가로 이동이 감지되고 엄지 대각선 곡률을 만족할 때 (가로가 세로의 0.65배 이상)
            if (absX >= 6 && absX > absY * 0.65) {
                // 내부 가로 스크롤 가능 여부 체크 (칩 목록 등)
                if (canElementScrollHorizontally(touchStartTarget, deltaX)) {
                    directionLocked = 'child-scroll';
                    isTracking = false;
                    return;
                }
                // 수평 탭 스와이프로 즉시 잠금
                directionLocked = 'horizontal';
                isSwiping = true;
                activeTrack.classList.add('is-swiping');
            } else if (absY >= 9 && absY > absX * 1.4) {
                // 명백한 세로 스크롤 의도 -> 브라우저 네이티브 세로 스크롤에 온전히 양보
                directionLocked = 'vertical';
                isTracking = false;
                return;
            } else {
                return; // 방향이 명확하지 않은 경우 추가 관찰
            }
        }

        if (directionLocked === 'horizontal' && isSwiping) {
            // 수평 스와이프 중에는 브라우저 세로 스크롤 완벽 차단
            if (e.cancelable) {
                e.preventDefault();
            }

            // 가로 스와이프 진행 중인 경우, 활성화된 입력창(키보드)이 있다면 즉시 블러하여 닫기
            if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT')) {
                document.activeElement.blur();
            }
            if (touchStartTarget && typeof touchStartTarget.blur === 'function') {
                touchStartTarget.blur();
            }

            // 인스타그램 스타일 실시간 1:1 트랙 이동 계산
            const basePercent = -(currentIdx * 25);
            let shiftPercent = (deltaX / trackWidth) * 25;

            // 경계선(첫 번째 탭에서 오른쪽으로 당김 or 마지막 탭에서 왼쪽으로 당김) 고무줄 탄성 저항
            const isLeftEdge = (currentIdx === 0 && deltaX > 0);
            const isRightEdge = (currentIdx === activeTabList.length - 1 && deltaX < 0);
            if (isLeftEdge || isRightEdge) {
                shiftPercent *= 0.28; // 탄성 저항 계수
            }

            const currentPercent = basePercent + shiftPercent;
            activeTrack.style.transform = `translate3d(${currentPercent}%, 0, 0)`;
        }
    }, { passive: false });

    const handleTouchEnd = (e) => {
        if (!isTracking || !activeTrack) return;
        isTracking = false;

        if (!isSwiping || directionLocked !== 'horizontal') {
            return;
        }
        isSwiping = false;
        activeTrack.classList.remove('is-swiping');

        // 스와이프 완료 직후 발생하는 클릭/포커스 이벤트를 250ms 동안 차단하여 카드/버튼/입력창 오작동 방지
        wasSwiping = true;
        setTimeout(() => { wasSwiping = false; }, 250);

        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT')) {
            document.activeElement.blur();
        }
        if (touchStartTarget && typeof touchStartTarget.blur === 'function') {
            touchStartTarget.blur();
        }

        const touch = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
        const deltaX = touch ? (touch.clientX - touchStartX) : 0;
        const duration = Math.max(Date.now() - touchStartTime, 1);
        const velocity = Math.abs(deltaX) / duration; // px/ms
        const distanceRatio = Math.abs(deltaX) / trackWidth;

        // 탭 전환 판단 조건:
        // 1. 빠른 튕기기(Flick): 속도 0.28px/ms 이상 & 24px 이상 이동
        // 2. 충분한 드래그(Drag): 화면 너비의 16% 이상 이동
        let targetIdx = currentIdx;
        const isFlick = (velocity > 0.28 && Math.abs(deltaX) > 24);
        const isDragPass = (distanceRatio > 0.16);

        if (isFlick || isDragPass) {
            if (deltaX < 0 && currentIdx < activeTabList.length - 1) {
                targetIdx = currentIdx + 1; // 왼쪽으로 넘김 -> 다음 탭
            } else if (deltaX > 0 && currentIdx > 0) {
                targetIdx = currentIdx - 1; // 오른쪽으로 넘김 -> 이전 탭
            }
        }

        // 새 탭으로 스프링 스냅 전환 또는 제자리로 탄성 복귀
        switchMainTab(activeTabList[targetIdx], true);

        // 탭이 실제로 바뀌었다면 상단으로 부드럽게 스크롤 정렬
        if (targetIdx !== currentIdx && window.scrollY > 80) {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
    };

    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });
}

// 📊 전체 담당 학생 수 계산 함수 (중복 제거된 고유 학생 수)
function getTotalStudentCount() {
    if (Array.isArray(totalStudentsCache) && totalStudentsCache.length > 0) {
        return totalStudentsCache.length;
    }
    if (Array.isArray(mySubjects) && mySubjects.length > 0) {
        const studentSet = new Set();
        mySubjects.forEach(s => {
            if (Array.isArray(s.enrollments)) {
                s.enrollments.forEach(e => {
                    if (e && e.student_id) studentSet.add(e.student_id);
                });
            }
        });
        if (studentSet.size > 0) return studentSet.size;
    }
    return Array.isArray(allStudentsCache) ? allStudentsCache.length : 0;
}

// 📊 전체 답변 대기 질문 수 계산 함수
function getTotalUnansweredCount() {
    if (Array.isArray(teacherAllQuestionsCache) && teacherAllQuestionsCache.length > 0) {
        return teacherAllQuestionsCache.filter(q => !(q.is_answered || (q.answer_text && q.answer_text.trim() !== ''))).length;
    }
    const badge = document.getElementById('badgeUnansweredCount');
    if (badge && badge.textContent && badge.textContent !== '0') {
        const parsed = parseInt(badge.textContent, 10);
        if (!isNaN(parsed)) return parsed;
    }
    return 0;
}

// 📱 마이페이지 실시간 데이터 렌더링 함수
function renderMyPage() {
    if (!currentUser) return;
    const isTeacher = (currentUser.role === 'admin' || currentUser.role === 'teacher');

    if (isTeacher) {
        const nameEl = document.getElementById('teacherMyPageName');
        const idEl = document.getElementById('teacherMyPageId');
        if (nameEl) nameEl.textContent = `${currentUser.name} 선생님`;

        let displayId = currentUser.login_id || currentUser.user || 'admin';
        if (typeof displayId === 'object' && displayId.email) displayId = displayId.email.replace('@tutor.com', '');
        if (idEl) idEl.textContent = `아이디: @${displayId}`;

        // 1. 개설 과목 수 통계 (전체 과목 칩 제외, 순수 과목 배열 길이)
        const subStat = document.getElementById('teacherStatSubjects');
        if (subStat) subStat.textContent = Array.isArray(mySubjects) ? mySubjects.length : 0;

        // 2. 담당 학생 수 통계 (고유 담당 학생 수)
        const stuStat = document.getElementById('teacherStatStudents');
        if (stuStat) stuStat.textContent = getTotalStudentCount();

        // 학생 목록이 아직 로드되지 않은 상태라면 비동기 로드 후 즉시 동기화
        if (!allStudentsCache || allStudentsCache.length === 0) {
            loadStudents().then(() => {
                if (stuStat) stuStat.textContent = getTotalStudentCount();
            });
        }

        // 3. 답변 대기 질문 수 통계
        const unansStat = document.getElementById('teacherStatUnanswered');
        if (unansStat) unansStat.textContent = getTotalUnansweredCount();

        // 질문 목록이 아직 캐싱되지 않은 상태라면 비동기 로드 후 통계 갱신
        if (!teacherAllQuestionsCache || teacherAllQuestionsCache.length === 0) {
            loadAllTeacherQuestions().then(() => {
                if (unansStat) unansStat.textContent = getTotalUnansweredCount();
            });
        }

        updateMyPagePushStatus('teacher');
    } else {
        const nameEl = document.getElementById('studentMyPageName');
        const idEl = document.getElementById('studentMyPageId');
        if (nameEl) nameEl.textContent = `${currentUser.name} 학생`;

        let displayId = currentUser.login_id || currentUser.user || currentUser.id || 'student';
        if (typeof displayId === 'object' && displayId.email) displayId = displayId.email.replace('@tutor.com', '');
        if (idEl) idEl.textContent = `아이디: @${displayId}`;

        // 1. 수강 과목 수 통계 (전체 과목 칩 제외, 순수 과목 배열 길이)
        const subStat = document.getElementById('studentStatSubjects');
        if (subStat) subStat.textContent = Array.isArray(mySubjects) ? mySubjects.length : 0;

        // 2. 질문 수 통계
        const qList = document.getElementById('myQuestionList');
        const qCount = Array.isArray(myQuestionsCache) && myQuestionsCache.length > 0 
            ? myQuestionsCache.length 
            : (qList ? qList.querySelectorAll('.feed-card, .feed-item').length : 0);
        const qStat = document.getElementById('studentStatQuestions');
        if (qStat) qStat.textContent = qCount;

        // 3. 시험 수 통계
        const examList = document.getElementById('myExamList');
        const examCount = Array.isArray(myExamsCache) && myExamsCache.length > 0 
            ? myExamsCache.length 
            : (examList ? examList.querySelectorAll('.feed-card, .feed-item').length : 0);
        const examStat = document.getElementById('studentStatExams');
        if (examStat) examStat.textContent = examCount;

        updateMyPagePushStatus('student');
    }

    loadNotifications();
}

function updateMyPagePushStatus(role) {
    const descId = role === 'teacher' ? 'teacherPushDesc' : 'studentPushDesc';
    const btnId = role === 'teacher' ? 'teacherPushBtn' : 'studentPushBtn';
    const descEl = document.getElementById(descId);
    const btnEl = document.getElementById(btnId);
    if (!('Notification' in window)) {
        if (descEl) descEl.textContent = '이 브라우저는 푸시 알림을 지원하지 않습니다.';
        if (btnEl) btnEl.style.display = 'none';
        return;
    }
    if (Notification.permission === 'granted') {
        if (descEl) descEl.textContent = '실시간 푸시 알림 수신 중 (정상 연동됨)';
        if (btnEl) {
            btnEl.textContent = '테스트 알림';
            btnEl.onclick = () => showToast('알림 테스트', '푸시 알림이 정상적으로 연동되어 있습니다.');
        }
    } else if (Notification.permission === 'denied') {
        if (descEl) descEl.textContent = '브라우저 설정에서 알림 권한이 차단되어 있습니다.';
        if (btnEl) {
            btnEl.textContent = '권한 차단됨';
            btnEl.disabled = true;
        }
    } else {
        if (descEl) descEl.textContent = '실시간 질문 및 수업 알림 받기';
        if (btnEl) {
            btnEl.textContent = '알림 켜기';
            btnEl.onclick = () => requestPushPermission();
        }
    }
}

window.toggleMyPagePassword = function(role) {
    const formId = role === 'teacher' ? 'teacherPassForm' : 'studentPassForm';
    const form = document.getElementById(formId);
    if (form) form.classList.toggle('hidden');
};

window.handleMyPageChangePassword = async function(role) {
    const inputId = role === 'teacher' ? 'teacherNewPassword' : 'studentNewPassword';
    const passInput = document.getElementById(inputId);
    const newPassword = passInput?.value.trim();
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
        alert('비밀번호가 성공적으로 변경되었습니다!');
        passInput.value = '';
        window.toggleMyPagePassword(role);
    } catch (e) {
        alert(e.message);
    }
};

// 프로필 모달 열기 공통 함수
function openProfileModal(fromBell = false) {
    if (!currentUser) {
        try {
            const saved = localStorage.getItem('tutoring_user_v2') || sessionStorage.getItem('tutoring_user_v2');
            if (saved) currentUser = JSON.parse(saved);
        } catch (e) {}
    }
    if (!currentUser) return;

    // 1. 모달 즉시 노출 (지연 및 예외 차단)
    openModal('accountProfileModal');

    // 2. 유저 정보 표시
    const nameEl = document.getElementById('profileModalName');
    const roleEl = document.getElementById('profileModalRole');
    const isTeacher = (currentUser.role === 'admin' || currentUser.role === 'teacher');
    
    if (nameEl) nameEl.textContent = `${currentUser.name} ${isTeacher ? '선생님' : '학생'}`;
    
    let displayId = '';
    if (currentUser.login_id) {
        displayId = currentUser.login_id;
    } else if (currentUser.user && typeof currentUser.user === 'object' && currentUser.user.email) {
        displayId = currentUser.user.email.replace('@tutor.com', '');
    } else if (typeof currentUser.user === 'string') {
        displayId = currentUser.user;
    } else if (typeof currentUser.id === 'string' && !currentUser.id.includes('-')) {
        displayId = currentUser.id;
    }
    if (roleEl) roleEl.textContent = displayId ? `아이디: ${displayId}` : (isTeacher ? '선생님 계정' : '학생 계정');

    const passBtn = document.getElementById('modalPasswordBtn');
    if (passBtn) {
        passBtn.style.display = isTeacher ? 'none' : 'flex';
    }

    try {
        syncPushNotificationState();
    } catch (e) {
        console.warn('푸시 상태 동기화 실패:', e);
    }

    try {
        loadNotifications();
    } catch (e) {
        console.warn('알림 로드 실패:', e);
    }

    // 🔔 종(알림) 버튼을 눌러 들어온 경우 알림 센터 섹션으로 부드럽게 스크롤 및 하이라이트
    if (fromBell) {
        setTimeout(() => {
            const notifSection = document.querySelector('.modal-notification-section');
            if (notifSection) {
                notifSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                notifSection.classList.add('notif-highlight');
                setTimeout(() => notifSection.classList.remove('notif-highlight'), 1800);
            }
        }, 150);
    }
}

// ==========================================
// 🔑 인증 및 세션 관리
// ==========================================
async function checkSession() {
    const saved = localStorage.getItem('tutoring_user_v2') || sessionStorage.getItem('tutoring_user_v2');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);

            // 로그인 유지(rememberMe) 유저인 경우 토큰 만료 여부 확인 및 자동 갱신
            if (currentUser && currentUser.rememberMe && currentUser.refreshToken) {
                const nowSec = Math.floor(Date.now() / 1000);
                if (!currentUser.expiresAt || (currentUser.expiresAt - nowSec < 300)) {
                    const refreshedToken = await tryRefreshToken();
                    if (!refreshedToken && (!currentUser.token || (currentUser.expiresAt && currentUser.expiresAt - nowSec <= 0))) {
                        handleLogout();
                        return;
                    }
                }
                startTokenRefreshTimer();
            }

            updateUIForLoggedInUser();
        } catch (e) {
            handleLogout();
        }
    }
}

async function handleLogin() {
    const id = document.getElementById('idInput').value.trim();
    const password = document.getElementById('passwordInput').value.trim();
    const rememberMe = document.getElementById('rememberMeCheckbox')?.checked ?? true;
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

        currentUser = {
            ...data,
            rememberMe
        };

        if (rememberMe) {
            localStorage.setItem('tutoring_user_v2', JSON.stringify(currentUser));
            localStorage.setItem('tutoring_remember_me', 'true');
            sessionStorage.removeItem('tutoring_user_v2');
        } else {
            sessionStorage.setItem('tutoring_user_v2', JSON.stringify(currentUser));
            localStorage.setItem('tutoring_remember_me', 'false');
            localStorage.removeItem('tutoring_user_v2');
        }
        
        document.getElementById('idInput').value = '';
        document.getElementById('passwordInput').value = '';

        updateUIForLoggedInUser();
        startTokenRefreshTimer();
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
    if (tokenRefreshTimer) clearInterval(tokenRefreshTimer);
    knownUnreadIds.clear();
    isFirstNotificationLoad = true;
    localStorage.removeItem('tutoring_user_v2');
    sessionStorage.removeItem('tutoring_user_v2');

    document.getElementById('enablePushBtn')?.classList.add('hidden');
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('userInfo').classList.add('hidden');
    document.getElementById('teacherDashboard').classList.add('hidden');
    document.getElementById('studentDashboard').classList.add('hidden');
    document.getElementById('teacherBottomDock')?.classList.add('hidden');
    document.getElementById('studentBottomDock')?.classList.add('hidden');
    document.body.classList.remove('has-dock');
}

function updateUIForLoggedInUser() {
    if (!currentUser) return;

    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('userInfo').classList.remove('hidden');

    const isTeacher = (currentUser.role === 'admin' || currentUser.role === 'teacher');
    const teacherDock = document.getElementById('teacherBottomDock');
    const studentDock = document.getElementById('studentBottomDock');

    if (isTeacher) {
        teacherDock?.classList.remove('hidden');
        studentDock?.classList.add('hidden');
        document.body.classList.add('has-dock');
        setTimeout(() => {
            const firstBtn = document.getElementById('dockTeacherStudents');
            if (firstBtn) moveDockIndicator('teacherBottomDock', firstBtn);
        }, 120);
    } else {
        studentDock?.classList.remove('hidden');
        teacherDock?.classList.add('hidden');
        document.body.classList.add('has-dock');
        setTimeout(() => {
            const firstBtn = document.getElementById('dockStudentHome');
            if (firstBtn) moveDockIndicator('studentBottomDock', firstBtn);
        }, 120);
    }

    const roleName = isTeacher ? '선생님' : '학생';
    document.getElementById('userGreeting').textContent = `${currentUser.name} ${roleName}`;

    if (isTeacher) {
        document.getElementById('teacherDashboard').classList.remove('hidden');
        document.getElementById('studentDashboard').classList.add('hidden');
        switchMainTab('teacherClassTab', false);
        initTeacherView();
    } else {
        document.getElementById('studentDashboard').classList.remove('hidden');
        document.getElementById('teacherDashboard').classList.add('hidden');
        switchMainTab('studentStudyTab', false);
        initStudentView();
    }

    loadNotifications();
    startNotificationPolling();
    syncPushNotificationState();
    setTimeout(autoFitButtonText, 150);
    setTimeout(() => updateAllTabIndicators(false), 120);
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
            const subStat = document.getElementById('teacherStatSubjects');
            if (subStat) subStat.textContent = mySubjects.length;
            const stuStat = document.getElementById('teacherStatStudents');
            if (stuStat) stuStat.textContent = getTotalStudentCount();
        } else {
            renderStudentSubjectChips();
            updateStudentSubjectSelectOptions();
            const subStat = document.getElementById('studentStatSubjects');
            if (subStat) subStat.textContent = mySubjects.length;
            const subCountEl = document.getElementById('studentStudySubjectCount');
            if (subCountEl) subCountEl.textContent = `${mySubjects.length}개 과목`;
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
                <button class="subject-chip-del" type="button" title="${escapeHtml(s.name)} 과목 삭제" aria-label="${escapeHtml(s.name)} 과목 삭제" onclick="deleteSubject(event, ${s.id})">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        `;
    });

    container.innerHTML = html;
    renderModalSubjectList();
}

function renderModalSubjectList() {
    const listEl = document.getElementById('modalSubjectList');
    const countEl = document.getElementById('modalSubjectCount');
    if (!listEl) return;

    if (countEl) countEl.textContent = `${mySubjects.length}개`;

    if (mySubjects.length === 0) {
        listEl.innerHTML = '<div style="color:var(--text-muted); font-size:0.82rem; padding:10px 0; text-align:center;">개설된 과목이 없습니다.</div>';
        return;
    }

    listEl.innerHTML = mySubjects.map(s => {
        const studentCount = s.enrollments ? s.enrollments.length : 0;
        return `
            <div class="modal-subject-item">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="subject-color-dot" style="background-color:${s.color};"></span>
                    <span style="font-weight:600; color:var(--text-primary);">${escapeHtml(s.name)}</span>
                    <span style="font-size:0.75rem; color:var(--text-muted);">(${studentCount}명 수강)</span>
                </div>
                <button class="modal-subject-del-btn" type="button" onclick="deleteSubject(event, ${s.id})">
                    삭제
                </button>
            </div>
        `;
    }).join('');
}

window.deleteSubject = async function(event, subjectId) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const subject = mySubjects.find(s => s.id === subjectId);
    const subjectName = subject ? subject.name : '이 과목';
    const studentCount = subject && subject.enrollments ? subject.enrollments.length : 0;

    let confirmMsg = `'${subjectName}' 과목을 정말 삭제하시겠습니까?`;
    if (studentCount > 0) {
        confirmMsg += `\n\n[주의] 현재 ${studentCount}명의 학생이 이 과목에 수강 등록되어 있습니다.\n과목을 삭제하면 해당 학생들의 수강 연결 및 관련 수업 일정도 함께 정리됩니다.`;
    } else {
        confirmMsg += '\n\n해당 과목의 수업 일정도 함께 삭제됩니다.';
    }

    if (!confirm(confirmMsg)) return;

    try {
        const res = await authFetch(`/api/subjects?id=${subjectId}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '과목 삭제 실패');

        alert(`'${subjectName}' 과목이 삭제되었습니다.`);

        // 현재 선택된 과목 필터가 삭제된 과목이면 전체 과목으로 리셋
        if (currentSubjectFilter === subjectId) {
            currentSubjectFilter = null;
        }

        await loadSubjects();
        if (currentUser.role === 'admin' || currentUser.role === 'teacher') {
            await loadStudents();
            if (currentStudentId) loadStudentDetail(currentStudentId);
        }
        renderCalendar();
    } catch (err) {
        alert(err.message);
    }
};

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
    calendarScheduleCache.clear();
    if (currentUser.role === 'admin' || currentUser.role === 'teacher') {
        renderTeacherSubjectChips();
        loadStudents();
        if (currentStudentId) loadStudentDetail(currentStudentId);
    } else {
        renderStudentSubjectChips();
        loadStudentData();
    }
    renderCalendar(true);
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
    ['askQuestionSubjectSelect', 'modalAskSubjectSelect'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const currentVal = sel.value;
        let html = '<option value="">질문할 과목 선택</option>';
        mySubjects.forEach(s => {
            html += `<option value="${s.id}">${escapeHtml(s.name)}</option>`;
        });
        sel.innerHTML = html;
        if (currentVal) sel.value = currentVal;
    });
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

        alert(`'${name}' 과목이 개설되었습니다.`);
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
    await loadAllTeacherQuestions();
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
        if (!currentSubjectFilter) {
            totalStudentsCache = students;
        }

        const stuStat = document.getElementById('teacherStatStudents');
        if (stuStat) stuStat.textContent = getTotalStudentCount();

        const list = document.getElementById('studentList');
        if (!list) return;

        if (students.length === 0) {
            list.innerHTML = '<li style="text-align:center; color:var(--text-muted); padding:24px 0; font-size:0.86rem;">등록된 학생이 없습니다.</li>';
            return;
        }

        list.innerHTML = students.map(s => {
            const isSelected = currentStudentId === s.id;
            const initial = (s.name || '학').trim().charAt(0);
            return `
                <li class="student-list-item ${isSelected ? 'selected' : ''}" onclick="selectStudent('${s.id}', '${escapeHtml(s.name)}')">
                    <div class="student-item-left">
                        <div class="student-avatar-circle">${escapeHtml(initial)}</div>
                        <span class="student-name-text">${escapeHtml(s.name)}</span>
                    </div>
                    <span class="outline-btn-sm" style="${isSelected ? 'background:var(--primary); color:#ffffff; border-color:var(--primary);' : ''}">
                        ${isSelected ? '선택됨' : '관리'}
                    </span>
                </li>
            `;
        }).join('');

        const schedStudentSel = document.getElementById('scheduleStudentSelect');
        if (schedStudentSel) {
            schedStudentSel.innerHTML = '<option value="">과목 전체 공통 수업</option>' + students.map(s => `
                <option value="${s.id}">${escapeHtml(s.name)}</option>
            `).join('');
        }
        autoFitButtonText();
    } catch (err) {
        console.error('학생 로드 에러:', err);
        const list = document.getElementById('studentList');
        if (list) list.innerHTML = '<li style="text-align:center; color:var(--danger); padding:20px 0;">학생 목록을 불러오지 못했습니다.</li>';
    }
}

window.selectStudent = function(studentId, studentName) {
    currentStudentId = studentId;
    document.getElementById('manageStudentTitle').textContent = `${studentName} 학생 관리`;
    document.getElementById('studentManagePanel').classList.remove('hidden');

    // 질문 관리 서브탭을 기본 활성 상태로 초기화 및 표시
    const subTabBar = document.querySelector('#studentManagePanel .sub-tab-bar');
    if (subTabBar) {
        subTabBar.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
        subTabBar.querySelector('.sub-tab-btn[data-subtarget="studentQuestionsTab"]')?.classList.add('active');
    }
    document.getElementById('studentQuestionsTab')?.classList.remove('hidden');
    document.getElementById('studentExamsTab')?.classList.add('hidden');
    document.getElementById('studentFeedbacksTab')?.classList.add('hidden');

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

        alert('학생이 과목에 배정되었습니다.');
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
// 💬 선생님 전체 질문 관리 & 풀이 피드
// ==========================================
let teacherAllQuestionsCache = [];
let currentTeacherQnaFilter = 'unanswered'; // 'unanswered' | 'answered' | 'all'

window.setTeacherQnaFilter = function(filter) {
    currentTeacherQnaFilter = filter;
    
    // 버튼 활성 스타일 전환
    const filterBar = document.querySelector('.qna-filter-bar');
    let targetBtn = null;
    document.querySelectorAll('.qna-filter-btn').forEach(btn => {
        if (btn.getAttribute('data-filter') === filter) {
            btn.classList.add('active');
            targetBtn = btn;
        } else {
            btn.classList.remove('active');
        }
    });

    if (filterBar && targetBtn) {
        moveTabIndicator(filterBar, targetBtn, true);
    }

    renderTeacherQuestionsFeed();
};

async function loadAllTeacherQuestions(forceRefresh = false) {
    const list = document.getElementById('teacherAllQuestionsList');
    if (!list) return;

    // 필터 바 인디케이터 초기 위치 동기화
    const filterBar = document.querySelector('.qna-filter-bar');
    const activeFilterBtn = filterBar?.querySelector('.qna-filter-btn.active');
    if (filterBar && activeFilterBtn) {
        setTimeout(() => moveTabIndicator(filterBar, activeFilterBtn, false), 60);
    }

    if (forceRefresh || teacherAllQuestionsCache.length === 0) {
        showSkeleton('teacherAllQuestionsList', 3);
        try {
            let url = '/api/getQuestions';
            if (currentSubjectFilter) url += `?subject_id=${currentSubjectFilter}`;

            const res = await authFetch(url);
            const data = await res.json();
            teacherAllQuestionsCache = Array.isArray(data) ? data : [];
        } catch (err) {
            console.error('전체 질문 목록 로드 실패:', err);
            list.innerHTML = '<div style="text-align:center; color:var(--danger); padding:30px 0;">질문 목록을 불러오지 못했습니다.</div>';
            return;
        }
    }

    renderTeacherQuestionsFeed();
}

function renderTeacherQuestionsFeed() {
    const list = document.getElementById('teacherAllQuestionsList');
    if (!list) return;

    const unanswered = teacherAllQuestionsCache.filter(q => !(q.is_answered || (q.answer_text && q.answer_text.trim() !== '')));
    const answered = teacherAllQuestionsCache.filter(q => Boolean(q.is_answered || (q.answer_text && q.answer_text.trim() !== '')));
    const totalCount = teacherAllQuestionsCache.length;
    const unansweredCount = unanswered.length;
    const answeredCount = answered.length;

    // 뱃지 숫자 갱신
    const badgeUnanswered = document.getElementById('badgeUnansweredCount');
    const badgeAnswered = document.getElementById('badgeAnsweredCount');
    const badgeAll = document.getElementById('badgeAllCount');
    if (badgeUnanswered) badgeUnanswered.textContent = unansweredCount;
    if (badgeAnswered) badgeAnswered.textContent = answeredCount;
    if (badgeAll) badgeAll.textContent = totalCount;

    // 마이페이지 답변 대기 통계 숫자 동기화
    const statUnanswered = document.getElementById('teacherStatUnanswered');
    if (statUnanswered) statUnanswered.textContent = unansweredCount;

    // 상단 탭 및 하단 독 배지 동기화
    const qnaBadge = document.getElementById('teacherQnaBadge');
    const topQnaBadge = document.getElementById('teacherTopQnaBadge');
    [qnaBadge, topQnaBadge].forEach(badge => {
        if (!badge) return;
        if (unansweredCount > 0) {
            badge.textContent = unansweredCount > 99 ? '99+' : unansweredCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    });

    // 헤더 상태 라이브 배지 (qnaLiveBadge)
    const liveBadge = document.getElementById('qnaLiveBadge');
    if (liveBadge) {
        if (unansweredCount > 0) {
            liveBadge.textContent = `대기 ${unansweredCount}건`;
            liveBadge.className = 'qna-live-pill';
            liveBadge.classList.remove('hidden');
        } else {
            liveBadge.textContent = '모두 답변됨';
            liveBadge.className = 'qna-live-pill all-done';
            liveBadge.classList.remove('hidden');
        }
    }

    // 현재 선택된 필터에 따라 목록 추출
    let displayList = [];
    if (currentTeacherQnaFilter === 'unanswered') {
        displayList = unanswered;
    } else if (currentTeacherQnaFilter === 'answered') {
        displayList = answered;
    } else {
        displayList = teacherAllQuestionsCache;
    }

    if (displayList.length === 0) {
        if (currentTeacherQnaFilter === 'unanswered') {
            list.innerHTML = `
                <div class="empty-state-box">
                    <div class="empty-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    </div>
                    <div class="empty-title">현재 답변 대기 중인 질문이 없습니다</div>
                    <div class="empty-subtitle">모든 학생의 질문에 답변을 완료했습니다. 학생이 새 질문을 등록하면 실시간으로 알림을 보내드립니다.</div>
                </div>
            `;
        } else if (currentTeacherQnaFilter === 'answered') {
            list.innerHTML = `
                <div class="empty-state-box">
                    <div class="empty-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    </div>
                    <div class="empty-title">아직 완료된 질문이 없습니다</div>
                    <div class="empty-subtitle">답변 대기 중인 질문을 확인하고 풀이를 등록해보세요.</div>
                </div>
            `;
        } else {
            list.innerHTML = `
                <div class="empty-state-box">
                    <div class="empty-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    </div>
                    <div class="empty-title">등록된 질문이 없습니다</div>
                    <div class="empty-subtitle">학생들이 등록한 질문이 이곳에 실시간으로 표시됩니다.</div>
                </div>
            `;
        }
        return;
    }

    list.innerHTML = displayList.map(q => {
        const hasAnswer = Boolean(q.is_answered || (q.answer_text && q.answer_text.trim() !== ''));
        const studentName = q.profiles?.name || '학생';
        const dateObj = new Date(q.created_at);
        const formattedDate = `${dateObj.getFullYear()}.${dateObj.getMonth() + 1}.${dateObj.getDate()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

        const subjectBadge = q.subjects 
            ? `<span class="badge" style="background:${q.subjects.color}15; color:${q.subjects.color}; border: 1px solid ${q.subjects.color}35;">${escapeHtml(q.subjects.name)}</span>` 
            : '';
        const statusBadge = hasAnswer
            ? `<span class="badge badge-answered"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> 답변 완료</span>`
            : `<span class="badge badge-waiting"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> 답변 대기</span>`;

        return `
            <div class="feed-card" id="question-${q.id}">
                <div class="feed-header">
                    <div class="feed-header-left">
                        <span class="badge-student">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            ${escapeHtml(studentName)} 학생
                        </span>
                        ${subjectBadge}
                        ${statusBadge}
                    </div>
                    <div class="feed-header-right">
                        <span class="feed-timestamp">${formattedDate}</span>
                        <button class="danger-link-btn" onclick="deleteRecord('Question', ${q.id})" title="질문 영구 삭제">삭제</button>
                    </div>
                </div>

                <div class="feed-title">
                    <span class="feed-q-prefix">Q.</span>
                    <span class="feed-q-text">${escapeHtml(q.question_text)}</span>
                </div>

                ${q.question_image_url ? `
                    <div class="image-preview-wrapper" onclick="openImageLightbox('${escapeHtml(q.question_image_url)}', '${escapeHtml(studentName)} 학생 질문 사진')" title="탭하여 원본 사진 크게 보기">
                        <img src="${q.question_image_url}" alt="문제 사진" loading="lazy">
                        <div class="image-zoom-overlay">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                            <span>탭하여 확대</span>
                        </div>
                    </div>
                ` : ''}

                ${hasAnswer ? `
                    <div class="answer-box-completed">
                        <div class="answer-box-completed-header">
                            <span class="answer-completed-badge">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                선생님 풀이 답변
                            </span>
                            <div class="answer-action-buttons">
                                <button class="text-link-btn" onclick="promptEditAnswer(${q.id}, '${escapeHtml(q.answer_text || '')}')">수정</button>
                                <span class="action-divider">·</span>
                                <button class="danger-link-btn" onclick="deleteRecord('Answer', ${q.id})">답변취소</button>
                            </div>
                        </div>
                        <p class="answer-box-content">${escapeHtml(q.answer_text || '')}</p>
                        ${q.answer_image_url ? `
                            <div class="image-preview-wrapper" style="margin-top:10px;" onclick="openImageLightbox('${escapeHtml(q.answer_image_url)}', '선생님 풀이 첨부 사진')" title="탭하여 풀이 사진 크게 보기">
                                <img src="${q.answer_image_url}" alt="풀이 사진" loading="lazy">
                                <div class="image-zoom-overlay">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                                    <span>탭하여 확대</span>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                ` : `
                    <div class="answer-card-form">
                        <div class="answer-form-header">
                            <span class="answer-form-title">${escapeHtml(studentName)} 학생에게 풀이 답변 남기기</span>
                        </div>
                        <textarea id="ansText-${q.id}" class="answer-textarea" rows="3" placeholder="${escapeHtml(studentName)} 학생을 위해 상세 풀이 과정이나 핵심 포인트를 입력해주세요."></textarea>
                        
                        <div class="answer-form-actions">
                            <label class="custom-file-upload-label" for="ansImg-${q.id}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                                    <circle cx="12" cy="13" r="4"/>
                                </svg>
                                <span>풀이 사진 첨부</span>
                            </label>
                            <input type="file" id="ansImg-${q.id}" accept="image/*" class="sr-only-file-input" onchange="handleAnswerFileChange(${q.id}, this)">
                            
                            <div id="ansImgPreview-${q.id}" class="selected-file-chip hidden">
                                <span id="ansImgName-${q.id}" class="file-name-text"></span>
                                <button type="button" class="file-remove-btn" onclick="clearAnswerFile(${q.id})" title="사진 첨부 취소">✕</button>
                            </div>
                        </div>
                        
                        <button class="answer-submit-btn" onclick="submitAnswer(${q.id}, this)">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            <span>답변 등록 완료하기</span>
                        </button>
                    </div>
                `}
            </div>
        `;
    }).join('');
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

        // 미답변 질문 수 카운트하여 선생님 하단 독 배지에 표시
        const unansweredCount = questions.filter(q => !(q.is_answered || (q.answer_text && q.answer_text.trim() !== ''))).length;
        const qnaBadge = document.getElementById('teacherQnaBadge');
        if (qnaBadge) {
            if (unansweredCount > 0) {
                qnaBadge.textContent = unansweredCount > 99 ? '99+' : unansweredCount;
                qnaBadge.classList.remove('hidden');
            } else {
                qnaBadge.classList.add('hidden');
            }
        }

        if (questions.length === 0) {
            list.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:30px 0;">아직 학생이 등록한 질문이 없습니다.</div>';
            return;
        }

        list.innerHTML = questions.map(q => {
            const hasAnswer = Boolean(q.is_answered || (q.answer_text && q.answer_text.trim() !== ''));
            const subjectBadge = q.subjects ? `<span class="badge" style="background:${q.subjects.color}15; color:${q.subjects.color}; border: 1px solid ${q.subjects.color}35;">${escapeHtml(q.subjects.name)}</span>` : '';
            const statusBadge = hasAnswer
                ? `<span class="badge badge-answered">${ICONS.check} 답변 완료</span>`
                : `<span class="badge badge-waiting">${ICONS.clock} 답변 대기</span>`;

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

                    <div class="feed-title">
                        <span>Q. ${escapeHtml(q.question_text)}</span>
                    </div>

                    ${q.question_image_url ? `
                        <div class="image-preview-wrapper" onclick="openImageLightbox('${escapeHtml(q.question_image_url)}', '학생 질문 사진')" title="탭하여 원본 사진 보기">
                            <img src="${q.question_image_url}" alt="문제 사진" loading="lazy">
                            <div class="image-zoom-overlay">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                                <span>탭하여 확대</span>
                            </div>
                        </div>
                    ` : ''}

                    <div class="answer-box">
                        ${hasAnswer ? `
                            <div class="answer-box-header">
                                <span class="answer-box-title">선생님 풀이 해설</span>
                                <div>
                                    <button class="text-link-btn" onclick="promptEditAnswer(${q.id}, '${escapeHtml(q.answer_text || '')}')">수정</button>
                                    <button class="danger-link-btn" onclick="deleteRecord('Answer', ${q.id})">답변취소</button>
                                </div>
                            </div>
                            <p class="answer-box-content">${escapeHtml(q.answer_text || '')}</p>
                            ${q.answer_image_url ? `
                                <div class="image-preview-wrapper" style="margin-top:8px;" onclick="openImageLightbox('${escapeHtml(q.answer_image_url)}', '풀이 첨부 사진')" title="탭하여 풀이 사진 보기">
                                    <img src="${q.answer_image_url}" alt="풀이 사진" loading="lazy">
                                    <div class="image-zoom-overlay">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                                        <span>탭하여 확대</span>
                                    </div>
                                </div>
                            ` : ''}
                        ` : `
                            <div style="font-weight:600; font-size:0.86rem; color:var(--text-secondary); margin-bottom: 6px;">풀이 작성하기</div>
                            <input type="text" id="ansText-${q.id}" placeholder="상세 풀이 설명을 적어주세요">
                            <input type="file" id="ansImg-${q.id}" accept="image/*">
                            <button class="primary-btn-sm mt-12" style="width:100%;" onclick="submitAnswer(${q.id}, this)">답변 등록 완료</button>
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
            list.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:30px 0; font-size:0.88rem;">등록된 시험 결과가 없습니다.</div>';
            return;
        }

        list.innerHTML = exams.map(e => {
            const subjectBadge = e.subjects ? `<span class="badge" style="background:${e.subjects.color}15; color:${e.subjects.color}; border: 1px solid ${e.subjects.color}35;">${escapeHtml(e.subjects.name)}</span>` : '';
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

                    <div style="font-size:1.02rem; font-weight:700; color:var(--text-primary); margin: 6px 0;">
                        ${escapeHtml(e.exam_title)}
                    </div>

                    ${e.paper_image_url ? `
                        <div class="image-preview-wrapper" onclick="openImageLightbox('${escapeHtml(e.paper_image_url)}', '${escapeHtml(e.exam_title)} 시험지')" title="시험지 원본 사진 보기">
                            <img src="${e.paper_image_url}" alt="시험지 사진" loading="lazy">
                            <div class="image-zoom-overlay">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                                <span>탭하여 확대</span>
                            </div>
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
            list.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:30px 0; font-size:0.88rem;">작성된 과외 일지가 없습니다.</div>';
            return;
        }

        list.innerHTML = feedbacks.map(f => {
            const subjectBadge = f.subjects ? `<span class="badge" style="background:${f.subjects.color}15; color:${f.subjects.color}; border: 1px solid ${f.subjects.color}35;">${escapeHtml(f.subjects.name)}</span>` : '';
            return `
                <div class="feed-card">
                    <div class="feed-header">
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${subjectBadge}
                            <span style="font-size:0.78rem; color:var(--text-muted);">${new Date(f.created_at).toLocaleDateString()}</span>
                        </div>
                        <div style="display:flex; gap:4px;">
                            <button class="text-link-btn" onclick="promptEditFeedback(${f.id}, '${escapeHtml(f.feedback_text)}')">수정</button>
                            <button class="danger-link-btn" onclick="deleteRecord('Feedback', ${f.id})">삭제</button>
                        </div>
                    </div>

                    <div style="font-size:1.02rem; font-weight:700; color:var(--text-primary); margin-bottom: 6px;">
                        ${escapeHtml(f.feedback_title || '과외 일지')}
                    </div>
                    
                    <div class="feedback-box-content">${escapeHtml(f.feedback_text)}</div>
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

        alert('시험 결과가 등록되었습니다.');
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

        alert('피드백이 전송되었습니다.');
        document.getElementById('feedbackTitleAdmin').value = '';
        document.getElementById('feedbackTextAdmin').value = '';
        loadAdminFeedbacks(currentStudentId);
    } catch (err) {
        alert(err.message);
    } finally {
        setButtonLoading(btn, false);
    }
}

// 🖼️ 풀이 사진 첨부 UX 헬퍼 함수
window.handleAnswerFileChange = function(qId, input) {
    const previewContainer = document.getElementById(`ansImgPreview-${qId}`);
    const nameSpan = document.getElementById(`ansImgName-${qId}`);
    if (!previewContainer || !input.files || input.files.length === 0) {
        if (previewContainer) previewContainer.classList.add('hidden');
        return;
    }
    const file = input.files[0];
    if (nameSpan) nameSpan.textContent = file.name;
    previewContainer.classList.remove('hidden');
};

window.clearAnswerFile = function(qId) {
    const input = document.getElementById(`ansImg-${qId}`);
    const previewContainer = document.getElementById(`ansImgPreview-${qId}`);
    if (input) input.value = '';
    if (previewContainer) previewContainer.classList.add('hidden');
};

// 🖼️ 전용 이미지 전체화면 라이트박스 뷰어 함수 (Tap to Zoom & Inspect)
window.openImageLightbox = function(imageUrl, title = '사진 원본') {
    const modal = document.getElementById('imageLightboxModal');
    const img = document.getElementById('lightboxImage');
    const caption = document.getElementById('lightboxTitle');
    if (!modal || !img) return;

    img.src = imageUrl;
    if (caption) caption.textContent = title;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
};

window.closeImageLightbox = function(e) {
    if (e && e.target && e.target.id === 'lightboxImage') return;
    const modal = document.getElementById('imageLightboxModal');
    const img = document.getElementById('lightboxImage');
    if (!modal) return;

    modal.classList.add('hidden');
    if (img) img.src = '';
    document.body.style.overflow = '';
};

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('imageLightboxModal');
        if (modal && !modal.classList.contains('hidden')) {
            window.closeImageLightbox();
        }
    }
});

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

        alert('답변이 등록되었습니다.');
        teacherAllQuestionsCache = [];
        await loadAllTeacherQuestions(true);
        if (currentStudentId) loadAdminQuestions(currentStudentId);
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
        teacherAllQuestionsCache = [];
        loadAllTeacherQuestions(true);
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
        if (res.ok) {
            teacherAllQuestionsCache = [];
            loadAllTeacherQuestions(true);
            if (currentStudentId) loadAdminQuestions(currentStudentId);
        }
    } catch (err) {
        alert(err.message);
    }
};

async function handleDeleteStudent() {
    if (!currentStudentId) return;
    if (!confirm('경고: 이 학생의 계정, 모든 사진, 질문, 시험, 피드백이 영구 삭제됩니다. 계속하시겠습니까?')) return;

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
    await Promise.all([
        loadMyExams(),
        loadMyQuestions(),
        loadMyFeedbacks(),
        loadUpcomingClass()
    ]);
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
        myExamsCache = Array.isArray(exams) ? exams : [];

        const examStat = document.getElementById('studentStatExams');
        if (examStat) examStat.textContent = myExamsCache.length;

        // 📈 성적 추이 그래프 렌더링 호출
        renderScoreTrendChart(myExamsCache);

        if (!Array.isArray(exams) || exams.length === 0) {
            list.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:24px 0; font-size:0.86rem;">시험 기록이 없습니다.</div>';
            return;
        }

        list.innerHTML = exams.map(e => {
            const subjectBadge = e.subjects ? `<span class="badge" style="background:${e.subjects.color}15; color:${e.subjects.color}; border: 1px solid ${e.subjects.color}35;">${escapeHtml(e.subjects.name)}</span>` : '';
            return `
                <div class="feed-card" style="padding:14px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:6px;">
                            ${subjectBadge}
                            <span style="font-weight:600; font-size:0.95rem;">${escapeHtml(e.exam_title)}</span>
                        </div>
                        <span class="badge badge-score">${e.score}점</span>
                    </div>
                    ${e.paper_image_url ? `
                        <div class="image-preview-wrapper" style="margin-top:8px;" onclick="openImageLightbox('${escapeHtml(e.paper_image_url)}', '${escapeHtml(e.exam_title)} 시험지')" title="시험지 원본 사진 보기">
                            <img src="${e.paper_image_url}" alt="시험지 사진" loading="lazy">
                            <div class="image-zoom-overlay">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                                <span>탭하여 확대</span>
                            </div>
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

let currentStudentQuestionFilter = 'all'; // 'all' | 'waiting' | 'answered'

window.filterStudentQuestions = function(filter) {
    currentStudentQuestionFilter = filter || 'all';
    updateQuestionFilterUI();
    renderStudentQuestionsFeed();
    const listEl = document.getElementById('myQuestionList');
    if (listEl) {
        listEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
};

function updateQuestionFilterUI() {
    const totalBox = document.getElementById('qstatBoxTotal');
    const waitBox = document.getElementById('qstatBoxWaiting');
    const ansBox = document.getElementById('qstatBoxAnswered');
    const filterBadge = document.getElementById('myQuestionsFilterBadge');

    if (totalBox) totalBox.classList.toggle('active', currentStudentQuestionFilter === 'all');
    if (waitBox) waitBox.classList.toggle('active', currentStudentQuestionFilter === 'waiting');
    if (ansBox) ansBox.classList.toggle('active', currentStudentQuestionFilter === 'answered');

    if (filterBadge) {
        if (currentStudentQuestionFilter === 'waiting') {
            filterBadge.textContent = '답변 대기';
            filterBadge.style.background = 'rgba(245, 158, 11, 0.15)';
            filterBadge.style.color = '#d97706';
        } else if (currentStudentQuestionFilter === 'answered') {
            filterBadge.textContent = '답변 완료';
            filterBadge.style.background = 'rgba(16, 185, 129, 0.15)';
            filterBadge.style.color = '#059669';
        } else {
            filterBadge.textContent = '전체';
            filterBadge.style.background = 'var(--bg-subtle)';
            filterBadge.style.color = 'var(--text-muted)';
        }
    }
}

function renderStudentQuestionsFeed() {
    const list = document.getElementById('myQuestionList');
    if (!list) return;

    if (!Array.isArray(myQuestionsCache) || myQuestionsCache.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:30px 0; font-size:0.88rem;">아직 질문한 내역이 없습니다.</div>';
        return;
    }

    let filtered = myQuestionsCache;
    if (currentStudentQuestionFilter === 'waiting') {
        filtered = myQuestionsCache.filter(q => !(q.is_answered || (q.answer_text && q.answer_text.trim() !== '')));
    } else if (currentStudentQuestionFilter === 'answered') {
        filtered = myQuestionsCache.filter(q => Boolean(q.is_answered || (q.answer_text && q.answer_text.trim() !== '')));
    }

    if (filtered.length === 0) {
        let msg = '해당하는 질문이 없습니다.';
        if (currentStudentQuestionFilter === 'waiting') {
            msg = '현재 답변 대기 중인 질문이 없습니다. (모든 질문 답변 완료!)';
        } else if (currentStudentQuestionFilter === 'answered') {
            msg = '아직 답변이 완료된 질문이 없습니다.';
        }
        const emptyIconSvg = currentStudentQuestionFilter === 'waiting'
            ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
            : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
        list.innerHTML = `
            <div style="text-align:center; color:var(--text-muted); padding:36px 16px; font-size:0.88rem;">
                <div style="width:48px; height:48px; border-radius:50%; background:var(--bg-subtle); display:inline-flex; align-items:center; justify-content:center; margin-bottom:12px; border:1px solid var(--border-color);">
                    ${emptyIconSvg}
                </div>
                <div style="font-weight:700; color:var(--text-primary); margin-bottom:4px;">${msg}</div>
                <div style="font-size:0.82rem; color:var(--text-muted);">상단의 버튼을 눌러 다른 질문들을 확인할 수 있습니다.</div>
            </div>
        `;
        return;
    }

    list.innerHTML = filtered.map(q => {
        const hasAnswer = Boolean(q.is_answered || (q.answer_text && q.answer_text.trim() !== ''));
        const subjectBadge = q.subjects ? `<span class="badge" style="background:${q.subjects.color}15; color:${q.subjects.color}; border: 1px solid ${q.subjects.color}35;">${escapeHtml(q.subjects.name)}</span>` : '';
        const statusBadge = hasAnswer
            ? `<span class="badge badge-answered">${ICONS.check} 답변 완료</span>`
            : `<span class="badge badge-waiting">${ICONS.clock} 풀이 작성 중</span>`;

        return `
            <div class="feed-card" id="question-${q.id}">
                <div class="feed-header">
                    <div style="display:flex; gap:6px; align-items:center;">
                        ${subjectBadge}
                        ${statusBadge}
                    </div>
                    ${!hasAnswer ? `
                        <div style="display:flex; gap:6px;">
                            <button class="danger-link-btn" onclick="deleteStudentQuestion(${q.id})" style="font-size:0.8rem; padding:4px 8px; display:inline-flex; align-items:center; gap:4px;" title="답변 대기 중 질문 삭제">
                                ${ICONS.trash} 삭제
                            </button>
                        </div>
                    ` : ''}
                </div>

                <div class="feed-title">
                    <span>Q. ${escapeHtml(q.question_text)}</span>
                </div>

                ${q.question_image_url ? `
                    <div class="image-preview-wrapper" onclick="openImageLightbox('${escapeHtml(q.question_image_url)}', '문제 사진')" title="탭하여 원본 사진 보기">
                        <img src="${q.question_image_url}" alt="문제 사진" loading="lazy">
                        <div class="image-zoom-overlay">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                            <span>탭하여 확대</span>
                        </div>
                    </div>
                ` : ''}

                <div class="answer-box">
                    ${hasAnswer ? `
                        <div class="answer-box-title" style="margin-bottom:4px;">선생님 풀이 해설</div>
                        <p class="answer-box-content">${escapeHtml(q.answer_text || '')}</p>
                        ${q.answer_image_url ? `
                            <div class="image-preview-wrapper" style="margin-top:8px;" onclick="openImageLightbox('${escapeHtml(q.answer_image_url)}', '선생님 풀이 사진')" title="탭하여 풀이 사진 보기">
                                <img src="${q.answer_image_url}" alt="풀이 사진" loading="lazy">
                                <div class="image-zoom-overlay">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                                    <span>탭하여 확대</span>
                                </div>
                            </div>
                        ` : ''}
                    ` : `
                        <span style="color:var(--warning); font-weight:600; font-size:0.85rem;">선생님이 문제를 확인하고 풀이를 작성 중입니다.</span>
                    `}
                </div>
            </div>
        `;
    }).join('');
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
        myQuestionsCache = Array.isArray(questions) ? questions : [];

        // 질문 현황 통계 계산 및 UI 업데이트
        const totalCount = myQuestionsCache.length;
        const answeredCount = myQuestionsCache.filter(q => Boolean(q.is_answered || (q.answer_text && q.answer_text.trim() !== ''))).length;
        const waitingCount = totalCount - answeredCount;

        const totalEl = document.getElementById('studyTotalQCount');
        const waitEl = document.getElementById('studyWaitingQCount');
        const ansEl = document.getElementById('studyAnsweredQCount');
        if (totalEl) totalEl.textContent = totalCount;
        if (waitEl) waitEl.textContent = waitingCount;
        if (ansEl) ansEl.textContent = answeredCount;

        const qStat = document.getElementById('studentStatQuestions');
        if (qStat) qStat.textContent = totalCount;

        updateQuestionFilterUI();
        renderStudentQuestionsFeed();
    } catch (err) {
        console.error('내 질문 로드 실패:', err);
        list.innerHTML = '<div style="text-align:center; color:var(--danger); padding:30px 0;">질문 목록을 불러오지 못했습니다.</div>';
    }
}

window.deleteStudentQuestion = async function(id) {
    if (!confirm('작성하신 질문을 삭제하시겠습니까?')) return;
    try {
        const res = await authFetch(`/api/askQuestion?id=${id}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '질문 삭제 실패');

        alert('질문이 삭제되었습니다.');
        loadMyQuestions();
    } catch (err) {
        alert(err.message);
    }
};

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
            list.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:30px 0; font-size:0.88rem;">아직 도착한 과외 일지가 없습니다.</div>';
            return;
        }

        list.innerHTML = feedbacks.map(f => {
            const subjectBadge = f.subjects ? `<span class="badge" style="background:${f.subjects.color}15; color:${f.subjects.color}; border: 1px solid ${f.subjects.color}35;">${escapeHtml(f.subjects.name)}</span>` : '';
            return `
                <div class="feed-card">
                    <div class="feed-header">
                        ${subjectBadge}
                        <span style="font-size:0.78rem; color:var(--text-muted);">${new Date(f.created_at).toLocaleDateString()}</span>
                    </div>
                    <div style="font-size:1.02rem; font-weight:700; color:var(--text-primary); margin-bottom: 6px;">
                        ${escapeHtml(f.feedback_title || '과외 일지')}
                    </div>
                    <div class="feedback-box-content">${escapeHtml(f.feedback_text)}</div>
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

        alert('질문이 등록되었습니다. 선생님께 알림이 전송되었습니다.');
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
// 📅 수업 캘린더 로직 (초고속 캐싱 & 0ms 즉시 렌더링 최적화)
// ==========================================
const calendarScheduleCache = new Map();
let calendarFetchRequestId = 0;

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

function goToToday() {
    const today = new Date();
    calendarYear = today.getFullYear();
    calendarMonth = today.getMonth();
    renderCalendar();

    // 오늘 일자 상세 일정 로드 (스크롤 이동 없이 부드럽게 선택)
    const todayStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    selectCalendarDate(todayStr, false);
}

// ⚡ 0ms 즉시 그리드 DOM 렌더링 함수 (지연 체감 100% 제거)
function renderCalendarGridDOM(year, month, schedules) {
    const isTeacher = currentUser && (currentUser.role === 'admin' || currentUser.role === 'teacher');
    const monthTitleId = isTeacher ? 'calendarCurrentMonthTitle' : 'studentCalendarMonthTitle';
    const gridId = isTeacher ? 'calendarGridDays' : 'studentCalendarGridDays';

    const monthTitle = document.getElementById(monthTitleId);
    const grid = document.getElementById(gridId);
    if (!monthTitle || !grid) return;

    monthTitle.textContent = `${year}년 ${month + 1}월`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const prevLastDate = new Date(year, month, 0).getDate();

    const today = new Date();
    const isCurrentMonthYear = today.getFullYear() === year && today.getMonth() === month;

    let cellsHtml = '';

    // 이전 달 잔여 일자
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const dayNum = prevLastDate - i;
        cellsHtml += `<div class="calendar-cell other-month"><div class="calendar-date-num">${dayNum}</div></div>`;
    }

    // 이번 달 일자 (1 ~ lastDate)
    for (let d = 1; d <= lastDate; d++) {
        const isToday = isCurrentMonthYear && today.getDate() === d;
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        const daySchedules = schedules.filter(s => {
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
            <div class="calendar-cell ${isToday ? 'today' : ''}" data-date="${dateStr}" onclick="selectCalendarDate('${dateStr}')">
                <div class="calendar-date-num">${d}</div>
                ${eventsHtml}
            </div>
        `;
    }

    // 다음 달 잔여 일자
    const totalRendered = firstDayIndex + lastDate;
    const remaining = (7 - (totalRendered % 7)) % 7;
    for (let j = 1; j <= remaining; j++) {
        cellsHtml += `<div class="calendar-cell other-month"><div class="calendar-date-num">${j}</div></div>`;
    }

    grid.innerHTML = cellsHtml;

    // 부드러운 전환 효과 트리거
    grid.classList.remove('month-transition');
    void grid.offsetWidth;
    grid.classList.add('month-transition');
}

// 🚀 인접한 이전 달/다음 달 일정을 백그라운드에서 사전 로드 (Pre-fetching)
function prefetchAdjacentMonths(year, month) {
    [-1, 1].forEach(offset => {
        let pYear = year;
        let pMonth = month + offset;
        if (pMonth < 0) {
            pMonth = 11;
            pYear--;
        } else if (pMonth > 11) {
            pMonth = 0;
            pYear++;
        }

        const pCacheKey = `${pYear}-${pMonth}-${currentSubjectFilter || 'all'}`;
        if (calendarScheduleCache.has(pCacheKey)) return;

        const startDate = new Date(pYear, pMonth, 1).toISOString();
        const endDate = new Date(pYear, pMonth + 1, 0, 23, 59, 59).toISOString();

        let url = `/api/schedules?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
        if (currentSubjectFilter) url += `&subject_id=${currentSubjectFilter}`;

        authFetch(url)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    calendarScheduleCache.set(pCacheKey, data);
                }
            })
            .catch(() => {});
    });
}

async function renderCalendar(forceRefresh = false) {
    const year = calendarYear;
    const month = calendarMonth;
    const cacheKey = `${year}-${month}-${currentSubjectFilter || 'all'}`;

    // 1. 이미 캐시에 데이터가 있으면 -> 0ms로 즉시 렌더링!
    if (!forceRefresh && calendarScheduleCache.has(cacheKey)) {
        currentMonthSchedules = calendarScheduleCache.get(cacheKey);
        renderCalendarGridDOM(year, month, currentMonthSchedules);
        prefetchAdjacentMonths(year, month);
        return;
    }

    // 2. 캐시 미스 시: 날짜 달력 그리드는 0ms 즉각 화면 전환! (기존 월 지연 체감 100% 제거)
    // 이전 달 일정 잔상이 남지 않도록 임시로 빈 배열을 전달하여 즉시 새 달 날짜(1~31) 표시
    renderCalendarGridDOM(year, month, []);

    const requestId = ++calendarFetchRequestId;

    const startDate = new Date(year, month, 1).toISOString();
    const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    let url = `/api/schedules?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
    if (currentSubjectFilter) url += `&subject_id=${currentSubjectFilter}`;

    try {
        const res = await authFetch(url);
        const data = await res.json();
        const schedules = Array.isArray(data) ? data : [];

        // 캐시 저장
        calendarScheduleCache.set(cacheKey, schedules);

        // 사용자가 여전히 이 달을 보고 있는 경우 일정 뱃지 업데이트
        if (requestId === calendarFetchRequestId && calendarYear === year && calendarMonth === month) {
            currentMonthSchedules = schedules;
            renderCalendarGridDOM(year, month, schedules);
        }
    } catch (err) {
        console.error('캘린더 일정 로드 실패:', err);
    }

    // 이전달 & 다음달 백그라운드 프리페치 실행
    prefetchAdjacentMonths(year, month);
}

window.selectCalendarDate = function(dateStr, shouldScroll = true) {
    const isTeacher = currentUser && (currentUser.role === 'admin' || currentUser.role === 'teacher');
    const cardId = isTeacher ? 'selectedDateScheduleCard' : 'studentSelectedDateCard';
    const titleId = isTeacher ? 'selectedDateTitle' : 'studentSelectedDateTitle';
    const listId = isTeacher ? 'selectedDateScheduleList' : 'studentSelectedDateList';

    const card = document.getElementById(cardId);
    const title = document.getElementById(titleId);
    const list = document.getElementById(listId);
    if (!card || !title || !list) return;

    // 선택된 날짜 셀 하이라이트 표시
    document.querySelectorAll('.calendar-cell').forEach(cell => cell.classList.remove('selected-date'));
    const targetCell = document.querySelector(`.calendar-cell[data-date="${dateStr}"]`);
    if (targetCell) targetCell.classList.add('selected-date');

    const daySchedules = currentMonthSchedules.filter(s => s.start_time.split('T')[0] === dateStr);
    title.textContent = `${dateStr} 수업 일정 (${daySchedules.length}건)`;
    card.classList.remove('hidden');

    if (daySchedules.length === 0) {
        list.innerHTML = '<li style="text-align:center; color:var(--text-muted); padding:20px 0; font-size:0.88rem;">이날에는 예정된 수업이 없습니다.</li>';
        return;
    }

    list.innerHTML = daySchedules.map(s => {
        const startTime = new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const endTime = new Date(s.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const subjectName = (s.subjects && s.subjects.name) || '과목 미지정';
        const studentName = s.profiles ? `${s.profiles.name} 1:1` : '과목 공통';
        const color = (s.subjects && s.subjects.color) || '#0d9488';
        const isCompleted = s.status === 'completed';

        return `
            <li class="schedule-feed-item" style="border-left: 3px solid ${color};">
                <div style="flex:1;">
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        <span class="badge" style="background:${color}15; color:${color}; font-size:0.75rem;">${escapeHtml(subjectName)}</span>
                        <span class="badge" style="background:var(--bg-subtle); color:var(--text-secondary); font-size:0.75rem;">${escapeHtml(studentName)}</span>
                        <span style="font-size:0.8rem; color:var(--text-muted);">${startTime} ~ ${endTime}</span>
                        ${isCompleted ? `<span class="badge badge-answered" style="font-size:0.72rem;">${ICONS.check} 수업 완료</span>` : ''}
                    </div>
                    <div style="font-weight:700; font-size:1rem; margin-top:6px; color:var(--text-primary);">${escapeHtml(s.title)}</div>
                    ${s.notes ? `<div style="margin-top:8px; font-size:0.88rem; background:var(--bg-subtle); padding:8px 12px; border-radius:var(--radius-xs); color:var(--text-secondary);">메모: ${escapeHtml(s.notes)}</div>` : ''}
                </div>
                ${isTeacher ? `
                    <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end;">
                        <button class="small-btn" style="${isCompleted ? 'background:var(--bg-subtle); color:var(--text-secondary);' : 'background:var(--success); color:#ffffff; border:none;'}" onclick="toggleScheduleStatus(${s.id}, '${isCompleted ? 'scheduled' : 'completed'}')">
                            ${isCompleted ? '완료취소' : '수업완료'}
                        </button>
                        <button class="danger-link-btn" onclick="deleteSchedule(${s.id})">삭제</button>
                    </div>
                ` : ''}
            </li>
        `;
    }).join('');

    if (shouldScroll) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
};

window.toggleScheduleStatus = async function(id, newStatus) {
    try {
        await authFetch('/api/schedules', {
            method: 'PUT',
            body: JSON.stringify({ id, status: newStatus })
        });
        calendarScheduleCache.clear();
        renderCalendar(true);
    } catch (err) {
        alert(err.message);
    }
};

window.deleteSchedule = async function(id) {
    if (!confirm('수업 일정을 삭제하시겠습니까?')) return;
    try {
        await authFetch(`/api/schedules?id=${id}`, { method: 'DELETE' });
        calendarScheduleCache.clear();
        renderCalendar(true);
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

        alert('수업 일정이 등록되었습니다.');
        closeModal('addScheduleModal');
        document.getElementById('scheduleTitle').value = '';
        document.getElementById('scheduleNotes').value = '';
        calendarScheduleCache.clear();
        renderCalendar(true);
    } catch (err) {
        alert(err.message);
    } finally {
        setButtonLoading(btn, false);
    }
}

// ==========================================
// 🛠 모달 헬퍼 및 바텀 시트 인터랙션 유틸리티
// ==========================================
function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    const content = modal.querySelector('.modal-content');
    if (content) {
        content.style.transform = '';
        content.style.transition = '';
    }
    modal.classList.remove('hidden');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    const content = modal.querySelector('.modal-content');

    if (window.innerWidth <= 640 && content) {
        content.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
        content.style.transform = 'translateY(100%)';
        setTimeout(() => {
            modal.classList.add('hidden');
            content.style.transform = '';
            content.style.transition = '';
        }, 220);
    } else {
        modal.classList.add('hidden');
        if (content) {
            content.style.transform = '';
            content.style.transition = '';
        }
    }
}

function setupBottomSheetSwipeToDismiss() {
    const overlays = document.querySelectorAll('.modal-overlay');

    overlays.forEach(overlay => {
        // 1. 오버레이 바깥 어두운 배경 클릭 시 닫기
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal(overlay.id);
            }
        });

        // 2. 닫기 버튼 클릭 시 애니메이션과 함께 닫기
        overlay.querySelectorAll('.modal-close-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                closeModal(overlay.id);
            });
        });

        const content = overlay.querySelector('.modal-content');
        if (!content) return;

        let startY = 0;
        let currentY = 0;
        let isDragging = false;
        let isAtTop = false;

        // 드래그 핸들이나 상단 헤더, 모달 최상단에서 터치 시작 시 제스처 추적
        content.addEventListener('touchstart', (e) => {
            if (window.innerWidth > 640) return;

            isAtTop = (content.scrollTop <= 2);
            startY = e.touches[0].clientY;
            currentY = startY;
            isDragging = false;
        }, { passive: true });

        content.addEventListener('touchmove', (e) => {
            if (window.innerWidth > 640) return;
            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;

            // 스크롤이 최상단이고 손가락을 아래로 당기는 경우
            if (isAtTop && deltaY > 0) {
                isDragging = true;
                content.style.transition = 'none';
                content.style.transform = `translateY(${deltaY}px)`;
                if (e.cancelable) e.preventDefault();
            }
        }, { passive: false });

        const handleTouchEnd = () => {
            if (!isDragging || window.innerWidth > 640) return;
            const deltaY = currentY - startY;
            isDragging = false;

            // 70px 이상 아래로 내렸으면 자연스럽게 슬라이드 다운 후 닫기
            if (deltaY > 70) {
                content.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
                content.style.transform = 'translateY(100%)';
                setTimeout(() => {
                    overlay.classList.add('hidden');
                    content.style.transform = '';
                    content.style.transition = '';
                }, 220);
            } else {
                // 살짝 당기다 말았으면 원래 위치로 통통 튀며 복귀 (스냅 백)
                content.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
                content.style.transform = 'translateY(0)';
                setTimeout(() => {
                    content.style.transform = '';
                    content.style.transition = '';
                }, 200);
            }
        };

        content.addEventListener('touchend', handleTouchEnd, { passive: true });
        content.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    });
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

// ==========================================
// 📅 1. 다음 수업 안내 카드 (Upcoming Class)
// ==========================================
function formatDateShort(dateVal) {
    if (!dateVal) return '';
    try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return String(dateVal);
        const m = d.getMonth() + 1;
        const day = d.getDate();
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${m}월 ${day}일 ${h}:${min}`;
    } catch (e) {
        return String(dateVal);
    }
}

async function loadUpcomingClass() {
    if (!currentUser || currentUser.role === 'admin' || currentUser.role === 'teacher') return;

    try {
        const now = new Date();
        const res = await authFetch('/api/schedules');
        if (!res.ok) return;
        const schedules = await res.json();

        if (!Array.isArray(schedules)) return;

        // 끝난 시간(end_time)이 현재 시각 이후인 예정된 수업만 필터링 후 시작시간 오름차순
        let filtered = schedules.filter(s => s.status !== 'cancelled' && new Date(s.end_time) >= now);
        if (currentSubjectFilter) {
            filtered = filtered.filter(s => s.subject_id === currentSubjectFilter);
        }
        filtered.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

        renderUpcomingClassCard(filtered[0] || null);
    } catch (err) {
        console.error('다음 수업 로드 실패:', err);
    }
}

function renderUpcomingClassCard(schedule) {
    const ddayEl = document.getElementById('upcomingClassDday');
    const subEl = document.getElementById('upcomingClassSubject');
    const titleEl = document.getElementById('upcomingClassTitle');
    const timeEl = document.getElementById('upcomingClassTime');
    const notesBox = document.getElementById('upcomingClassNotesBox');
    const notesText = document.getElementById('upcomingClassNotes');

    if (!schedule) {
        if (ddayEl) {
            ddayEl.textContent = '일정 없음';
            ddayEl.style.background = 'var(--text-muted)';
        }
        if (subEl) subEl.textContent = '예정된 수업 없음';
        if (titleEl) titleEl.textContent = '등록된 다음 수업 일정이 없습니다';
        if (timeEl) timeEl.textContent = '선생님이 일정을 등록하면 실시간으로 안내됩니다.';
        if (notesBox) notesBox.classList.add('hidden');
        return;
    }

    const now = new Date();
    const start = new Date(schedule.start_time);
    const end = new Date(schedule.end_time);

    // D-Day 계산
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const diffDays = Math.round((startDate - nowDate) / (1000 * 60 * 60 * 24));

    let ddayText = '다음 수업';
    if (start <= now && now <= end) {
        ddayText = '수업 진행 중';
    } else if (diffDays === 0) {
        ddayText = '오늘 수업';
    } else if (diffDays === 1) {
        ddayText = '내일 수업';
    } else if (diffDays > 1) {
        ddayText = `D-${diffDays}`;
    }

    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const month = start.getMonth() + 1;
    const date = start.getDate();
    const day = dayNames[start.getDay()];
    const startHour = String(start.getHours()).padStart(2, '0');
    const startMin = String(start.getMinutes()).padStart(2, '0');
    const endHour = String(end.getHours()).padStart(2, '0');
    const endMin = String(end.getMinutes()).padStart(2, '0');

    if (ddayEl) {
        ddayEl.textContent = ddayText;
        ddayEl.style.background = '';
    }
    if (subEl) {
        const subName = schedule.subjects ? schedule.subjects.name : '과외 수업';
        subEl.textContent = subName;
    }
    if (titleEl) {
        titleEl.textContent = schedule.title;
    }
    if (timeEl) {
        timeEl.textContent = `${month}월 ${date}일 (${day}) ${startHour}:${startMin} ~ ${endHour}:${endMin}`;
    }
    if (schedule.notes && schedule.notes.trim()) {
        if (notesText) notesText.textContent = schedule.notes;
        if (notesBox) notesBox.classList.remove('hidden');
    } else {
        if (notesBox) notesBox.classList.add('hidden');
    }
}

// ==========================================
// 📈 2. 성적 추이 그래프 렌더링 (SVG Chart)
// ==========================================
function renderScoreTrendChart(exams) {
    const container = document.getElementById('scoreChartContainer');
    const avgBadge = document.getElementById('studyExamAvgBadge');
    if (!container) return;

    if (!Array.isArray(exams) || exams.length === 0) {
        if (avgBadge) avgBadge.classList.add('hidden');
        container.innerHTML = `
            <div class="empty-chart-box">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                <p>등록된 시험 성적이 없습니다.</p>
                <span class="sub-text">선생님이 시험 성적을 등록하면 이곳에 성적 추이 그래프가 나타납니다.</span>
            </div>
        `;
        return;
    }

    // 날짜 오름차순 정렬 (과거 -> 최신)
    const sorted = [...exams].sort((a, b) => {
        const da = new Date(a.exam_date || a.created_at || 0);
        const db = new Date(b.exam_date || b.created_at || 0);
        return da - db;
    });

    const scores = sorted.map(e => Number(e.score) || 0);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const maxScore = Math.max(...scores);

    if (avgBadge) {
        avgBadge.textContent = `평균 ${avgScore}점 (최고 ${maxScore}점)`;
        avgBadge.classList.remove('hidden');
    }

    // SVG 차트 좌표 계산
    const svgWidth = 400;
    const svgHeight = 170;
    const padLeft = 38;
    const padRight = 24;
    const padTop = 26;
    const padBottom = 32;
    const chartW = svgWidth - padLeft - padRight;
    const chartH = svgHeight - padTop - padBottom;

    // Y 좌표 매핑 (0 ~ 100점)
    const getY = (val) => padTop + chartH - ((Math.min(Math.max(val, 0), 100) / 100) * chartH);

    // X 좌표 매핑
    const getX = (idx) => {
        if (sorted.length === 1) return padLeft + chartW / 2;
        return padLeft + (idx / (sorted.length - 1)) * chartW;
    };

    const points = sorted.map((e, idx) => ({
        x: getX(idx),
        y: getY(Number(e.score) || 0),
        score: Number(e.score) || 0,
        title: e.exam_title || '시험',
        date: e.exam_date ? e.exam_date.substring(5, 10).replace('-', '/') : ''
    }));

    // SVG path 생성
    let pathD = '';
    let areaD = '';
    if (points.length === 1) {
        pathD = `M ${points[0].x - 24} ${points[0].y} L ${points[0].x + 24} ${points[0].y}`;
    } else {
        pathD = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            pathD += ` L ${points[i].x} ${points[i].y}`;
        }
        const bottomY = padTop + chartH;
        areaD = `${pathD} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`;
    }

    const yGrid100 = getY(100);
    const yGrid75 = getY(75);
    const yGrid50 = getY(50);
    const yGrid0 = getY(0);

    const svgHtml = `
        <svg class="score-chart-svg" viewBox="0 0 ${svgWidth} ${svgHeight}">
            <defs>
                <linearGradient id="scoreAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.28" />
                    <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.0" />
                </linearGradient>
                <linearGradient id="scoreLineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stop-color="#3b82f6" />
                    <stop offset="100%" stop-color="#2563eb" />
                </linearGradient>
            </defs>

            <!-- Y축 그리드 가이드라인 및 라벨 -->
            <line x1="${padLeft}" y1="${yGrid100}" x2="${svgWidth - padRight}" y2="${yGrid100}" stroke="var(--border-color)" stroke-dasharray="3,3" opacity="0.6"/>
            <text x="${padLeft - 6}" y="${yGrid100 + 4}" font-size="10" fill="var(--text-muted)" text-anchor="end" font-weight="600">100</text>

            <line x1="${padLeft}" y1="${yGrid75}" x2="${svgWidth - padRight}" y2="${yGrid75}" stroke="var(--border-color)" stroke-dasharray="3,3" opacity="0.35"/>
            <text x="${padLeft - 6}" y="${yGrid75 + 4}" font-size="10" fill="var(--text-muted)" text-anchor="end">75</text>

            <line x1="${padLeft}" y1="${yGrid50}" x2="${svgWidth - padRight}" y2="${yGrid50}" stroke="var(--border-color)" stroke-dasharray="3,3" opacity="0.35"/>
            <text x="${padLeft - 6}" y="${yGrid50 + 4}" font-size="10" fill="var(--text-muted)" text-anchor="end">50</text>

            <line x1="${padLeft}" y1="${yGrid0}" x2="${svgWidth - padRight}" y2="${yGrid0}" stroke="var(--border-color)" opacity="0.8"/>
            <text x="${padLeft - 6}" y="${yGrid0 + 3}" font-size="10" fill="var(--text-muted)" text-anchor="end">0</text>

            <!-- 영역 채우기 -->
            ${areaD ? `<path d="${areaD}" fill="url(#scoreAreaGrad)"/>` : ''}

            <!-- 선 그래프 -->
            <path d="${pathD}" fill="none" stroke="url(#scoreLineGrad)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>

            <!-- 점 및 텍스트 라벨 -->
            ${points.map(pt => `
                <g class="chart-point-group">
                    <circle cx="${pt.x}" cy="${pt.y}" r="5.5" fill="#ffffff" stroke="#2563eb" stroke-width="2.5" />
                    <text x="${pt.x}" y="${pt.y - 9}" font-size="11" font-weight="800" fill="#1d4ed8" text-anchor="middle">${pt.score}점</text>
                    <text x="${pt.x}" y="${padTop + chartH + 18}" font-size="10" font-weight="600" fill="var(--text-muted)" text-anchor="middle">${escapeHtml(pt.date || pt.title.substring(0, 5))}</text>
                </g>
            `).join('')}
        </svg>
    `;

    container.innerHTML = svgHtml;
}

// ==========================================
// 📸 3. 모르는 문제 질문하기 전용 바텀 시트 모달 핸들러
// ==========================================
window.openStudentAskModal = function() {
    updateStudentSubjectSelectOptions();
    openModal('studentAskModal');
};

window.handleModalQuestionImageChange = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const previewWrapper = document.getElementById('modalQuestionImagePreview');
    const previewImg = document.getElementById('modalQuestionImagePreviewImg');
    const label = document.getElementById('modalQuestionUploadLabel');

    const reader = new FileReader();
    reader.onload = (evt) => {
        if (previewImg) previewImg.src = evt.target.result;
        if (previewWrapper) previewWrapper.classList.remove('hidden');
        if (label) label.textContent = file.name;
    };
    reader.readAsDataURL(file);
};

window.clearModalQuestionImage = function(e) {
    if (e) e.stopPropagation();
    const fileInput = document.getElementById('modalQuestionImage');
    if (fileInput) fileInput.value = '';
    const previewWrapper = document.getElementById('modalQuestionImagePreview');
    if (previewWrapper) previewWrapper.classList.add('hidden');
    const previewImg = document.getElementById('modalQuestionImagePreviewImg');
    if (previewImg) previewImg.src = '';
    const label = document.getElementById('modalQuestionUploadLabel');
    if (label) label.textContent = '사진 촬영 또는 앨범에서 선택';
};

window.handleModalSubmitQuestion = async function() {
    const textEl = document.getElementById('modalQuestionText');
    const subSel = document.getElementById('modalAskSubjectSelect');
    const fileEl = document.getElementById('modalQuestionImage');
    const btn = document.getElementById('modalAskQuestionSubmitBtn');

    const text = textEl ? textEl.value.trim() : '';
    const subjectId = subSel ? subSel.value : '';
    const file = fileEl && fileEl.files ? fileEl.files[0] : null;

    if (!text) {
        alert('질문 내용을 입력해 주세요.');
        if (textEl) textEl.focus();
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

        showToast('질문 등록 완료', '선생님께 질문이 성공적으로 전송되었습니다.');
        closeModal('studentAskModal');

        // 입력 폼 초기화
        if (textEl) textEl.value = '';
        clearModalQuestionImage();

        // 질문 목록 및 현황 통계 새로고침
        await loadMyQuestions();
    } catch (err) {
        alert(err.message);
    } finally {
        setButtonLoading(btn, false);
    }
};

// ==========================================
// 🔍 4. 마이페이지 상세 내역 드릴다운 모달 (학생 & 선생 공용)
// ==========================================
let currentMypageDetailType = null;
let currentMypageDetailItem = null;

function setMypageDetailTitle(type) {
    const titleEl = document.getElementById('mypageDetailTitle');
    if (!titleEl) return;
    switch(type) {
        case 'student-subjects': titleEl.textContent = '나의 수강 과목'; break;
        case 'student-questions': titleEl.textContent = '나의 질문 내역'; break;
        case 'student-exams': titleEl.textContent = '나의 응시 시험'; break;
        case 'teacher-subjects': titleEl.textContent = '개설 과목 관리'; break;
        case 'teacher-students': titleEl.textContent = '담당 학생 목록'; break;
        case 'teacher-unanswered': titleEl.textContent = '답변 대기 질문'; break;
        default: titleEl.textContent = '상세 내역';
    }
}

window.openMypageDetail = async function(type) {
    currentMypageDetailType = type;
    currentMypageDetailItem = null;

    const modal = document.getElementById('mypageDetailModal');
    if (!modal) return;

    const backBtn = document.getElementById('mypageDetailBackBtn');
    const listView = document.getElementById('mypageDetailListView');
    const subView = document.getElementById('mypageDetailSubView');

    if (backBtn) backBtn.classList.add('hidden');
    if (listView) listView.classList.remove('hidden');
    if (subView) subView.classList.add('hidden');

    setMypageDetailTitle(type);
    openModal('mypageDetailModal');

    await renderMypageDetailList(type);
};

window.mypageDetailGoBack = function() {
    const backBtn = document.getElementById('mypageDetailBackBtn');
    const listView = document.getElementById('mypageDetailListView');
    const subView = document.getElementById('mypageDetailSubView');

    if (backBtn) backBtn.classList.add('hidden');
    if (subView) subView.classList.add('hidden');
    if (listView) listView.classList.remove('hidden');

    if (currentMypageDetailType) {
        setMypageDetailTitle(currentMypageDetailType);
    }
};

function formatStudentLoginId(stu) {
    if (!stu) return '';
    const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());

    let lid = typeof stu === 'object' ? (stu.login_id || stu.loginId) : stu;
    if (lid && !isUuid(lid)) {
        return String(lid).trim();
    }

    const sid = typeof stu === 'object' ? (stu.id || stu.student_id) : stu;
    if (sid) {
        const studentPool = (Array.isArray(totalStudentsCache) && totalStudentsCache.length > 0)
            ? totalStudentsCache
            : (Array.isArray(allStudentsCache) ? allStudentsCache : []);
        const found = studentPool.find(s => s && (s.id == sid || s.student_id == sid));
        if (found && found.login_id && !isUuid(found.login_id)) {
            return String(found.login_id).trim();
        }
    }

    if (typeof stu === 'object' && stu.email && typeof stu.email === 'string') {
        return stu.email.replace('@tutor.com', '').split('@')[0];
    }

    return '';
}

async function renderMypageDetailList(type) {
    const container = document.getElementById('mypageDetailListContainer');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center; padding:24px; color:var(--text-muted);">불러오는 중...</div>';

    // 1. 학생: 수강 과목
    if (type === 'student-subjects') {
        if (!Array.isArray(mySubjects) || mySubjects.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:28px 0; color:var(--text-muted);">수강 중인 과목이 없습니다.</div>';
            return;
        }
        container.innerHTML = mySubjects.map(s => `
            <div class="drilldown-item-card" onclick="showMypageSubDetail('student-subjects', ${s.id})">
                <div class="drilldown-item-main">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="subject-color-dot" style="background:${s.color};"></span>
                        <span class="drilldown-item-title">${escapeHtml(s.name)}</span>
                    </div>
                    <div class="drilldown-item-desc">${s.target_grade ? escapeHtml(s.target_grade) : '전체 학년'} · ${s.room ? escapeHtml(s.room) : '교실 미지정'}</div>
                </div>
                <svg class="drilldown-item-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
        `).join('');
    }

    // 2. 학생: 질문 내역
    else if (type === 'student-questions') {
        if (!Array.isArray(myQuestionsCache) || myQuestionsCache.length === 0) {
            await loadMyQuestions();
        }
        if (!Array.isArray(myQuestionsCache) || myQuestionsCache.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:28px 0; color:var(--text-muted);">등록된 질문 내역이 없습니다.</div>';
            return;
        }
        container.innerHTML = myQuestionsCache.map(q => {
            const hasAnswer = Boolean(q.is_answered || (q.answer_text && q.answer_text.trim() !== ''));
            return `
                <div class="drilldown-item-card" onclick="showMypageSubDetail('student-questions', ${q.id})">
                    <div class="drilldown-item-main">
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                            ${q.subjects ? `<span class="badge" style="background:${q.subjects.color}15; color:${q.subjects.color}; font-size:0.75rem;">${escapeHtml(q.subjects.name)}</span>` : ''}
                            ${hasAnswer 
                                ? '<span class="badge badge-answered" style="font-size:0.75rem;">답변 완료</span>' 
                                : '<span class="badge badge-waiting" style="font-size:0.75rem;">풀이 작성 중</span>'}
                        </div>
                        <div class="drilldown-item-title">Q. ${escapeHtml(q.question_text)}</div>
                        <div class="drilldown-item-desc">${formatDateShort(q.created_at)}</div>
                    </div>
                    <svg class="drilldown-item-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
            `;
        }).join('');
    }

    // 3. 학생: 응시 시험
    else if (type === 'student-exams') {
        if (!Array.isArray(myExamsCache) || myExamsCache.length === 0) {
            await loadMyExams();
        }
        if (!Array.isArray(myExamsCache) || myExamsCache.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:28px 0; color:var(--text-muted);">응시한 시험 기록이 없습니다.</div>';
            return;
        }
        container.innerHTML = myExamsCache.map(e => `
            <div class="drilldown-item-card" onclick="showMypageSubDetail('student-exams', ${e.id})">
                <div class="drilldown-item-main">
                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                        ${e.subjects ? `<span class="badge" style="background:${e.subjects.color}15; color:${e.subjects.color}; font-size:0.75rem;">${escapeHtml(e.subjects.name)}</span>` : ''}
                        <span class="badge badge-score" style="font-size:0.75rem;">${e.score}점</span>
                    </div>
                    <div class="drilldown-item-title">${escapeHtml(e.exam_title)}</div>
                    <div class="drilldown-item-desc">응시일: ${e.exam_date || formatDateShort(e.created_at)}</div>
                </div>
                <svg class="drilldown-item-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
        `).join('');
    }

    // 4. 선생님: 개설 과목
    else if (type === 'teacher-subjects') {
        if (!Array.isArray(mySubjects) || mySubjects.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:28px 0; color:var(--text-muted);">개설된 과목이 없습니다.</div>';
            return;
        }
        container.innerHTML = mySubjects.map(s => {
            const studentCount = s.enrollments ? s.enrollments.length : 0;
            return `
                <div class="drilldown-item-card" onclick="showMypageSubDetail('teacher-subjects', ${s.id})">
                    <div class="drilldown-item-main">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span class="subject-color-dot" style="background:${s.color};"></span>
                            <span class="drilldown-item-title">${escapeHtml(s.name)}</span>
                        </div>
                        <div class="drilldown-item-desc">수강생 ${studentCount}명 · ${s.target_grade ? escapeHtml(s.target_grade) : '전체 학년'}</div>
                    </div>
                    <svg class="drilldown-item-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
            `;
        }).join('');
    }

    // 5. 선생님: 담당 학생
    else if (type === 'teacher-students') {
        if (!Array.isArray(totalStudentsCache) || totalStudentsCache.length === 0) {
            await loadStudents();
        }
        const studentList = (Array.isArray(totalStudentsCache) && totalStudentsCache.length > 0)
            ? totalStudentsCache
            : allStudentsCache;

        if (!Array.isArray(studentList) || studentList.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:28px 0; color:var(--text-muted);">등록된 담당 학생이 없습니다.</div>';
            return;
        }
        container.innerHTML = studentList.map(stu => {
            const lid = formatStudentLoginId(stu);
            return `
            <div class="drilldown-item-card" onclick="showMypageSubDetail('teacher-students', '${stu.id || stu.student_id}')">
                <div class="drilldown-item-main">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="badge-student" style="font-size:0.75rem;">학생</span>
                        <span class="drilldown-item-title">${escapeHtml(stu.name || '학생')}</span>
                    </div>
                    <div class="drilldown-item-desc">${lid ? `아이디: @${escapeHtml(lid)}` : '수강생'}</div>
                </div>
                <svg class="drilldown-item-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
            `;
        }).join('');
    }

    // 6. 선생님: 답변 대기 질문
    else if (type === 'teacher-unanswered') {
        if (!Array.isArray(teacherAllQuestionsCache) || teacherAllQuestionsCache.length === 0) {
            await loadAllTeacherQuestions(true);
        }
        const unanswered = teacherAllQuestionsCache.filter(q => !(q.is_answered || (q.answer_text && q.answer_text.trim() !== '')));

        if (unanswered.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:36px 16px; color:var(--text-muted);">
                    <div style="width:48px; height:48px; border-radius:50%; background:rgba(16, 185, 129, 0.1); display:inline-flex; align-items:center; justify-content:center; margin-bottom:12px; border:1px solid rgba(16, 185, 129, 0.25);">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    </div>
                    <div style="font-weight:700; color:var(--text-primary); margin-bottom:4px;">현재 답변 대기 중인 질문이 없습니다</div>
                    <div style="font-size:0.82rem;">모든 학생의 질문에 답변이 완료되었습니다.</div>
                </div>
            `;
            return;
        }

        container.innerHTML = unanswered.map(q => `
            <div class="drilldown-item-card" onclick="showMypageSubDetail('teacher-unanswered', ${q.id})">
                <div class="drilldown-item-main">
                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                        <span class="badge-student" style="font-size:0.75rem;">${escapeHtml(q.profiles?.name || '학생')}</span>
                        ${q.subjects ? `<span class="badge" style="background:${q.subjects.color}15; color:${q.subjects.color}; font-size:0.75rem;">${escapeHtml(q.subjects.name)}</span>` : ''}
                        <span class="badge badge-waiting" style="font-size:0.75rem;">답변 대기</span>
                    </div>
                    <div class="drilldown-item-title">Q. ${escapeHtml(q.question_text)}</div>
                    <div class="drilldown-item-desc">${formatDateShort(q.created_at)}</div>
                </div>
                <svg class="drilldown-item-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
        `).join('');
    }
}

window.showMypageSubDetail = function(type, id) {
    const backBtn = document.getElementById('mypageDetailBackBtn');
    const listView = document.getElementById('mypageDetailListView');
    const subView = document.getElementById('mypageDetailSubView');
    const content = document.getElementById('mypageDetailContentContainer');
    const titleEl = document.getElementById('mypageDetailTitle');

    if (!content) return;

    if (backBtn) backBtn.classList.remove('hidden');
    if (listView) listView.classList.add('hidden');
    if (subView) subView.classList.remove('hidden');

    // 1. 학생: 수강 과목 상세
    if (type === 'student-subjects') {
        const item = mySubjects.find(s => s.id === Number(id));
        if (!item) return;
        if (titleEl) titleEl.textContent = item.name;

        content.innerHTML = `
            <div class="drilldown-detail-header-card">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="subject-color-dot" style="background:${item.color}; width:12px; height:12px;"></span>
                    <span class="badge" style="background:${item.color}15; color:${item.color}; font-weight:700;">과목 정보</span>
                </div>
                <div class="drilldown-detail-title">${escapeHtml(item.name)}</div>
                <div style="font-size:0.85rem; color:var(--text-muted);">${item.description ? escapeHtml(item.description) : '별도 설명 없음'}</div>
            </div>

            <div class="drilldown-detail-row">
                <span class="drilldown-detail-label">대상 학년</span>
                <span class="drilldown-detail-value">${item.target_grade ? escapeHtml(item.target_grade) : '전체 학년'}</span>
            </div>
            <div class="drilldown-detail-row">
                <span class="drilldown-detail-label">강의 교실 / 장소</span>
                <span class="drilldown-detail-value">${item.room ? escapeHtml(item.room) : '온라인 / 미지정'}</span>
            </div>
            <div class="drilldown-detail-row">
                <span class="drilldown-detail-label">담당 선생님</span>
                <span class="drilldown-detail-value">선생님</span>
            </div>

            <button type="button" class="primary-btn mt-20" style="width:100%; height:44px; display:inline-flex; align-items:center; justify-content:center; gap:8px;" onclick="closeModal('mypageDetailModal'); selectSubjectFilter(${item.id}); switchMainTab('studentCalendarTab');">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <span>이 과목 수업 일정 확인하기</span>
            </button>
        `;
    }

    // 2. 학생: 질문 내역 상세
    else if (type === 'student-questions') {
        const item = myQuestionsCache.find(q => q.id === Number(id));
        if (!item) return;
        if (titleEl) titleEl.textContent = '질문 및 풀이 상세';

        const hasAnswer = Boolean(item.is_answered || (item.answer_text && item.answer_text.trim() !== ''));

        content.innerHTML = `
            <div class="drilldown-detail-header-card">
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                    ${item.subjects ? `<span class="badge" style="background:${item.subjects.color}15; color:${item.subjects.color};">${escapeHtml(item.subjects.name)}</span>` : ''}
                    ${hasAnswer 
                        ? '<span class="badge badge-answered">답변 완료</span>' 
                        : '<span class="badge badge-waiting">풀이 작성 중</span>'}
                </div>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">질문 시각: ${formatDateShort(item.created_at)}</div>
                <div class="drilldown-detail-title" style="font-size:1.02rem;">Q. ${escapeHtml(item.question_text)}</div>
            </div>

            ${item.question_image_url ? `
                <div style="margin-bottom:16px;">
                    <div style="font-size:0.82rem; font-weight:700; color:var(--text-muted); margin-bottom:6px;">첨부한 문제 사진</div>
                    <div class="image-preview-wrapper" onclick="openImageLightbox('${escapeHtml(item.question_image_url)}', '문제 사진')">
                        <img src="${item.question_image_url}" alt="문제 사진" loading="lazy">
                        <div class="image-zoom-overlay">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                            <span>탭하여 확대</span>
                        </div>
                    </div>
                </div>
            ` : ''}

            <div class="answer-box-completed" style="margin-top:12px;">
                <div class="answer-box-completed-header">
                    <span class="answer-completed-badge">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        선생님 풀이 해설
                    </span>
                </div>
                ${hasAnswer ? `
                    <p class="answer-box-content" style="margin-top:8px;">${escapeHtml(item.answer_text || '')}</p>
                    ${item.answer_image_url ? `
                        <div class="image-preview-wrapper" style="margin-top:10px;" onclick="openImageLightbox('${escapeHtml(item.answer_image_url)}', '선생님 풀이 사진')">
                            <img src="${item.answer_image_url}" alt="풀이 사진" loading="lazy">
                            <div class="image-zoom-overlay">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                                <span>탭하여 확대</span>
                            </div>
                        </div>
                    ` : ''}
                ` : `
                    <p class="answer-box-content" style="color:var(--text-muted); font-size:0.85rem; padding:8px 0;">선생님이 문제 풀이를 확인하고 있습니다. 풀이가 등록되면 실시간 푸시 알림으로 알려드립니다.</p>
                `}
            </div>
        `;
    }

    // 3. 학생: 응시 시험 상세 (날짜, 점수, 피드백, 시험지 사진)
    else if (type === 'student-exams') {
        const item = myExamsCache.find(e => e.id === Number(id));
        if (!item) return;
        if (titleEl) titleEl.textContent = '시험 성적 상세 리포트';

        content.innerHTML = `
            <div class="drilldown-detail-header-card" style="text-align:center; padding:20px 16px;">
                <div style="display:inline-flex; align-items:center; gap:6px; margin-bottom:8px;">
                    ${item.subjects ? `<span class="badge" style="background:${item.subjects.color}15; color:${item.subjects.color};">${escapeHtml(item.subjects.name)}</span>` : ''}
                    <span style="font-size:0.8rem; color:var(--text-muted);">${item.exam_date || formatDateShort(item.created_at)} 응시</span>
                </div>
                <div class="drilldown-detail-title" style="margin-top:2px;">${escapeHtml(item.exam_title)}</div>
                <div style="margin-top:14px;">
                    <span style="font-size:2.4rem; font-weight:800; color:var(--primary); line-height:1;">${item.score}</span>
                    <span style="font-size:1.1rem; color:var(--text-muted); font-weight:600;"> / 100점</span>
                </div>
            </div>

            <div class="drilldown-detail-row">
                <span class="drilldown-detail-label">응시 일자</span>
                <span class="drilldown-detail-value">${item.exam_date || formatDateShort(item.created_at)}</span>
            </div>
            <div class="drilldown-detail-row">
                <span class="drilldown-detail-label">시험 과목</span>
                <span class="drilldown-detail-value">${item.subjects ? escapeHtml(item.subjects.name) : '과목 정보 없음'}</span>
            </div>
            <div class="drilldown-detail-row">
                <span class="drilldown-detail-label">선생님 총평</span>
                <span class="drilldown-detail-value" style="font-weight:500; text-align:right; max-width:65%;">${item.feedback || item.notes || '피드백 코멘트가 없습니다.'}</span>
            </div>

            ${item.paper_image_url ? `
                <div style="margin-top:16px;">
                    <div style="font-size:0.82rem; font-weight:700; color:var(--text-muted); margin-bottom:6px;">시험지 원본 사진</div>
                    <div class="image-preview-wrapper" onclick="openImageLightbox('${escapeHtml(item.paper_image_url)}', '${escapeHtml(item.exam_title)} 시험지')">
                        <img src="${item.paper_image_url}" alt="시험지 사진" loading="lazy">
                        <div class="image-zoom-overlay">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                            <span>탭하여 확대</span>
                        </div>
                    </div>
                </div>
            ` : ''}
        `;
    }

    // 4. 선생님: 개설 과목 상세 (수강생 목록 포함)
    else if (type === 'teacher-subjects') {
        const item = mySubjects.find(s => s.id === Number(id));
        if (!item) return;
        if (titleEl) titleEl.textContent = item.name;

        const enrollments = Array.isArray(item.enrollments) ? item.enrollments : [];

        content.innerHTML = `
            <div class="drilldown-detail-header-card">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="subject-color-dot" style="background:${item.color}; width:12px; height:12px;"></span>
                    <span class="badge" style="background:${item.color}15; color:${item.color}; font-weight:700;">개설 과목</span>
                </div>
                <div class="drilldown-detail-title">${escapeHtml(item.name)}</div>
                <div style="font-size:0.85rem; color:var(--text-muted);">${item.description ? escapeHtml(item.description) : '과목 설명 미입력'}</div>
            </div>

            <div class="drilldown-detail-row">
                <span class="drilldown-detail-label">대상 학년</span>
                <span class="drilldown-detail-value">${item.target_grade ? escapeHtml(item.target_grade) : '전체 학년'}</span>
            </div>
            <div class="drilldown-detail-row">
                <span class="drilldown-detail-label">강의 교실</span>
                <span class="drilldown-detail-value">${item.room ? escapeHtml(item.room) : '지정 교실 없음'}</span>
            </div>
            <div class="drilldown-detail-row">
                <span class="drilldown-detail-label">현재 수강 인원</span>
                <span class="drilldown-detail-value">${enrollments.length}명</span>
            </div>

            <div style="margin-top:16px;">
                <div style="font-size:0.84rem; font-weight:700; color:var(--text-primary); margin-bottom:8px;">수강생 명단</div>
                ${enrollments.length > 0 ? `
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        ${enrollments.map(e => {
                            const p = e.profiles || {};
                            const lid = formatStudentLoginId(p.login_id ? p : (p.id ? p : e));
                            return `
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--bg-subtle); border-radius:8px; font-size:0.85rem;">
                                <span style="font-weight:700;">${escapeHtml(p.name || e.student_name || '학생')}</span>
                                ${lid ? `<span style="color:var(--text-muted); font-size:0.8rem;">@${escapeHtml(lid)}</span>` : '<span style="color:var(--text-muted); font-size:0.8rem;">수강생</span>'}
                            </div>
                            `;
                        }).join('')}
                    </div>
                ` : `
                    <div style="text-align:center; padding:12px; color:var(--text-muted); font-size:0.84rem;">등록된 수강생이 없습니다.</div>
                `}
            </div>

            <button type="button" class="primary-btn mt-20" style="width:100%; height:44px; display:inline-flex; align-items:center; justify-content:center; gap:8px;" onclick="closeModal('mypageDetailModal'); openScheduleModal(); document.getElementById('scheduleSubjectSelect').value = '${item.id}';">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg>
                <span>이 과목 새 수업 일정 잡기</span>
            </button>
        `;
    }

    // 5. 선생님: 담당 학생 상세
    else if (type === 'teacher-students') {
        const studentList = (Array.isArray(totalStudentsCache) && totalStudentsCache.length > 0)
            ? totalStudentsCache
            : allStudentsCache;
        const item = studentList.find(s => (s.id == id || s.student_id == id));
        if (!item) return;
        if (titleEl) titleEl.textContent = `${item.name} 학생 상세`;

        const lid = formatStudentLoginId(item);

        content.innerHTML = `
            <div class="drilldown-detail-header-card" style="display:flex; align-items:center; gap:14px;">
                <div class="mypage-avatar student-avatar" style="width:50px; height:50px; font-size:1.1rem;">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div>
                    <div class="drilldown-detail-title" style="margin:0 0 2px 0;">${escapeHtml(item.name)} 학생</div>
                    <div style="font-size:0.82rem; color:var(--text-muted);">${lid ? `아이디: @${escapeHtml(lid)}` : '수강생'}</div>
                </div>
            </div>

            <div class="drilldown-detail-row">
                <span class="drilldown-detail-label">학생 성명</span>
                <span class="drilldown-detail-value">${escapeHtml(item.name)}</span>
            </div>
            <div class="drilldown-detail-row">
                <span class="drilldown-detail-label">로그인 아이디</span>
                <span class="drilldown-detail-value">${lid ? `@${escapeHtml(lid)}` : '(아이디 없음)'}</span>
            </div>

            <button type="button" class="primary-btn mt-20" style="width:100%; height:44px; display:inline-flex; align-items:center; justify-content:center; gap:8px;" onclick="closeModal('mypageDetailModal'); switchMainTab('teacherClassTab'); selectStudent('${item.id || item.student_id}');">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span>학생 관리 페이지에서 전체 관리하기</span>
            </button>
        `;
    }

    // 6. 선생님: 답변 대기 질문 상세 (현장에서 바로 풀이 작성 가능)
    else if (type === 'teacher-unanswered') {
        const item = teacherAllQuestionsCache.find(q => q.id === Number(id));
        if (!item) return;
        if (titleEl) titleEl.textContent = '풀이 답변 작성';

        const studentName = item.profiles?.name || '학생';

        content.innerHTML = `
            <div class="drilldown-detail-header-card">
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                    <span class="badge-student">${escapeHtml(studentName)} 학생</span>
                    ${item.subjects ? `<span class="badge" style="background:${item.subjects.color}15; color:${item.subjects.color};">${escapeHtml(item.subjects.name)}</span>` : ''}
                    <span class="badge badge-waiting">답변 대기</span>
                </div>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">질문 시각: ${formatDateShort(item.created_at)}</div>
                <div class="drilldown-detail-title" style="font-size:1.02rem;">Q. ${escapeHtml(item.question_text)}</div>
            </div>

            ${item.question_image_url ? `
                <div style="margin-bottom:16px;">
                    <div style="font-size:0.82rem; font-weight:700; color:var(--text-muted); margin-bottom:6px;">학생이 첨부한 문제 사진</div>
                    <div class="image-preview-wrapper" onclick="openImageLightbox('${escapeHtml(item.question_image_url)}', '${escapeHtml(studentName)} 학생 질문 사진')">
                        <img src="${item.question_image_url}" alt="문제 사진" loading="lazy">
                        <div class="image-zoom-overlay">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                            <span>탭하여 확대</span>
                        </div>
                    </div>
                </div>
            ` : ''}

            <!-- 빠른 풀이 답변 작성 폼 -->
            <div class="answer-card-form" style="margin-top:16px;">
                <div class="answer-form-header">
                    <span class="answer-form-title">${escapeHtml(studentName)} 학생에게 풀이 답변 남기기</span>
                </div>
                <textarea id="subDetailAnsText" class="answer-textarea" rows="3" placeholder="${escapeHtml(studentName)} 학생을 위해 상세 풀이 과정이나 핵심 포인트를 입력해주세요."></textarea>
                
                <div class="answer-form-actions mt-8">
                    <label class="custom-file-upload-label" for="subDetailAnsFile" style="cursor:pointer;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        <span>풀이 사진 첨부</span>
                    </label>
                    <input type="file" id="subDetailAnsFile" accept="image/*" class="sr-only-file-input" onchange="document.getElementById('subDetailAnsFileName').textContent = this.files[0] ? this.files[0].name : ''">
                    <span id="subDetailAnsFileName" style="font-size:0.75rem; color:var(--primary); font-weight:600; margin-left:8px;"></span>
                </div>

                <button type="button" id="subDetailAnsSubmitBtn" class="primary-btn mt-16" style="width:100%; height:44px;" onclick="submitSubDetailAnswer(${item.id})">
                    풀이 답변 등록하기
                </button>
            </div>
        `;
    }
};

window.submitSubDetailAnswer = async function(qId) {
    const textEl = document.getElementById('subDetailAnsText');
    const fileEl = document.getElementById('subDetailAnsFile');
    const btn = document.getElementById('subDetailAnsSubmitBtn');
    if (!textEl) return;

    const answerText = textEl.value.trim();
    if (!answerText) {
        alert('풀이 해설 내용을 입력해 주세요.');
        textEl.focus();
        return;
    }

    setButtonLoading(btn, true, '풀이 등록 중...');

    try {
        let imageBase64 = null;
        let imageName = null;
        const file = fileEl && fileEl.files ? fileEl.files[0] : null;
        if (file) {
            imageBase64 = await processAndResizeImage(file);
            imageName = file.name;
        }

        const res = await authFetch('/api/answerQuestion', {
            method: 'POST',
            body: JSON.stringify({
                question_id: qId,
                answer_text: answerText,
                image_base64: imageBase64,
                image_name: imageName
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '답변 등록 실패');

        showToast('풀이 등록 완료', '학생에게 풀이 해설 알림이 성공적으로 전송되었습니다.');

        // 캐시 및 대시보드 갱신
        await loadAllTeacherQuestions(true);
        updateTeacherMyPageStats();

        // 모달 목록으로 복귀
        mypageDetailGoBack();
    } catch (err) {
        alert(err.message);
    } finally {
        setButtonLoading(btn, false);
    }
};
