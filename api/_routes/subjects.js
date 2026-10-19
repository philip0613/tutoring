// api/subjects.js
// 과목(Subject) 관리 API (생성, 조회, 수정, 삭제)
import { authenticate, supabaseAdminFetch } from './_auth.js';

export default async function handler(req, res) {
    try {
        const auth = await authenticate(req);

        // 1. 과목 목록 조회 (GET)
        if (req.method === 'GET') {
            if (auth.isTeacher) {
                // 선생님: 본인이 개설한 과목 목록 조회
                const subjects = await supabaseAdminFetch(
                    `/rest/v1/subjects?teacher_id=eq.${auth.userId}&select=*,enrollments(student_id,profiles:student_id(id,name))&order=created_at.desc`
                );
                return res.status(200).json(subjects);
            } else {
                // 학생: 본인이 수강 등록된 과목 목록 조회
                const enrollments = await supabaseAdminFetch(
                    `/rest/v1/enrollments?student_id=eq.${auth.userId}&select=subject_id,subjects:subject_id(*,profiles:teacher_id(name))`
                );
                const subjects = enrollments
                    .map(e => e.subjects)
                    .filter(Boolean);
                return res.status(200).json(subjects);
            }
        }

        // 2. 새 과목 개설 (POST) - 선생님 전용
        if (req.method === 'POST') {
            if (!auth.isTeacher) {
                return res.status(403).json({ error: '선생님 계정만 과목을 개설할 수 있습니다.' });
            }

            const { name, description, color } = req.body;
            if (!name || !name.trim()) {
                return res.status(400).json({ error: '과목명을 입력해 주세요.' });
            }

            const newSubject = await supabaseAdminFetch('/rest/v1/subjects', {
                method: 'POST',
                headers: { 'Prefer': 'return=representation' },
                body: JSON.stringify({
                    teacher_id: auth.userId,
                    name: name.trim(),
                    description: description ? description.trim() : '',
                    color: color || '#4F46E5'
                })
            });

            return res.status(201).json(newSubject[0]);
        }

        // 3. 과목 정보 수정 (PUT) - 선생님 전용
        if (req.method === 'PUT') {
            if (!auth.isTeacher) {
                return res.status(403).json({ error: '선생님 계정만 과목을 수정할 수 있습니다.' });
            }

            const { id, name, description, color } = req.body;
            if (!id) return res.status(400).json({ error: '과목 ID가 필요합니다.' });

            // 본인 과목인지 검증
            const existing = await supabaseAdminFetch(`/rest/v1/subjects?id=eq.${id}&teacher_id=eq.${auth.userId}&select=id`);
            if (!existing || existing.length === 0) {
                return res.status(403).json({ error: '해당 과목에 대한 수정 권한이 없습니다.' });
            }

            const updated = await supabaseAdminFetch(`/rest/v1/subjects?id=eq.${id}`, {
                method: 'PATCH',
                headers: { 'Prefer': 'return=representation' },
                body: JSON.stringify({
                    ...(name ? { name: name.trim() } : {}),
                    ...(description !== undefined ? { description: description.trim() } : {}),
                    ...(color ? { color } : {})
                })
            });

            return res.status(200).json(updated[0]);
        }

        // 4. 과목 삭제 (DELETE) - 선생님 전용
        if (req.method === 'DELETE') {
            if (!auth.isTeacher) {
                return res.status(403).json({ error: '선생님 계정만 과목을 삭제할 수 있습니다.' });
            }

            const id = req.query.id || (req.body && req.body.id);
            if (!id) return res.status(400).json({ error: '과목 ID가 필요합니다.' });

            // 본인 과목인지 검증
            const existing = await supabaseAdminFetch(`/rest/v1/subjects?id=eq.${id}&teacher_id=eq.${auth.userId}&select=id`);
            if (!existing || existing.length === 0) {
                return res.status(403).json({ error: '해당 과목에 대한 삭제 권한이 없습니다.' });
            }

            // 외래키 종속 데이터 안전 정리 (수강 연결, 수업 일정 삭제 및 피드 subject_id null 처리)
            await Promise.all([
                supabaseAdminFetch(`/rest/v1/enrollments?subject_id=eq.${id}`, { method: 'DELETE' }).catch(() => {}),
                supabaseAdminFetch(`/rest/v1/schedules?subject_id=eq.${id}`, { method: 'DELETE' }).catch(() => {}),
                supabaseAdminFetch(`/rest/v1/questions?subject_id=eq.${id}`, {
                    method: 'PATCH',
                    headers: { 'Prefer': 'return=minimal' },
                    body: JSON.stringify({ subject_id: null })
                }).catch(() => {}),
                supabaseAdminFetch(`/rest/v1/exams?subject_id=eq.${id}`, {
                    method: 'PATCH',
                    headers: { 'Prefer': 'return=minimal' },
                    body: JSON.stringify({ subject_id: null })
                }).catch(() => {}),
                supabaseAdminFetch(`/rest/v1/feedbacks?subject_id=eq.${id}`, {
                    method: 'PATCH',
                    headers: { 'Prefer': 'return=minimal' },
                    body: JSON.stringify({ subject_id: null })
                }).catch(() => {})
            ]);

            await supabaseAdminFetch(`/rest/v1/subjects?id=eq.${id}`, {
                method: 'DELETE'
            });

            return res.status(200).json({ message: '과목이 성공적으로 삭제되었습니다.' });
        }

        return res.status(405).json({ error: '지원하지 않는 HTTP 메서드입니다.' });
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message || '서버 오류가 발생했습니다.' });
    }
}
