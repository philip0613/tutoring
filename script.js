// ====================================================================
// 📚 Smart Tutoring Management System v2.0 - Core Script
// ====================================================================

// 💡 전역 상태 관리 변수
let currentUser = null;          // { user, role, name, token }
let currentStudentId = null;     // 관리 중인 학생 ID
let currentSubjectFilter = null; // 과목 필터 (null: 전체)
let mySubjects = [];             // 과목 목록
let allStudentsCache = [];       // 전체 학생 캐시
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

    // 2. 탭 전환 이벤트 (메인 탭 & 서브 탭 & 하단 플로팅 독)
    setupTabs();
    setupSubTabs();
    setupBottomDock();
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

function showToast(title, body) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `
        <div style="color: #34d399; margin-top: 1px; flex-shrink: 0;">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </div>
        <div style="flex: 1;">
            <div style="font-weight: 700; font-size: 0.88rem; margin-bottom: 2px; color: #ffffff;">${escapeHtml(title)}</div>
            <div style="font-size: 0.82rem; color: #94a3b8; line-height: 1.4;">${escapeHtml(body)}</div>
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

        if (modalBadge) {
            if (unreadCount > 0) {
                modalBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                modalBadge.classList.remove('hidden');
            } else {
                modalBadge.classList.add('hidden');
            }
        }

        if (list.length === 0) {
            container.innerHTML = '<div class="empty-hint">새로운 알림이 없습니다.</div>';
            if (modalContainer) modalContainer.innerHTML = '<div class="empty-hint" style="padding:14px 0; font-size:0.84rem;">새로운 알림이 없습니다.</div>';
            return;
        }

        const itemsHtml = list.map(item => `
            <div class="notification-item unread" style="display:flex; justify-content:space-between; align-items:flex-start; padding: 10px 12px; margin-bottom: 6px;">
                <div style="flex: 1; cursor: pointer;" onclick="handleNotificationClick(${item.id}, '${escapeHtml(item.link || '')}')">
                    <div style="font-weight: 700; color: var(--text-primary); font-size: 0.88rem;">${escapeHtml(item.title)}</div>
                    <div style="color: var(--text-secondary); font-size: 0.82rem; margin-top: 2px; line-height: 1.35;">${escapeHtml(item.body)}</div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">${new Date(item.created_at).toLocaleString()}</div>
                </div>
                <button class="danger-link-btn" style="padding: 2px 6px; font-size: 0.9rem; line-height: 1;" onclick="handleNotificationClick(${item.id})" title="알림 확인 및 삭제">✕</button>
            </div>
        `).join('');

        container.innerHTML = itemsHtml;
        if (modalContainer) modalContainer.innerHTML = itemsHtml;
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
        if (isTeacher) {
            document.querySelector('#teacherDashboard .tab-btn[data-target="teacherCalendarTab"]')?.click();
            const calBtn = document.getElementById('dockTeacherCalendar');
            if (calBtn) moveDockIndicator('teacherBottomDock', calBtn);
        } else {
            document.querySelector('#studentDashboard .tab-btn[data-target="studentCalendarTab"]')?.click();
            const calBtn = document.getElementById('dockStudentCalendar');
            if (calBtn) moveDockIndicator('studentBottomDock', calBtn);
        }
    } else if (link.includes('question-')) {
        const questionId = link.split('question-')[1];
        if (isTeacher) {
            document.querySelector('#teacherDashboard .tab-btn[data-target="teacherClassTab"]')?.click();
            document.querySelector('#teacherClassTab .sub-tab-btn[data-subtarget="studentQuestionsTab"]')?.click();
            const qBtn = document.getElementById('dockTeacherQna');
            if (qBtn) moveDockIndicator('teacherBottomDock', qBtn);
        } else {
            document.querySelector('#studentDashboard .tab-btn[data-target="studentStudyTab"]')?.click();
            const homeBtn = document.getElementById('dockStudentHome');
            if (homeBtn) moveDockIndicator('studentBottomDock', homeBtn);
        }

        setTimeout(() => {
            const el = document.getElementById(`question-${questionId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.4)';
                el.style.transition = 'box-shadow 0.4s ease';
                setTimeout(() => { el.style.boxShadow = ''; }, 2500);
            }
        }, 400);
    } else if (link.includes('feedback')) {
        if (!isTeacher) {
            document.querySelector('#studentDashboard .tab-btn[data-target="studentStudyTab"]')?.click();
            const homeBtn = document.getElementById('dockStudentHome');
            if (homeBtn) moveDockIndicator('studentBottomDock', homeBtn);
            setTimeout(() => {
                document.getElementById('myFeedbackList')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
        }
    } else if (link.includes('exam')) {
        if (!isTeacher) {
            document.querySelector('#studentDashboard .tab-btn[data-target="studentReportTab"]')?.click();
            const repBtn = document.getElementById('dockStudentReport');
            if (repBtn) moveDockIndicator('studentBottomDock', repBtn);
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
    // 하단 메뉴바 끝의 '알림·계정' 화면(바텀 시트)으로 즉시 열기
    if (window.innerWidth <= 768 || document.body.classList.contains('has-dock')) {
        openProfileModal(true);
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

function setupTabs() {
    document.querySelectorAll('.tab-bar').forEach(bar => {
        bar.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                bar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const targetId = btn.getAttribute('data-target');
                
                // 해당 탭 바가 관리하는 메인 탭들만 숨김 처리
                bar.querySelectorAll('.tab-btn').forEach(b => {
                    const tid = b.getAttribute('data-target');
                    if (tid) document.getElementById(tid)?.classList.add('hidden');
                });
                
                const targetTab = document.getElementById(targetId);
                if (targetTab) {
                    targetTab.classList.remove('hidden');
                    if (targetId.includes('Calendar')) {
                        renderCalendar();
                    }
                }

                // 하단 플로팅 독 활성 상태 및 인디케이터 동기화
                if (currentUser) {
                    const isTeacher = (currentUser.role === 'admin' || currentUser.role === 'teacher');
                    if (isTeacher) {
                        if (targetId.includes('Calendar')) {
                            const calBtn = document.getElementById('dockTeacherCalendar');
                            if (calBtn) moveDockIndicator('teacherBottomDock', calBtn);
                        } else {
                            const stuBtn = document.getElementById('dockTeacherStudents');
                            if (stuBtn) moveDockIndicator('teacherBottomDock', stuBtn);
                        }
                    } else {
                        if (targetId.includes('Calendar')) {
                            const calBtn = document.getElementById('dockStudentCalendar');
                            if (calBtn) moveDockIndicator('studentBottomDock', calBtn);
                        } else {
                            const homeBtn = document.getElementById('dockStudentHome');
                            if (homeBtn) moveDockIndicator('studentBottomDock', homeBtn);
                        }
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
    document.getElementById('dockTeacherStudents')?.addEventListener('click', (e) => {
        moveDockIndicator('teacherBottomDock', e.currentTarget);
        document.querySelector('#teacherDashboard .tab-btn[data-target="teacherClassTab"]')?.click();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 2. 수업 캘린더
    document.getElementById('dockTeacherCalendar')?.addEventListener('click', (e) => {
        moveDockIndicator('teacherBottomDock', e.currentTarget);
        document.querySelector('#teacherDashboard .tab-btn[data-target="teacherCalendarTab"]')?.click();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 3. 중앙 빠른 추가 액션 (+)
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
        const calBtn = document.getElementById('dockTeacherCalendar');
        if (calBtn) calBtn.click();
    });

    document.getElementById('quickAddSubjectBtn')?.addEventListener('click', () => {
        closeModal('teacherQuickActionModal');
        renderModalSubjectList();
        openModal('addSubjectModal');
    });

    // 4. 질문 풀이 (Q&A)
    document.getElementById('dockTeacherQna')?.addEventListener('click', (e) => {
        moveDockIndicator('teacherBottomDock', e.currentTarget);
        document.querySelector('#teacherDashboard .tab-btn[data-target="teacherClassTab"]')?.click();

        // 질문 관리 서브탭 열기
        const qSubTab = document.querySelector('#teacherClassTab .sub-tab-btn[data-subtarget="studentQuestionsTab"]');
        if (qSubTab) qSubTab.click();

        const qSection = document.getElementById('studentQuestionsTab') || document.getElementById('questionListAdmin');
        if (qSection) {
            setTimeout(() => {
                qSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 200);
        }
    });

    // 5. 내 정보 및 알림 센터
    document.getElementById('dockTeacherProfile')?.addEventListener('click', (e) => {
        openProfileModal();
    });
}

// 🧑‍🎓 2. 학생 전용 하단 독 네비게이션
function setupStudentBottomDock() {
    // 1. 홈 / 내 학습
    document.getElementById('dockStudentHome')?.addEventListener('click', (e) => {
        moveDockIndicator('studentBottomDock', e.currentTarget);
        document.querySelector('#studentDashboard .tab-btn[data-target="studentStudyTab"]')?.click();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 2. 내 캘린더
    document.getElementById('dockStudentCalendar')?.addEventListener('click', (e) => {
        moveDockIndicator('studentBottomDock', e.currentTarget);
        document.querySelector('#studentDashboard .tab-btn[data-target="studentCalendarTab"]')?.click();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 3. 중앙 질문하기 (+)
    document.getElementById('dockStudentAsk')?.addEventListener('click', () => {
        document.querySelector('#studentDashboard .tab-btn[data-target="studentStudyTab"]')?.click();
        const homeBtn = document.getElementById('dockStudentHome');
        if (homeBtn) moveDockIndicator('studentBottomDock', homeBtn);

        const qInput = document.getElementById('questionText');
        if (qInput) {
            qInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => qInput.focus(), 350);
        }
    });

    // 4. 성적 & 일지 리포트
    document.getElementById('dockStudentReport')?.addEventListener('click', (e) => {
        moveDockIndicator('studentBottomDock', e.currentTarget);
        document.querySelector('#studentDashboard .tab-btn[data-target="studentStudyTab"]')?.click();

        const examCard = document.getElementById('myExamList') || document.getElementById('myFeedbackList');
        if (examCard) {
            setTimeout(() => {
                examCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 200);
        }
    });

    // 5. 내 계정 & 알림
    document.getElementById('dockStudentProfile')?.addEventListener('click', (e) => {
        openProfileModal();
    });
}

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
        initTeacherView();
    } else {
        document.getElementById('studentDashboard').classList.remove('hidden');
        document.getElementById('teacherDashboard').classList.add('hidden');
        initStudentView();
    }

    loadNotifications();
    startNotificationPolling();
    syncPushNotificationState();
    setTimeout(autoFitButtonText, 150);
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
        confirmMsg += `\n\n⚠️ 주의: 현재 ${studentCount}명의 학생이 이 과목에 수강 등록되어 있습니다.\n과목을 삭제하면 해당 학생들의 수강 연결 및 관련 수업 일정도 함께 정리됩니다.`;
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
                        <div class="image-preview-wrapper" onclick="window.open('${q.question_image_url}')" title="클릭하여 원본 사진 보기">
                            <img src="${q.question_image_url}" alt="문제 사진">
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
                                <div class="image-preview-wrapper" style="margin-top:8px;" onclick="window.open('${q.answer_image_url}')">
                                    <img src="${q.answer_image_url}" alt="풀이 사진">
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
            list.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:30px 0; font-size:0.88rem;">아직 질문한 내역이 없습니다.</div>';
            return;
        }

        list.innerHTML = questions.map(q => {
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
                        <div class="image-preview-wrapper" onclick="window.open('${q.question_image_url}')">
                            <img src="${q.question_image_url}" alt="문제 사진">
                        </div>
                    ` : ''}

                    <div class="answer-box">
                        ${hasAnswer ? `
                            <div class="answer-box-title" style="margin-bottom:4px;">선생님 풀이 해설</div>
                            <p class="answer-box-content">${escapeHtml(q.answer_text || '')}</p>
                            ${q.answer_image_url ? `
                                <div class="image-preview-wrapper" style="margin-top:8px;" onclick="window.open('${q.answer_image_url}')">
                                    <img src="${q.answer_image_url}" alt="풀이 사진">
                                </div>
                            ` : ''}
                        ` : `
                            <span style="color:var(--warning); font-weight:600; font-size:0.85rem;">선생님이 문제를 확인하고 풀이를 작성 중입니다.</span>
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

function goToToday() {
    const today = new Date();
    calendarYear = today.getFullYear();
    calendarMonth = today.getMonth();
    renderCalendar();

    // 오늘 일자 상세 일정 로드 (스크롤 이동 없이 부드럽게 선택)
    const todayStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    selectCalendarDate(todayStr, false);
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
            <div class="calendar-cell ${isToday ? 'today' : ''}" data-date="${dateStr}" onclick="selectCalendarDate('${dateStr}')">
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

        alert('수업 일정이 등록되었습니다.');
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
