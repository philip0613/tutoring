// api/createStudent.js
// 학생 계정 생성 및 과목 자동 배정 API (JWT 인증 기반)
import { authenticate, getSupabaseConfig, supabaseAdminFetch } from './_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 가능합니다.' });

    try {
        const auth = await authenticate(req);
        if (!auth.isTeacher) {
            return res.status(403).json({ error: '선생님 계정만 학생을 생성할 수 있습니다.' });
        }

        const { supabaseUrl, supabaseKey } = getSupabaseConfig();
        const { name, id, subject_id } = req.body;

        if (!name || !id) {
            return res.status(400).json({ error: '학생 이름과 로그인 아이디를 입력해 주세요.' });
        }

        const email = `${id}@tutor.com`;
        const password = "123456"; // 학생 초기 기본 비밀번호

        // 1. Supabase Auth 관리자 API로 사용자 생성
        const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({
                email,
                password,
                email_confirm: true,
                user_metadata: { name: name.trim(), login_id: id.trim() }
            })
        });

        const authData = await authRes.json();
        if (!authRes.ok) {
            // 이미 존재하는 이메일이거나 가입 에러
            throw new Error(authData.message || authData.msg || '계정 생성 실패');
        }

        const userId = authData.id;

        // 2. profiles 테이블에 등록 (upsert)
        await supabaseAdminFetch('/rest/v1/profiles', {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify({
                id: userId,
                name: name.trim(),
                role: 'student'
            })
        });

        // 3. 과목이 지정되어 있다면 해당 과목에 수강 배정
        if (subject_id) {
            await supabaseAdminFetch('/rest/v1/enrollments', {
                method: 'POST',
                headers: { 'Prefer': 'return=minimal' },
                body: JSON.stringify({
                    subject_id,
                    student_id: userId
                })
            }).catch(() => {});
        }

        return res.status(200).json({ message: '학생 계정 생성 및 배정 완료!', studentId: userId });
    } catch (error) {
        return res.status(error.status || 500).json({ error: error.message || '학생 생성 중 오류가 발생했습니다.' });
    }
}
