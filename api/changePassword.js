export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 가능합니다.' });

    const { id, userId, user_id, login_id, newPassword, password } = req.body;
    
    const targetId = id || userId || user_id;
    const targetPw = newPassword || password;

    if (!targetId || !targetPw) {
        return res.status(400).json({ error: '유저 식별자(ID) 또는 비밀번호 데이터가 누락되었습니다.' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    const headers = { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };

    try {
        // 💡 [핵심 해결] 캡처 화면에 맞게 테이블 이름을 'profiles'로 변경!
        const dbRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${targetId}`, {
            method: 'PATCH',
            headers: { ...headers, 'Prefer': 'return=minimal' },
            body: JSON.stringify({ password: targetPw })
        });

        if (!dbRes.ok) {
            const errorText = await dbRes.text().catch(() => 'Unknown DB Error');
            return res.status(400).json({ error: `Supabase 오류: ${errorText}` });
        }

        return res.status(200).json({ message: '비밀번호 변경 성공' });

    } catch (error) {
        console.error('changePassword 내부 크래시:', error);
        return res.status(500).json({ error: `서버 내부 에러: ${error.message}` });
    }
}
