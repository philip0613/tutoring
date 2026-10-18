// api/getStudents.js
// 선생님별 담당 학생 목록 또는 특정 과목 수강생 목록 조회 (JWT 인증 기반)
import { authenticate, supabaseAdminFetch } from './_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET 요청만 가능합니다.' });

    try {
        const auth = await authenticate(req);
        const { subject_id } = req.query;

        // 1. 학생 계정인 경우: 본인 프로필 정보만 반환
        if (auth.isStudent) {
            return res.status(200).json([{ id: auth.userId, name: auth.name }]);
        }

        // 2. 선생님 계정인 경우
        // (1) 특정 과목의 수강생 목록 요청인 경우
        if (subject_id) {
            // 본인 과목인지 검증
            const subject = await supabaseAdminFetch(`/rest/v1/subjects?id=eq.${subject_id}&teacher_id=eq.${auth.userId}&select=id`);
            if (!subject || subject.length === 0) {
                return res.status(403).json({ error: '해당 과목에 대한 접근 권한이 없습니다.' });
            }

            const enrollments = await supabaseAdminFetch(
                `/rest/v1/enrollments?subject_id=eq.${subject_id}&select=student_id,profiles:student_id(id,name)`
            );

            const students = enrollments
                .map(e => e.profiles)
                .filter(Boolean);

            return res.status(200).json(students);
        }

        // (2) 전체 학생 목록 요청인 경우: 본인이 개설한 모든 과목에 등록된 학생들 중복 제거하여 반환
        // 만약 아직 과목에 배정되지 않은 학생도 보려면 전체 학생 풀에서 조회
        const mySubjects = await supabaseAdminFetch(`/rest/v1/subjects?teacher_id=eq.${auth.userId}&select=id`);
        const subjectIds = mySubjects.map(s => s.id);

        if (subjectIds.length === 0) {
            // 아직 개설한 과목이 없다면, 시스템 내 전체 학생 목록을 보여주어 과목 배정을 유도
            const allStudents = await supabaseAdminFetch(
                '/rest/v1/profiles?role=eq.student&select=id,name&order=created_at.desc'
            );
            return res.status(200).json(allStudents);
        }

        // 본인 과목들에 등록된 학생들 조회
        const enrollments = await supabaseAdminFetch(
            `/rest/v1/enrollments?subject_id=in.(${subjectIds.join(',')})&select=student_id,profiles:student_id(id,name)`
        );

        const studentMap = new Map();
        for (const e of enrollments) {
            if (e.profiles && !studentMap.has(e.profiles.id)) {
                studentMap.set(e.profiles.id, e.profiles);
            }
        }

        // 또한 신규 등록을 위해 전체 학생 목록도 함께 포함하거나, 전체 학생 목록 반환
        const allStudents = await supabaseAdminFetch(
            '/rest/v1/profiles?role=eq.student&select=id,name&order=created_at.desc'
        );

        return res.status(200).json(allStudents);
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message || '학생 목록을 불러오지 못했습니다.' });
    }
}
