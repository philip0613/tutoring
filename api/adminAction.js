// api/adminAction.js
// 선생님 관리자 통합 액션 API (JWT 인증 기반 수정, 삭제, 캐스케이딩 스토리지 파일 폐기)
import { authenticate, getSupabaseConfig, supabaseAdminFetch } from './_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 가능합니다.' });

    try {
        const auth = await authenticate(req);
        if (!auth.isTeacher) {
            return res.status(403).json({ error: '선생님 계정만 관리 작업을 수행할 수 있습니다.' });
        }

        const { supabaseUrl, supabaseKey } = getSupabaseConfig();
        const headers = { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };

        const { action, id, recordId, studentId, student_id, exam_title, score, feedbackTitle, feedbackText, answerText } = req.body;
        const targetId = id || recordId;
        const targetStudentId = studentId || student_id;

        // 스토리지 사진들을 배열로 묶어서 일괄 삭제
        const deleteStorageFiles = async (urls) => {
            const prefixes = urls.filter(url => url && url !== 'null').map(url => {
                const parts = url.split('/tutor_files/');
                return parts.length > 1 ? parts[1].split('?')[0] : null;
            }).filter(Boolean);

            if (prefixes.length > 0) {
                await fetch(`${supabaseUrl}/storage/v1/object/tutor_files`, {
                    method: 'DELETE',
                    headers: headers,
                    body: JSON.stringify({ prefixes })
                }).catch(err => console.error('스토리지 삭제 에러:', err));
            }
        };

        if (action === 'deleteStudent') {
            if (!targetStudentId) return res.status(400).json({ error: '학생 ID가 누락되었습니다.' });

            const [exams, qs] = await Promise.all([
                supabaseAdminFetch(`/rest/v1/exams?student_id=eq.${targetStudentId}&select=paper_image_url`).catch(() => []),
                supabaseAdminFetch(`/rest/v1/questions?student_id=eq.${targetStudentId}&select=question_image_url,answer_image_url`).catch(() => [])
            ]);

            const filesToDelete = [];
            if (Array.isArray(exams)) exams.forEach(e => e.paper_image_url && filesToDelete.push(e.paper_image_url));
            if (Array.isArray(qs)) qs.forEach(q => {
                if (q.question_image_url) filesToDelete.push(q.question_image_url);
                if (q.answer_image_url) filesToDelete.push(q.answer_image_url);
            });

            // 1. 스토리지 사진 삭제
            await deleteStorageFiles(filesToDelete);

            // 2. 수강, 일정, 질문, 피드백, 시험 삭제
            await Promise.all([
                supabaseAdminFetch(`/rest/v1/enrollments?student_id=eq.${targetStudentId}`, { method: 'DELETE' }).catch(() => {}),
                supabaseAdminFetch(`/rest/v1/schedules?student_id=eq.${targetStudentId}`, { method: 'DELETE' }).catch(() => {}),
                supabaseAdminFetch(`/rest/v1/exams?student_id=eq.${targetStudentId}`, { method: 'DELETE' }).catch(() => {}),
                supabaseAdminFetch(`/rest/v1/questions?student_id=eq.${targetStudentId}`, { method: 'DELETE' }).catch(() => {}),
                supabaseAdminFetch(`/rest/v1/feedbacks?student_id=eq.${targetStudentId}`, { method: 'DELETE' }).catch(() => {}),
                supabaseAdminFetch(`/rest/v1/notifications?user_id=eq.${targetStudentId}`, { method: 'DELETE' }).catch(() => {}),
                supabaseAdminFetch(`/rest/v1/push_subscriptions?user_id=eq.${targetStudentId}`, { method: 'DELETE' }).catch(() => {})
            ]);

            // 3. profiles 및 Auth 계정 삭제
            await supabaseAdminFetch(`/rest/v1/profiles?id=eq.${targetStudentId}`, { method: 'DELETE' }).catch(() => {});
            await fetch(`${supabaseUrl}/auth/v1/admin/users/${targetStudentId}`, { method: 'DELETE', headers }).catch(() => {});

            return res.status(200).json({ message: '학생 및 관련 데이터가 완전히 삭제되었습니다.' });
        }

        if (action === 'deleteExam') {
            const exams = await supabaseAdminFetch(`/rest/v1/exams?id=eq.${targetId}&select=paper_image_url`).catch(() => []);
            if (Array.isArray(exams) && exams[0]?.paper_image_url) {
                await deleteStorageFiles([exams[0].paper_image_url]);
            }
            await supabaseAdminFetch(`/rest/v1/exams?id=eq.${targetId}`, { method: 'DELETE' });
            return res.status(200).json({ message: '시험이 삭제되었습니다.' });
        }

        if (action === 'editExam') {
            await supabaseAdminFetch(`/rest/v1/exams?id=eq.${targetId}`, {
                method: 'PATCH',
                headers: { 'Prefer': 'return=minimal' },
                body: JSON.stringify({ exam_title: exam_title, score: parseInt(score, 10) })
            });
            return res.status(200).json({ message: '시험 정보가 수정되었습니다.' });
        }

        if (action === 'deleteFeedback') {
            await supabaseAdminFetch(`/rest/v1/feedbacks?id=eq.${targetId}`, { method: 'DELETE' });
            return res.status(200).json({ message: '피드백이 삭제되었습니다.' });
        }

        if (action === 'editFeedback') {
            await supabaseAdminFetch(`/rest/v1/feedbacks?id=eq.${targetId}`, {
                method: 'PATCH',
                headers: { 'Prefer': 'return=minimal' },
                body: JSON.stringify({ feedback_text: feedbackText })
            });
            return res.status(200).json({ message: '피드백이 수정되었습니다.' });
        }

        if (action === 'deleteQuestion') {
            const qs = await supabaseAdminFetch(`/rest/v1/questions?id=eq.${targetId}&select=question_image_url,answer_image_url`).catch(() => []);
            if (Array.isArray(qs) && qs[0]) {
                const files = [qs[0].question_image_url, qs[0].answer_image_url].filter(Boolean);
                await deleteStorageFiles(files);
            }
            await supabaseAdminFetch(`/rest/v1/questions?id=eq.${targetId}`, { method: 'DELETE' });
            return res.status(200).json({ message: '질문이 삭제되었습니다.' });
        }

        if (action === 'deleteAnswer') {
            const qs = await supabaseAdminFetch(`/rest/v1/questions?id=eq.${targetId}&select=answer_image_url`).catch(() => []);
            if (Array.isArray(qs) && qs[0]?.answer_image_url) {
                await deleteStorageFiles([qs[0].answer_image_url]);
            }
            await supabaseAdminFetch(`/rest/v1/questions?id=eq.${targetId}`, {
                method: 'PATCH',
                headers: { 'Prefer': 'return=minimal' },
                body: JSON.stringify({ answer_text: null, answer_image_url: null, is_answered: false })
            });
            return res.status(200).json({ message: '답변이 삭제되었습니다.' });
        }

        if (action === 'editAnswer') {
            await supabaseAdminFetch(`/rest/v1/questions?id=eq.${targetId}`, {
                method: 'PATCH',
                headers: { 'Prefer': 'return=minimal' },
                body: JSON.stringify({ answer_text: answerText })
            });
            return res.status(200).json({ message: '답변이 수정되었습니다.' });
        }

        return res.status(400).json({ error: '올바르지 않은 명령 유형입니다.' });
    } catch (error) {
        return res.status(error.status || 500).json({ error: error.message || '관리자 처리 실패' });
    }
}
