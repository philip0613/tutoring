// api/getFeedbacks.js
// 과외 일지/피드백 목록 조회 (JWT 인증 및 과목/학생 필터 지원)
import { authenticate, supabaseAdminFetch } from './_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET 요청만 가능합니다.' });

    try {
        const auth = await authenticate(req);
        let { student_id, subject_id } = req.query;

        // 학생은 본인 피드백만 조회 가능
        if (auth.isStudent) {
            student_id = auth.userId;
        }

        if (!student_id && !subject_id) {
            return res.status(400).json({ error: '학생 ID 또는 과목 ID가 필요합니다.' });
        }

        let query = '/rest/v1/feedbacks?select=*,subjects:subject_id(name,color)&order=created_at.desc';

        if (student_id) {
            query += `&student_id=eq.${student_id}`;
        }
        if (subject_id) {
            query += `&subject_id=eq.${subject_id}`;
        }

        const data = await supabaseAdminFetch(query);
        return res.status(200).json(data);
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message || '피드백 목록을 불러오지 못했습니다.' });
    }
}
