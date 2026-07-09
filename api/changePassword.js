export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 가능합니다.' });

    // 프론트에서 새 비밀번호와 사용자 인증 토큰을 받음
    const { newPassword, token } = req.body;

    if (!newPassword || !token) return res.status(400).json({ error: '비밀번호와 인증 토큰이 필요합니다.' });

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    try {
        // Supabase 유저 정보 업데이트 API 호출 (PUT 방식)
        const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${token}` // 여기에 인증 토큰을 넣어줌!
            },
            body: JSON.stringify({ password: newPassword })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.msg || '비밀번호 변경 실패');

        return res.status(200).json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}
