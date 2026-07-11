export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 가능' });

    // 프론트엔드가 안전하게 융단폭격으로 보내준 변수들
    const { id, userId, user_id, login_id, newPassword, password } = req.body;
    
    // 확실하게 데이터 잡아채기
    const targetId = id || userId || user_id;
    const targetPw = newPassword || password;

    if (!targetId || !targetPw) {
        return res.status(400).json({ error: '사용자 식별자(ID) 또는 새 비밀번호가 누락되었습니다.' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    const headers = { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };

    try {
        // 💡 [핵심] students 테이블을 찔러서, 해당 학생의 비밀번호를 업데이트(PATCH) 합니다.
        const dbRes = await fetch(`${supabaseUrl}/rest/v1/students?id=eq.${targetId}`, {
            method: 'PATCH',
            headers: { ...headers, 'Prefer': 'return=minimal' },
            body: JSON.stringify({ password: targetPw })
        });

        if (!dbRes.ok) {
            const err = await dbRes.json().catch(()=>({}));
            throw new Error(`DB 업데이트 실패: ${JSON.stringify(err)}`);
        }

        return res.status(200).json({ message: '비밀번호 변경 성공!' });
    } catch (error) {
        console.error('changePassword 서버 연동 에러:', error);
        return res.status(500).json({ error: '서버 연동 에러', details: error.message });
    }
}
