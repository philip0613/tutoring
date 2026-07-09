export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 가능합니다.' });
    
    const { id, password } = req.body;
    const email = `${id}@tutor.com`; // 꼼수: 아이디를 이메일 형식으로 변환
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    try {
        const authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey },
            body: JSON.stringify({ email, password })
        });
        const authData = await authRes.json();
        if (!authRes.ok) throw new Error(authData.error_description || '로그인 실패');

        const userId = authData.user.id;

        const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=role,name`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${authData.access_token}` }
        });
        const profileData = await profileRes.json();
        
        const role = profileData.length > 0 ? profileData[0].role : 'student';
        const name = profileData.length > 0 ? profileData[0].name : '이름없음';

        return res.status(200).json({ user: authData.user, role, name, token: authData.access_token });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}
