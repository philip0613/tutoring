export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 가능합니다.' });
    
    const { id, password, refreshToken, grant_type } = req.body;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    try {
        let authRes;
        if (grant_type === 'refresh_token' || (refreshToken && !password)) {
            authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey },
                body: JSON.stringify({ refresh_token: refreshToken })
            });
        } else {
            if (!id || !password) {
                return res.status(400).json({ error: '아이디와 비밀번호를 모두 입력해 주세요.' });
            }
            const email = `${id}@tutor.com`;
            authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey },
                body: JSON.stringify({ email, password })
            });
        }

        const authData = await authRes.json();
        if (!authRes.ok) throw new Error(authData.error_description || authData.msg || '인증 실패');

        const userId = authData.user.id;

        const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=role,name`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${authData.access_token}` }
        });
        const profileData = await profileRes.json();
        
        const role = profileData.length > 0 ? profileData[0].role : 'student';
        const name = profileData.length > 0 ? profileData[0].name : '이름없음';

        return res.status(200).json({
            user: authData.user,
            login_id: authData.user?.email ? authData.user.email.replace('@tutor.com', '') : (id || ''),
            role,
            name,
            token: authData.access_token,
            refreshToken: authData.refresh_token,
            expiresAt: authData.expires_at,
            expiresIn: authData.expires_in
        });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}
