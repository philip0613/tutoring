// ==========================================
// 💡 [SYSTEM SIGNATURE] 전역 상태 관리 변수
// ==========================================
let currentUser = null;        // 현재 로그인 유저 객체 (id, name, role 등)
let currentStudentId = null;   // 어드민 대시보드에서 선택된 학생 고유 ID

/**
 * [이벤트 리스너 라우터]
 * DOM 구조가 완벽히 로드되면 모든 UI 요소와 자바스크립트 핸들러를 바인딩합니다.
 * 각 엘리먼트의 존재 여부를 사전에 체크하여 널 포인터 에러(Null Pointer Error)를 방지합니다.
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Tutoring System Client-Side V1.0.2 Initialization...');
    
    // 세션 유지 및 복원 확인
    checkSession(); 

    // 1. 시스템 인증 및 공통 모듈 이벤트 바인딩
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) loginBtn.addEventListener('click', handleLogin);

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // 2. 관리자(선생님) 전용 통신 모듈 이벤트 바인딩
    const createStudentBtn = document.getElementById('createStudentBtn');
    if (createStudentBtn) createStudentBtn.addEventListener('click', handleCreateStudent);

    const uploadExamBtn = document.getElementById('uploadExamBtn');
    if (uploadExamBtn) uploadExamBtn.addEventListener('click', handleUploadExam);

    const sendFeedbackBtn = document.getElementById('sendFeedbackBtn');
    if (sendFeedbackBtn) sendFeedbackBtn.addEventListener('click', handleSendFeedback);

    const deleteStudentBtn = document.getElementById('deleteStudentBtn');
    if (deleteStudentBtn) deleteStudentBtn.addEventListener('click', handleDeleteStudent);

    // 3. 클라이언트(학생) 전용 대시보드 이벤트 바인딩
    const askQuestionBtn = document.getElementById('askQuestionBtn');
    if (askQuestionBtn) askQuestionBtn.addEventListener('click', handleAskQuestion);

    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', () => {
            console.log('🔑 비밀번호 변경 폼 토글 기능 가동');
            const container = document.getElementById('passwordFormContainer');
            if (container) {
                container.classList.toggle('hidden-form');
            }
        });
    }

    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) changePasswordBtn.addEventListener('click', handleChangePassword);
});

// ==========================================
// 💡 이미지 프로세싱 및 데이터 정제 유틸리티
// ==========================================

/**
 * [데이터 추출 헬퍼]
 * 백엔드 서버 응답 데이터가 JSON 포장지 패킹 형태이거나 순수 배열이거나
 * 어떤 구조로 오든 원본 레코드 데이터 어레이만 안전하게 필터링하여 반환합니다.
 */
function extractDataArray(responseData) {
    console.log('🔍 백엔드 RAW 데이터 검사 데이터 파싱:', responseData);
    if (!responseData) return [];
    if (Array.isArray(responseData)) return responseData; 
    if (responseData.data && Array.isArray(responseData.data)) return responseData.data; 
    
    for (const key in responseData) {
        if (Array.isArray(responseData[key])) {
            return responseData[key];
        }
    }
    return []; 
}

/**
 * [HTML5 Canvas 이미지 리사이징 모듈]
 * 카메라 직찍 초고용량 파일의 전송 실패(Vercel 4.5MB 바디 제한 규격)를 방어하기 위해
 * 브라우저 캔버스를 메모리에 띄워 해상도를 1280px 스케일로 압축 코딩 다운사이징합니다.
 */
function processAndResizeImage(file) {
    return new Promise((resolve, reject) => {
        console.log(`📸 이미지 전처리 파이프라인 가동: ${file.name} (원본 용량: ${(file.size / 1024 / 1024).toFixed(2)} MB)`);
        
        // 이미지 포맷이 아니거나 1.5MB 이하 소형 파일은 리사이징 패스하고 즉시 인코딩
        if (!file.type.startsWith('image/') || file.size <= 1.5 * 1024 * 1024) {
            console.log('✨ 소형 이미지 또는 규격 외 파일: 압축 단계를 건너뜁니다.');
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => {
                console.error('❌ 파일 리더 에러:', error);
                reject(error);
            };
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                const MAX_WIDTH = 1280;
                const MAX_HEIGHT = 1280;

                console.log(`📐 원본 해상도 스캔: ${width}px x ${height}px`);

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Canvas 2D Context를 생성할 수 없습니다.'));
                    return;
                }
                
                ctx.drawImage(img, 0, 0, width, height);
                
                // JPEG 포맷, 품질 70% 압축을 가하여 용량을 최대 90% 이상 다이어트
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                console.log('⚡ 고용량 이미지 압축 연산 처리 완료.');
                resolve(dataUrl);
            };
        };
        reader.onerror = error => reject(error);
    });
}

/**
 * [기본 Base64 엔코더]
 * 범용 텍스트 및 일반 바이너리 데이터를 안전한 Base64 스트링으로 직렬화합니다.
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// ==========================================
// 💡 [아코디언 UI 통합] 컴포넌트 렌더링 엔진
// ==========================================

/**
 * [선생님 한마디 피드백 리스트 렌더러]
 * 데이터 파싱 후 사용자가 클릭 시 상세 피드백 텍스트가 노출되는 슬라이드 토글 아코디언 컴포넌트입니다.
 */
function renderFeedbackList(feedbacksRaw, containerElement) {
    console.log('🛠️ 피드백 컴포넌트 렌더링 가동...');
    containerElement.innerHTML = ''; 
    const feedbacks = extractDataArray(feedbacksRaw);

    if (feedbacks.length === 0) {
        containerElement.innerHTML = '<li style="text-align:center; color:#888; padding:20px 0;">아직 등록된 피드백 코멘트가 존재하지 않습니다.</li>';
        return;
    }

    feedbacks.forEach((fb, index) => {
        const li = document.createElement('li');
        li.style.listStyle = 'none';
        li.style.marginBottom = '10px';
        
        const titleBtn = document.createElement('button');
        titleBtn.className = 'feedback-title-btn';
        
        const displayTitle = fb.feedback_title ? fb.feedback_title : `알림 내용 (${index + 1})`; 
        titleBtn.innerHTML = `📌 ${displayTitle} <span style="font-size: 0.8em; color: #888; font-weight: normal; margin-left:8px;">(클릭하여 펼치기)</span>`;

        const detailDiv = document.createElement('div');
        detailDiv.className = 'feedback-detail';
        
        const dateStr = fb.created_at ? new Date(fb.created_at).toLocaleString() : '날짜 정보 미기입';
        detailDiv.innerHTML = `
            <div style="padding: 15px; line-height: 1.6; word-break: break-all;">
                <p style="margin: 0 0 10px 0; color:#334155;">${fb.feedback_text || '기재된 상세 내용이 비어있습니다.'}</p>
                <div style="text-align: right; font-size: 0.8em; color: #94a3b8;">작성일: ${dateStr}</div>
            </div>
        `;

        titleBtn.addEventListener('click', () => {
            console.log(`🎯 피드백 아코디언 토글 클릭 인덱스: ${index}`);
            detailDiv.classList.toggle('show');
        });

        li.appendChild(titleBtn);
        li.appendChild(detailDiv);
        containerElement.appendChild(li);
    });
    console.log('✅ 피드백 컴포넌트 렌더링 완료.');
}

/**
 * [질문 게시판 & 선생님 라이브 답변 렌더러]
 * 학생이 등록한 원본 질문 정보와 매칭되는 선생님의 답변을 트리 구조로 표현합니다.
 * 어드민 계정으로 접속 시 라이브로 실시간 인풋 컴포넌트를 주입하여 다이렉트 답변 처리가 가능합니다.
 */
function renderQuestionList(questionsRaw, containerElement, isAdmin = false) {
    console.log(`🛠️ 질문 질의응답 렌더링 파이프라인 구동 (Admin모드: ${isAdmin})`);
    containerElement.innerHTML = '';
    const questions = extractDataArray(questionsRaw);

    if (questions.length === 0) {
        containerElement.innerHTML = '<li style="text-align:center; color:#888; padding:20px 0;">아직 접수된 질문 내역이 없습니다.</li>';
        return;
    }

    questions.forEach((q) => {
        const li = document.createElement('li');
        li.style.position = 'relative';
        li.style.marginBottom = '20px';
        li.style.listStyle = 'none';
        
        const dateStr = q.created_at ? new Date(q.created_at).toLocaleDateString() : '날짜 없음';
        
        // 엑스박스 흉물 방어 차단선 완비
        let imgTag = '';
        if (q.question_image_url && q.question_image_url !== 'null' && q.question_image_url.trim() !== '') {
            imgTag = `<img src="${q.question_image_url}" alt="학생 질문 첨부 이미지" onerror="this.style.display='none'; console.warn('질문 이미지 로드 불가 기각');" style="max-width:100%; border-radius:6px; margin-top:10px; display:block; border: 1px solid #e2e8f0;">`;
        }
        
        let htmlContent = `
            <div class="question-box" style="background:#f8fafc; border:1px solid #e2e8f0; padding:15px; border-radius:6px;">
                <p style="margin:0; color:#1e293b;"><strong style="color:#0f766e;">🙋‍♂️ 학생 질문:</strong> ${q.question_text || '텍스트 미기재'}</p>
                ${imgTag}
                <div style="text-align: right; font-size: 0.75em; color: #94a3b8; margin-top: 8px;">작성시각: ${dateStr}</div>
            </div>
            <div style="height: 10px;"></div>
        `;

        if (q.answer_text) {
            let ansImgTag = '';
            if (q.answer_image_url && q.answer_image_url !== 'null' && q.answer_image_url.trim() !== '') {
                ansImgTag = `<img src="${q.answer_image_url}" alt="선생님 답변 풀이 이미지" onerror="this.style.display='none';" style="max-width:100%; border-radius:6px; margin-top:10px; display:block; border: 1px solid #cbd5e1;">`;
            }
            htmlContent += `
                <div class="answer-box" style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; border-radius: 4px; margin-left: 10px; border: 1px solid #dcfce7; border-left-width: 4px;">
                    <p style="margin:0; color:#166534;"><strong>👨‍🏫 선생님 피드백 및 답변:</strong> ${q.answer_text}</p>
                    ${ansImgTag}
                </div>
            `;
        } else {
            htmlContent += `
                <div style="margin-left: 10px; padding: 10px; background:#fffcf2; border: 1px dashed #fef08a; border-radius:4px;">
                    <p style="font-size:0.85em; color:#ca8a04; margin:0; font-style: italic;">💡 아직 튜터의 답변이 등록되지 않은 대기 상태 질문입니다.</p>
                </div>
            `;
        }

        li.innerHTML = htmlContent;

        // 어드민 계정 컨텍스트고 미답변 상태라면 실시간 답변 패널 삽입
        if (isAdmin && !q.answer_text) {
            const adminForm = document.createElement('div');
            adminForm.style.marginTop = '12px';
            adminForm.style.marginLeft = '10px';
            adminForm.style.padding = '12px';
            adminForm.style.background = '#f1f5f9';
            adminForm.style.borderRadius = '6px';
            adminForm.style.border = '1px solid #e2e8f0';
            
            adminForm.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <textarea id="ansText_${q.id}" placeholder="여기에 풀이 해설 및 피드백 답변을 입력하세요..." style="width:100%; min-height:60px; padding:8px; border-radius:4px; border:1px solid #cbd5e1; resize:vertical; font-size:0.9rem;"></textarea>
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:5px;">
                        <input type="file" id="ansImg_${q.id}" accept="image/*" style="font-size:0.8rem; max-width:200px;">
                        <button id="ansBtn_${q.id}" class="small-btn" style="background:#22c55e; color:white; padding:6px 12px; font-weight:bold; border-radius:4px; cursor:pointer; border:none;">답변 확정 등록</button>
                    </div>
                </div>
            `;
            
            adminForm.querySelector(`#ansBtn_${q.id}`).addEventListener('click', () => {
                handleAnswerQuestion(q.id);
            });
            
            li.appendChild(adminForm);
        }

        containerElement.appendChild(li);
    });
    console.log('✅ 질문 리스트 컴포넌트 마운트 완료.');
}

/**
 * [관리자용 시험 정보 리스트 렌더러]
 * 스크린샷과 완벽 호환되는 둥근 회색 피드백 형태의 아코디언 UI 카드를 렌더링합니다.
 */
function renderAdminExamList(exams, containerElement) {
    console.log('🛠️ [Admin Context] 시험지 결과 데이터 빌드 가동...');
    containerElement.innerHTML = '';
    
    if (exams.length === 0) {
        containerElement.innerHTML = '<li style="text-align:center; color:#888; padding:20px 0;">조회된 학생의 시험 기록이 존재하지 않습니다.</li>';
        return;
    }
    
    exams.forEach((e, idx) => {
        const li = document.createElement('li');
        li.style.listStyle = 'none';
        li.style.marginBottom = '12px';
        
        const titleBtn = document.createElement('button');
        titleBtn.className = 'feedback-title-btn'; // 기존 css 스타일과 완벽 매칭 연동
        titleBtn.innerHTML = `📝 ${e.exam_title} : <strong style="color:#0284c7;">${e.score}점</strong> <span style="font-size: 0.75em; color: #64748b; font-weight: normal; margin-left:10px;">(클릭하여 시험지 확인)</span>`;

        const detailDiv = document.createElement('div');
        detailDiv.className = 'feedback-detail'; 

        const imgUrl = e.paper_image_url || e.image_url || e.exam_image_url;
        const hasImg = imgUrl && imgUrl !== 'null' && imgUrl.trim() !== '';

        // 엑스박스 방어 체계 다중 설계 완료
        detailDiv.innerHTML = hasImg 
            ? `<div style="padding:15px; text-align:center; background:#fafafa;">
                   <img src="${imgUrl}" alt="업로드된 시험지" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" style="max-width:100%; max-height:450px; border-radius:4px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); display:block; margin:0 auto;">
                   <p style="display:none; color:#ef4444; font-size:0.85em; margin-top:10px; font-weight:bold;">⚠️ Supabase 이미지 스토리지 노드 링크가 만료되었거나 불러올 수 없습니다.</p>
               </div>`
            : `<div style="padding:15px; text-align:center; color:#94a3b8; font-size:0.9em;">📁 본 시험 내역은 텍스트 점수만 보관되어 있으며 첨부파일이 없습니다.</div>`;

        titleBtn.addEventListener('click', () => {
            console.log(`🎯 관리자 시험 카드 토글: ${e.exam_title}`);
            detailDiv.classList.toggle('show');
        });

        li.appendChild(titleBtn);
        li.appendChild(detailDiv);
        containerElement.appendChild(li);
    });
}

/**
 * [학생용 시험 정보 리스트 렌더러]
 * 학생이 자기 점수 카드를 누르면 아래로 부드럽게 원본 시험지 이미지가 드롭다운되는 모듈입니다.
 */
function renderStudentExamList(exams, containerElement) {
    console.log('🛠️ [Student Context] 내 시험 결과 렌더링 파이프라인 가동...');
    containerElement.innerHTML = '';
    
    if (exams.length === 0) {
        containerElement.innerHTML = '<li style="text-align:center; color:#888; padding:20px 0;">아직 배정 및 기록된 시험 정보 데이터가 없습니다.</li>';
        return;
    }
    
    exams.forEach((e) => {
        const li = document.createElement('li');
        li.style.listStyle = 'none';
        li.style.marginBottom = '12px';
        
        const titleBtn = document.createElement('button');
        titleBtn.className = 'feedback-title-btn'; 
        titleBtn.innerHTML = `📝 ${e.exam_title} : <strong style="color:#22c55e;">${e.score}점</strong> <span style="font-size: 0.75em; color: #64748b; font-weight: normal; margin-left:10px;">(클릭 시 시험지 펼치기)</span>`;

        const detailDiv = document.createElement('div');
        detailDiv.className = 'feedback-detail'; 

        const imgUrl = e.paper_image_url || e.image_url || e.exam_image_url;
        const hasImg = imgUrl && imgUrl !== 'null' && imgUrl.trim() !== '';

        detailDiv.innerHTML = hasImg 
            ? `<div style="padding:15px; text-align:center; background:#fafafa;">
                   <img src="${imgUrl}" alt="선생님이 업로드한 시험지" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" style="max-width:100%; max-height:450px; border-radius:4px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); display:block; margin:0 auto;">
                   <p style="display:none; color:#ef4444; font-size:0.85em; margin-top:10px; font-weight:bold;">⚠️ 원본 시험지 파일을 불러올 수 없습니다. 버킷 공개 범위를 확인하세요.</p>
               </div>`
            : `<div style="padding:15px; text-align:center; color:#94a3b8; font-size:0.9em;">💡 튜터가 업로드한 시험지 이미지 파일이 등록되지 않은 내역입니다.</div>`;

        titleBtn.addEventListener('click', () => {
            console.log(`🎯 학생 시험 결과 아코디언 오픈: ${e.exam_title}`);
            detailDiv.classList.toggle('show');
        });

        li.appendChild(titleBtn);
        li.appendChild(detailDiv);
        containerElement.appendChild(li);
    });
}

// ==========================================
// 💡 데이터 오케스트레이션 (API 로드 로직)
// ==========================================

/**
 * [관리자 전용 학생 리스트 파싱 로드]
 * 시스템에 소속된 전체 학생 대상을 비동기로 긁어와 리스트 돔 엘리먼트를 동적 맵핑합니다.
 */
async function loadTeacherDashboard() {
    console.log('📬 학생 정보 데이터베이스 풀 스캔 리로드 시작...');
    try {
        const response = await fetch('/api/getStudents');
        const rawData = await response.json();
        const students = extractDataArray(rawData);

        const list = document.getElementById('studentList');
        if (!list) return;
        
        list.innerHTML = '';

        if (students.length > 0) {
            students.forEach(student => {
                const li = document.createElement('li');
                li.className = 'student-list-item';
                li.innerHTML = `<span>👤 <strong>${student.name}</strong> (${student.login_id})</span>`;
                li.style.cursor = 'pointer';
                li.style.padding = '10px 15px';
                li.style.borderBottom = '1px solid #f1f5f9';
                li.style.transition = 'background 0.2s';
                
                li.addEventListener('mouseenter', () => li.style.background = '#f8fafc');
                li.addEventListener('mouseleave', () => li.style.background = 'transparent');
                
                li.addEventListener('click', () => {
                    console.log(`🎯 타겟 학생 변경 선택: ${student.name} (${student.id})`);
                    currentStudentId = student.id;
                    
                    const panelTitle = document.getElementById('manageStudentTitle');
                    if (panelTitle) panelTitle.textContent = `[${student.name}] 학생 데이터 연동 관리`;
                    
                    const panel = document.getElementById('studentManagePanel');
                    if (panel) panel.classList.remove('hidden');
                    
                    // 학생별 연동 데이터 심층 로드 가동
                    loadStudentDetail(currentStudentId);
                });
                list.appendChild(li);
            });
        } else {
            list.innerHTML = '<li style="text-align:center; color:#888; padding:15px;">현재 등록 보관된 학생 데이터가 비어있습니다.</li>';
        }
    } catch (error) {
        console.error('❌ 선생님 메인 대시보드 로드 심각한 예외 에러:', error);
    }
}

/**
 * [학생별 심층 상세정보 패치 엔진]
 * 하나의 학생 계정이 셀렉트되었을 때, 그와 매핑되는 시험 점수, 아코디언 시험지, 질문, 피드백을 멀티 스레드성 비동기로 일괄 스캔합니다.
 */
async function loadStudentDetail(studentId) {
    if (!studentId) return;
    console.log(`📂 [상세 분석 파이프라인] 학생 고유 식별코드 조회 가동: ${studentId}`);
    
    try {
        // 1. 쪽지시험 내역 일괄 서칭
        const examRes = await fetch(`/api/getExams?studentId=${studentId}&student_id=${studentId}`);
        const examData = extractDataArray(await examRes.json());
        const examListAdmin = document.getElementById('examListAdmin');
        if (examListAdmin) {
            renderAdminExamList(examData, examListAdmin);
        }

        // 2. 질의응답 히스토리 일괄 서칭 (관리자 권한 파라미터 true 바인딩)
        const questionRes = await fetch(`/api/getQuestions?studentId=${studentId}&student_id=${studentId}`);
        const questionData = await questionRes.json();
        const questionListAdmin = document.getElementById('questionListAdmin');
        if (questionListAdmin) {
            renderQuestionList(questionData, questionListAdmin, true);
        }

        // 3. 누적 피드백 한마디 서칭
        const feedbackRes = await fetch(`/api/getFeedbacks?studentId=${studentId}&student_id=${studentId}`);
        const feedbackData = await feedbackRes.json();
        const feedbackListAdmin = document.getElementById('feedbackListAdmin');
        if (feedbackListAdmin) {
            renderFeedbackList(feedbackData, feedbackListAdmin);
        }

        console.log(`✅ [파이프라인 완료] 학생 식별코드 (${studentId}) 돔 트레이싱 업데이트 종료.`);
    } catch (error) {
        console.error('❌ 학생 세부 상세정보 비동기 갱신 처리 실패 에러:', error);
    }
}

/**
 * [학생용 대시보드 자가 데이터 패치 엔진]
 * 학생 세션으로 진입 시, 본인의 계정 고유 ID를 조회해 성적 아코디언, 내 질문, 내 피드백을 뿌려줍니다.
 */
async function loadStudentDashboard() {
    if (!currentUser) return;
    console.log(`🔒 [보안 세션 패치] 학생 개인 정보 동기화 처리 시작: ${currentUser.id}`);
    
    try {
        const myId = currentUser.id;

        // 1. 자가 성적 데이터 조회
        const examRes = await fetch(`/api/getExams?studentId=${myId}&student_id=${myId}`);
        const examData = extractDataArray(await examRes.json());
        const myExamList = document.getElementById('myExamList');
        if (myExamList) {
            renderStudentExamList(examData, myExamList);
        }

        // 2. 자가 질문 내역 조회
        const questionRes = await fetch(`/api/getQuestions?studentId=${myId}&student_id=${myId}`);
        const questionData = await questionRes.json();
        const myQuestionList = document.getElementById('myQuestionList');
        if (myQuestionList) {
            renderQuestionList(questionData, myQuestionList, false);
        }

        // 3. 자가 피드백 알림 내역 조회
        const feedbackRes = await fetch(`/api/getFeedbacks?studentId=${myId}&student_id=${myId}`);
        const feedbackData = await feedbackRes.json();
        const myFeedbackList = document.getElementById('myFeedbackList');
        if (myFeedbackList) {
            renderFeedbackList(feedbackData, myFeedbackList);
        }

        console.log('✅ 학생 대시보드 보안 갱신 정상 완료.');
    } catch (error) {
        console.error('❌ 학생 계정 화면 데이터 세이브 갱신 실패 에러:', error);
    }
}

// ==========================================
// 💡 인증 및 세션 무결성 검증 레이어
// ==========================================

/**
 * [로그인 제어 유닛]
 */
async function handleLogin() {
    const idInput = document.getElementById('idInput');
    const passwordInput = document.getElementById('passwordInput');
    if (!idInput || !passwordInput) return;

    const id = idInput.value.trim();
    const password = passwordInput.value.trim();

    if (!id || !password) {
        alert('보안 가이드라인: 계정 아이디와 패스워드를 빈칸 없이 입력하세요.');
        return;
    }

    try {
        console.log(`🔐 인증 에이전트 요청 송신: ${id}`);
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, password })
        });
        const data = await response.json();

        if (response.ok) {
            console.log('🎉 인증 라이센스 체크 완료. 세션 쿠키 스토리지를 활성화합니다.');
            const userData = { ...(data.user || {}), ...data }; 
            localStorage.setItem('session', JSON.stringify(userData));
            
            idInput.value = '';
            passwordInput.value = '';
            
            checkSession();
        } else {
            alert('인증 거부: ' + (data.message || data.error || '아이디 또는 패스워드가 유효하지 않습니다.'));
        }
    } catch (error) {
        console.error('❌ 서버 게이트웨이 통신 실패 에러:', error);
        alert('네트워크 인프라 스트럭처 장애: 서버 응답이 없습니다.');
    }
}

/**
 * [로그아웃 제어 유닛]
 */
function handleLogout() {
    console.log('🛡️ 현재 로그인 세션 파기 절차 돌입.');
    localStorage.removeItem('session');
    currentUser = null;
    currentStudentId = null;
    checkSession();
}

/**
 * [세션 무결성 모니터링 모듈]
 */
function checkSession() {
    const sessionData = localStorage.getItem('session');
    
    const loginSection = document.getElementById('loginSection');
    const userInfo = document.getElementById('userInfo');
    const userGreeting = document.getElementById('userGreeting');
    const teacherDashboard = document.getElementById('teacherDashboard');
    const studentDashboard = document.getElementById('studentDashboard');
    const studentManagePanel = document.getElementById('studentManagePanel');

    if (sessionData) {
        currentUser = JSON.parse(sessionData);
        console.log('📊 복원 완료된 유저 세션 분석 프로필:', currentUser);

        if (loginSection) loginSection.classList.add('hidden');
        if (userInfo) userInfo.classList.remove('hidden');
        
        const nameBadge = currentUser.name || currentUser.id || '정회원';
        if (userGreeting) userGreeting.textContent = `${nameBadge}님 회원 인증 완료`;

        if (currentUser.role === 'admin') {
            console.log('👑 최고 권한 튜터(Admin) 관제 모드 오픈');
            if (teacherDashboard) teacherDashboard.classList.remove('hidden');
            if (studentDashboard) studentDashboard.classList.add('hidden');
            loadTeacherDashboard();
        } else {
            console.log('📖 일반 등급 학생(Student) 조회 모드 오픈');
            if (studentDashboard) studentDashboard.classList.remove('hidden');
            if (teacherDashboard) teacherDashboard.classList.add('hidden');
            if (studentManagePanel) studentManagePanel.classList.add('hidden');
            loadStudentDashboard();
        }
    } else {
        console.log('🔒 세션 정보 클리어 완료. 비인증 공용 화면으로 천이합니다.');
        currentUser = null;
        if (loginSection) loginSection.classList.remove('hidden');
        if (teacherDashboard) teacherDashboard.classList.add('hidden');
        if (studentDashboard) studentDashboard.classList.add('hidden');
        if (userInfo) userInfo.classList.add('hidden');
        if (studentManagePanel) studentManagePanel.classList.add('hidden');
    }
}

// ==========================================
// 💡 백엔드 기능 제어 오케스트레이터 (CRUD 핸들러)
// ==========================================

/**
 * [선생님 - 라이브 답변 등록 처리]
 */
async function handleAnswerQuestion(questionId) {
    const textInput = document.getElementById(`ansText_${questionId}`);
    const fileInput = document.getElementById(`ansImg_${questionId}`);
    if (!textInput || !fileInput) return;

    const text = textInput.value.trim();
    if (!text) return alert('유효성 통과 실패: 답변 조치 코멘트를 입력하세요.');

    const btn = document.getElementById(`ansBtn_${questionId}`);
    if (btn) {
        btn.innerText = "답변 데이터 인코딩 중... ⏳";
        btn.disabled = true;
    }

    try {
        let image_base64 = null;
        let image_name = null;

        if (fileInput.files && fileInput.files.length > 0) {
            image_name = fileInput.files[0].name;
            image_base64 = await processAndResizeImage(fileInput.files[0]);
        }

        console.log(`✈️ 답변 API 호출 바인딩: QuestionID=${questionId}`);
        const res = await fetch('/api/answerQuestion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                questionId: questionId,
                id: questionId, 
                answer_text: text,
                answerText: text,
                image_base64: image_base64,
                image_name: image_name
            })
        });

        if (res.ok) {
            alert('✅ 질문에 대한 해설 답변 등록 프로세스가 정상 반영되었습니다.');
            loadStudentDetail(currentStudentId); 
        } else {
            const errorDump = await res.json().catch(() => ({}));
            alert('답변 기각 처리됨: ' + (errorDump.error || '백엔드 제약 사항 위배'));
        }
    } catch (err) {
        console.error('❌ 답변 핸들러 치명적 에러:', err);
        alert('통신 연동 서버 에러: ' + err.message);
    } finally {
        if (btn) {
            btn.innerText = "답변 확정 등록";
            btn.disabled = false;
        }
    }
}

/**
 * [선생님 - 신규 학생 라벨 생성 등록]
 * undefined@tutor.com 이메일 매핑 증발 참사를 원천 차단하기 위해 
 * 구조 분해 할당용 필드명을 종류별로 전부 올인원 패킹하여 전송합니다.
 */
async function handleCreateStudent() {
    const nameElement = document.getElementById('newStudentName');
    const idElement = document.getElementById('newStudentId');
    if (!nameElement || !idElement) return;

    const name = nameElement.value.trim();
    const loginId = idElement.value.trim();

    if (!name || !loginId) {
        alert('필수값 에러: 생성할 학생 명칭과 로그인 식별용 ID를 전부 입력하세요.');
        return;
    }

    const btn = document.getElementById('createStudentBtn');
    if (btn) btn.disabled = true;

    try {
        console.log(`✈️ 학생 원격 레코드 생성 커밋 송신: ${name} (${loginId})`);
        const res = await fetch('/api/createStudent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name: name, 
                studentName: name,
                login_id: loginId,
                loginId: loginId,
                id: loginId,
                userId: loginId
            })
        });

        if (res.ok) {
            alert(`✅ 학생 [${name}] 계정 생성이 성공적으로 승인되었습니다.\n초기 패스워드는 [123456]으로 자동 할당 배정됩니다.`);
            nameElement.value = ''; 
            idElement.value = '';
            loadTeacherDashboard();
        } else {
            const errBody = await res.json().catch(() => ({}));
            alert('계정 생성 거부 사유: ' + (errBody.error || 'ID 중복 또는 입력 문자열 규격 위배'));
        }
    } catch (err) {
        console.error('❌ 학생 생성 트랜잭션 에러:', err);
        alert('시스템 에러 발생: ' + err.message);
    } finally {
        if (btn) btn.disabled = false;
    }
}

/**
 * [선생님 - 시험 점수 및 아코디언 시험지 등록]
 */
async function handleUploadExam() {
    if (!currentStudentId) return alert("오퍼레이션 기각: 타겟 학생 레코드가 로드되지 않았습니다.");
    
    const titleElement = document.getElementById("examTitle");
    const scoreElement = document.getElementById("examScore");
    const fileElement = document.getElementById("examImage");
    
    if (!titleElement || !scoreElement || !fileElement) return;

    const title = titleElement.value.trim();
    const score = scoreElement.value;
    
    if (!title || !score) return alert("유효성 거부: 시험 라벨 명칭과 정수 점수를 빠짐없이 기입해 주세요.");

    const btn = document.getElementById("uploadExamBtn");
    if (btn) {
        btn.innerText = "바이너리 압축 가동 및 전송 중... ⏳";
        btn.disabled = true;
    }
    
    try {
        let image_base64 = null; 
        let image_name = null;
        
        if (fileElement.files.length > 0) {
            image_name = fileElement.files[0].name;
            // 시험지 원본 직찍 파일 초고용량 자동 조절 다이어트 알고리즘 큐 링크 활성화
            image_base64 = await processAndResizeImage(fileElement.files[0]);
        }

        console.log(`✈️ 시험 정보 원격 스토리지 업로드 파이프라인 개시: ${title}`);
        const res = await fetch('/api/uploadExam', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                student_id: currentStudentId, 
                exam_title: title, 
                score: parseInt(score), 
                image_base64: image_base64, 
                image_name: image_name 
            })
        });

        if (res.ok) {
            alert("✅ 시험 성적 기록 정보 및 아코디언 연동 시험지 파일 영구 보관 완료.");
            titleElement.value = ""; 
            scoreElement.value = ""; 
            fileElement.value = "";
            loadStudentDetail(currentStudentId); 
        } else {
            alert('업로드 실패 사유: 서버 엔드포인트에서 레코드 세이브를 거부했습니다.');
        }
    } catch (err) {
        console.error('❌ 시험지 업로드 모듈 실패 에러 로그:', err);
        alert("치명적 시스템 내부 오류: " + err.message);
    } finally {
        if (btn) {
            btn.innerText = "시험지 업로드 및 저장"; 
            btn.disabled = false;
        }
    }
}

/**
 * [선생님 - 개별 피드백 제목/내용 등록]
 */
async function handleSendFeedback() {
    if (!currentStudentId) return alert("선택된 학생이 존재하지 않아 피드백 전송이 불가능합니다.");
    
    const titleElement = document.getElementById('feedbackTitleAdmin');
    const textElement = document.getElementById('feedbackTextAdmin');
    if (!titleElement || !textElement) return;

    const title = titleElement.value.trim();
    const text = textElement.value.trim();

    if (!title || !text) return alert('항목 누락: 피드백 제목 브리핑 내용과 본문 요약을 채워 넣으세요.');

    try {
        console.log(`✈️ 피드백 한마디 전송 커밋: 타겟 학생ID=${currentStudentId}`);
        const response = await fetch('/api/adminAction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'addFeedback', 
                studentId: currentStudentId, 
                feedbackTitle: title, 
                feedbackText: text 
            })
        });

        if (response.ok) {
            alert('✅ 피드백 리포트 카드가 아코디언 데이터 리스트에 안전하게 등록 발송되었습니다.');
            titleElement.value = ''; 
            textElement.value = '';
            loadStudentDetail(currentStudentId); 
        } else {
            alert('피드백 접수 처리 실패: 서버가 응답 거절 코드를 리턴했습니다.');
        }
    } catch (error) {
        console.error('❌ 피드백 송신 유닛 에러 로그:', error);
        alert('네트워크 연동 트랜잭션 에러 발생.');
    }
}

/**
 * [선생님 - 학생 데이터 완전 삭제 기각선]
 */
async function handleDeleteStudent() {
    if (!currentStudentId) return alert("식별 정보 오류: 삭제 대상 컨텍스트 학생이 부재합니다.");
    
    const doubleCheck = confirm('🚨 [DANGER ZONE] 정말 해당 학생의 모든 성적 기록, 질문 이력, 아코디언 스토리지 파일을 영구 소멸시키겠습니까?\n이 오퍼레이션은 절대 복구가 불가능합니다.');
    if (!doubleCheck) return;

    try {
        console.log(`🚨 [CRITICAL COMMAND] 학생 영구 소멸 프로세스 호출: ID=${currentStudentId}`);
        const res = await fetch('/api/adminAction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'deleteStudent', 
                student_id: currentStudentId, 
                studentId: currentStudentId 
            }) 
        });

        if (res.ok) {
            alert('🚨 계정 무결성 정화 완료. 해당 학생 포트폴리오 정보가 시스템에서 완전히 삭제되었습니다.');
            const panel = document.getElementById('studentManagePanel');
            if (panel) panel.classList.add('hidden');
            currentStudentId = null;
            loadTeacherDashboard(); 
        } else {
            alert('삭제 거부 사유: 무결성 검증 단에서 트랜잭션 롤백 처리되었습니다.');
        }
    } catch (err) {
        console.error('❌ 학생 레코드 와이프 에러:', err);
        alert('삭제 프로세스 오동작: ' + err.message);
    }
}

/**
 * [학생 - 모르는 문제 촬영 질문 게시 유닛]
 */
async function handleAskQuestion() {
    const textElement = document.getElementById('questionText');
    const fileElement = document.getElementById('questionImage');
    if (!textElement || !fileElement) return;

    const text = textElement.value.trim();
    if (!text) return alert('내용 기입 누락: 튜터에게 질문할 문제 내용 및 요점을 서술해 주세요.');

    const btn = document.getElementById('askQuestionBtn');
    if (btn) {
        btn.innerText = "스마트폰 카메라 직찍 용량 최적화 스캔 중... ⏳"; 
        btn.disabled = true;
    }

    try {
        let image_base64 = null; 
        let image_name = "live_captured_problem.jpg"; // 파일명 유실 시 임시 할당
        
        if (fileElement.files && fileElement.files.length > 0) {
            const file = fileElement.files[0];
            if (file.name) image_name = file.name;
            
            // 💡 실시간 촬영 초고용량 캔버스 연산 다이어트 펑션 링크 인터셉트 가동
            image_base64 = await processAndResizeImage(file);
        }

        const userId = currentUser.id || currentUser.student_id || currentUser.login_id;
        console.log(`✈️ 질문 스토리지 전송 파이프라인 개시 유저코드: ${userId}`);

        const res = await fetch('/api/askQuestion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                student_id: userId,
                studentId: userId,
                id: userId,
                userId: userId,
                question_text: text,
                questionText: text,
                image_base64: image_base64,
                image_name: image_name
            })
        });

        if (res.ok) {
            alert('✅ 모르는 문제 질문 등록 성공! 선생님 대시보드로 즉시 알림 전송 연동이 완료되었습니다.');
            textElement.value = ''; 
            fileElement.value = '';
            loadStudentDashboard(); 
        } else {
            const failReason = await res.json().catch(() => ({}));
            alert('질문 접수 실패 사유: ' + (failReason.error || 'Vercel 게이트웨이 용량 한계 규격 거부'));
        }
    } catch (err) {
        console.error('❌ 학생 질문 작성 모듈 캔버스 붕괴 에러:', err);
        alert('하드웨어 데이터 인코딩 오류 발생: ' + err.message);
    } finally {
        if (btn) {
            btn.innerText = "질문 올리기"; 
            btn.disabled = false;
        }
    }
}

/**
 * [학생 - 본인 패스워드 자가 갱신 모듈]
 */
async function handleChangePassword() {
    const newPasswordElement = document.getElementById('newPassword');
    if (!newPasswordElement) return;

    const newPw = newPasswordElement.value.trim();
    if (!newPw || newPw.length < 6) {
        alert('보안 강도 유효성 통과 실패: 새 비밀번호는 시스템 보안 무결성을 위해 최소 6자리 이상 설계 규격을 충족해야 합니다.');
        return;
    }

    try {
        console.log(`✈️ 비밀번호 암호화 인코딩 업데이트 커밋 요청: ${currentUser.id}`);
        const res = await fetch('/api/changePassword', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, newPassword: newPw })
        });

        if (res.ok) {
            alert('✅ 계정 비밀번호 자가 변경 처리가 영구 반영되었습니다.\n안전한 토큰 갱신을 위해 세션을 만료 처리하오니 다시 로그인하여 주십시오.');
            newPasswordElement.value = '';
            handleLogout(); // 강제 복원 세션 파기
        } else {
            alert('비밀번호 변경 기각: 기존 암호 규칙 충돌 또는 서버 가공 필터 오류');
        }
    } catch (err) {
        console.error('❌ 패스워드 크립토 핸들러 실패 로그:', err);
        alert('암호 변경 트랜잭션 실패 에러: ' + err.message);
    }
}
