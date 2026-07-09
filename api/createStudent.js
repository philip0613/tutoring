export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 가능' });
    
    const { name, id } = req.body;
    const email = `${id}@tutor.com`; // 꼼수: 아이디를 이메일 형식으로 변환
    const password = "123456"; // 학생 기본 비밀번호
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    try {
        // 1. Auth 회원가입
        const authRes = await fetch(`${supabaseUrl}/auth/v1/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey },
            body: JSON.stringify({ email, password })
        });
        const authData = await authRes.json();
        if (!authRes.ok) throw new Error(authData.msg || '계정 생성 실패');

        const userId = authData.user?.id || authData.id;

        // 2. profiles 테이블에 학생 이름/역할 등록
        const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ id: userId, name: name, role: 'student' })
        });
        
        if (!profileRes.ok) throw new Error('프로필 등록 실패');

        return res.status(200).json({ message: '학생 계정 생성 완료!' });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}
