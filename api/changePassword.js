export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 가능합니다.' });

    const { id, userId, user_id, login_id, newPassword, password } = req.body;
    
    // 네 사진에 있던 UUID (예: 2773449f-...) 를 정확히 타겟팅!
    const targetId = id || userId || user_id;
    const targetPw = newPassword || password;

    if (!targetId || !targetPw) {
        return res.status(400).json({ error: '유저 식별자(ID) 또는 비밀번호 데이터가 누락되었습니다.' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY; 
    const headers = { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };

    try {
        // 💡 [정답!] 일반 테이블이 아니라 Supabase 'Authentication' 시스템에 있는 유저 비밀번호를 직접 바꿉니다!
        const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${targetId}`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify({ password: targetPw })
        });

        if (!authRes.ok) {
            const errorText = await authRes.text().catch(() => 'Unknown Auth Error');
            return res.status(400).json({ error: `인증(Auth) 오류: ${errorText}` });
        }

        return res.status(200).json({ message: '비밀번호 변경 성공!' });

    } catch (error) {
        console.error('changePassword 내부 크래시:', error);
        return res.status(500).json({ error: `서버 내부 에러: ${error.message}` });
    }
}
