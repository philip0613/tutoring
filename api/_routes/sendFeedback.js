// api/sendFeedback.js
// 선생님 과외 일지/피드백 등록 API (JWT 인증, 과목 연결, 학생 알림 발송)
import { authenticate, supabaseAdminFetch } from './_auth.js';
import { sendWebPush } from './_pushSender.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 가능합니다.' });

    try {
        const auth = await authenticate(req);
        if (!auth.isTeacher) {
            return res.status(403).json({ error: '선생님 계정만 피드백을 등록할 수 있습니다.' });
        }

        const { student_id, feedback_text, subject_id } = req.body;
        if (!student_id || !feedback_text) {
            return res.status(400).json({ error: '학생 ID와 피드백 내용을 입력해 주세요.' });
        }

        const payload = {
            student_id,
            feedback_text,
            subject_id: subject_id || null
        };

        const result = await supabaseAdminFetch('/rest/v1/feedbacks', {
            method: 'POST',
            headers: { 'Prefer': 'return=representation' },
            body: JSON.stringify(payload)
        });

        // 학생에게 알림 발송
        const notifTitle = '오늘의 과외 일지(피드백)가 도착했습니다 📝';
        const notifBody = feedback_text.length > 40 ? feedback_text.substring(0, 40) + '...' : feedback_text;
        const notifLink = '#feedback';

        await supabaseAdminFetch('/rest/v1/notifications', {
            method: 'POST',
            headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({
                user_id: student_id,
                title: notifTitle,
                body: notifBody,
                link: notifLink
            })
        }).catch(() => {});

        // 🔔 학생 기기로 백그라운드 웹 푸시 발송
        await sendWebPush(student_id, {
            title: notifTitle,
            body: notifBody,
            link: notifLink
        }).catch(() => {});

        return res.status(200).json({ message: '피드백이 성공적으로 등록되었습니다.', data: result[0] });
    } catch (error) {
        return res.status(error.status || 500).json({ error: error.message || '피드백 등록 실패' });
    }
}
