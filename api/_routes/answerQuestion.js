// api/answerQuestion.js
// 선생님 답변 등록 API (JWT 인증, 학생에게 알림 발송)
import { authenticate, getSupabaseConfig, supabaseAdminFetch } from './_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 가능합니다.' });

    try {
        const auth = await authenticate(req);
        if (!auth.isTeacher) {
            return res.status(403).json({ error: '선생님 계정만 답변을 등록할 수 있습니다.' });
        }

        const { supabaseUrl, supabaseKey } = getSupabaseConfig();
        const headers = { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };

        const { questionId, id, answer_text, answerText, image_base64, image_name } = req.body;
        const targetId = questionId || id;
        const targetText = answer_text || answerText;

        if (!targetId || !targetText) return res.status(400).json({ error: '질문 ID 또는 답변 내용이 누락되었습니다.' });

        // 원본 질문 조회 (알림 대상 학생 식별)
        const questions = await supabaseAdminFetch(`/rest/v1/questions?id=eq.${targetId}&select=student_id,question_text`);
        const originalQuestion = questions && questions.length > 0 ? questions[0] : null;

        let uploadedImageUrl = null;
        if (image_base64) {
            const base64Data = image_base64.split(',')[1] || image_base64;
            const buffer = Buffer.from(base64Data, 'base64');
            
            const randomStr = Math.random().toString(36).substring(2, 10);
            const uniqueFileName = `ans_${Date.now()}_${randomStr}.png`;
            const storageUrl = `${supabaseUrl}/storage/v1/object/tutor_files/questions/${uniqueFileName}`;

            const storageRes = await fetch(storageUrl, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'image/png' },
                body: buffer
            });

            if (!storageRes.ok) throw new Error('답변 사진 업로드 실패');
            uploadedImageUrl = `${supabaseUrl}/storage/v1/object/public/tutor_files/questions/${uniqueFileName}`;
        }

        // 질문에 답변 업데이트
        await supabaseAdminFetch(`/rest/v1/questions?id=eq.${targetId}`, {
            method: 'PATCH',
            headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({
                answer_text: targetText,
                is_answered: true,
                ...(uploadedImageUrl && { answer_image_url: uploadedImageUrl })
            })
        });

        // 학생에게 알림 발송
        if (originalQuestion && originalQuestion.student_id) {
            await supabaseAdminFetch('/rest/v1/notifications', {
                method: 'POST',
                headers: { 'Prefer': 'return=minimal' },
                body: JSON.stringify({
                    user_id: originalQuestion.student_id,
                    title: `선생님의 풀이 답변이 등록되었습니다! 💡`,
                    body: targetText.length > 40 ? targetText.substring(0, 40) + '...' : targetText,
                    link: `#question-${targetId}`
                })
            }).catch(() => {});
        }

        return res.status(200).json({ message: '답변이 성공적으로 등록되었습니다.' });
    } catch (error) {
        return res.status(error.status || 500).json({ error: error.message || '답변 등록 실패' });
    }
}
