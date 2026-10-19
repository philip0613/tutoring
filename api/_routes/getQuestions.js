// api/getQuestions.js
// 질문 목록 조회 (JWT 인증 및 과목/학생 필터 지원)
import { authenticate, supabaseAdminFetch } from './_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET 요청만 가능합니다.' });

    try {
        const auth = await authenticate(req);
        let { student_id, subject_id } = req.query;

        // 학생은 본인 데이터만 조회 가능하도록 강제
        if (auth.isStudent) {
            student_id = auth.userId;
        }

        let query = '/rest/v1/questions?select=*,subjects:subject_id(name,color),profiles:student_id(id,name)&order=created_at.desc';

        if (student_id) {
            query += `&student_id=eq.${student_id}`;
        }
        if (subject_id) {
            query += `&subject_id=eq.${subject_id}`;
        } else if (auth.isTeacher && !student_id) {
            // 선생님이 전체 질문 목록 조회 시: 본인 개설 과목의 질문 및 미분류 질문 조회
            const mySubjects = await supabaseAdminFetch(`/rest/v1/subjects?teacher_id=eq.${auth.userId}&select=id`);
            if (mySubjects && mySubjects.length > 0) {
                const sIds = mySubjects.map(s => s.id);
                query += `&or=(subject_id.in.(${sIds.join(',')}),subject_id.is.null)`;
            }
        }

        const data = await supabaseAdminFetch(query);

        // profiles 조인이 없는 경우 profiles 테이블에서 학생 이름 자동 보강
        if (Array.isArray(data) && data.length > 0) {
            const missingStudentIds = [...new Set(data.filter(q => !q.profiles || !q.profiles.name).map(q => q.student_id).filter(Boolean))];
            if (missingStudentIds.length > 0) {
                const profiles = await supabaseAdminFetch(`/rest/v1/profiles?id=in.(${missingStudentIds.join(',')})&select=id,name`);
                if (Array.isArray(profiles)) {
                    const map = new Map(profiles.map(p => [p.id, p.name]));
                    data.forEach(q => {
                        if (!q.profiles || !q.profiles.name) {
                            q.profiles = { id: q.student_id, name: map.get(q.student_id) || '학생' };
                        }
                    });
                }
            }
        }

        return res.status(200).json(data);
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message || '질문 목록을 불러오지 못했습니다.' });
    }
}
