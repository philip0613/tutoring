// api/enrollments.js
// 학생-과목 수강 연결(Enrollment) 관리 API
import { authenticate, supabaseAdminFetch } from './_auth.js';

export default async function handler(req, res) {
    try {
        const auth = await authenticate(req);

        // 1. 과목별 수강생 목록 조회 (GET)
        if (req.method === 'GET') {
            const { subject_id } = req.query;
            if (!subject_id) return res.status(400).json({ error: '과목 ID가 필요합니다.' });

            // 선생님인 경우 본인 과목인지 확인
            if (auth.isTeacher) {
                const subject = await supabaseAdminFetch(`/rest/v1/subjects?id=eq.${subject_id}&teacher_id=eq.${auth.userId}&select=id`);
                if (!subject || subject.length === 0) {
                    return res.status(403).json({ error: '해당 과목에 대한 접근 권한이 없습니다.' });
                }
            }

            const enrollments = await supabaseAdminFetch(
                `/rest/v1/enrollments?subject_id=eq.${subject_id}&select=id,created_at,student_id,profiles:student_id(id,name)`
            );

            return res.status(200).json(enrollments);
        }

        // 2. 학생을 과목에 등록 (POST) - 선생님 전용
        if (req.method === 'POST') {
            if (!auth.isTeacher) {
                return res.status(403).json({ error: '선생님 계정만 학생을 과목에 등록할 수 있습니다.' });
            }

            const { subject_id, student_id } = req.body;
            if (!subject_id || !student_id) {
                return res.status(400).json({ error: '과목 ID와 학생 ID가 필요합니다.' });
            }

            // 본인 과목인지 검증
            const subject = await supabaseAdminFetch(`/rest/v1/subjects?id=eq.${subject_id}&teacher_id=eq.${auth.userId}&select=id`);
            if (!subject || subject.length === 0) {
                return res.status(403).json({ error: '해당 과목에 대한 권한이 없습니다.' });
            }

            // 이미 등록되어 있는지 확인
            const existing = await supabaseAdminFetch(`/rest/v1/enrollments?subject_id=eq.${subject_id}&student_id=eq.${student_id}&select=id`);
            if (existing && existing.length > 0) {
                return res.status(400).json({ error: '이미 해당 과목에 등록된 학생입니다.' });
            }

            const created = await supabaseAdminFetch('/rest/v1/enrollments', {
                method: 'POST',
                headers: { 'Prefer': 'return=representation' },
                body: JSON.stringify({
                    subject_id,
                    student_id
                })
            });

            return res.status(201).json(created[0]);
        }

        // 3. 학생을 과목에서 제외 (DELETE) - 선생님 전용
        if (req.method === 'DELETE') {
            if (!auth.isTeacher) {
                return res.status(403).json({ error: '선생님 계정만 수강생을 제외할 수 있습니다.' });
            }

            const { subject_id, student_id } = req.query;
            if (!subject_id || !student_id) {
                return res.status(400).json({ error: '과목 ID와 학생 ID가 필요합니다.' });
            }

            // 본인 과목인지 검증
            const subject = await supabaseAdminFetch(`/rest/v1/subjects?id=eq.${subject_id}&teacher_id=eq.${auth.userId}&select=id`);
            if (!subject || subject.length === 0) {
                return res.status(403).json({ error: '해당 과목에 대한 권한이 없습니다.' });
            }

            await supabaseAdminFetch(`/rest/v1/enrollments?subject_id=eq.${subject_id}&student_id=eq.${student_id}`, {
                method: 'DELETE'
            });

            return res.status(200).json({ message: '해당 과목에서 학생을 제외했습니다.' });
        }

        return res.status(405).json({ error: '지원하지 않는 HTTP 메서드입니다.' });
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message || '서버 오류가 발생했습니다.' });
    }
}
