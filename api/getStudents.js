export default async function handler(req, res) {
    // 데이터를 가져오는 거니까 GET 요청만 받음
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET 요청만 가능합니다.' });

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    try {
        // profiles 테이블에서 role이 'student'인 사람의 id와 name만 가져옴 (최신순 정렬)
        const response = await fetch(`${supabaseUrl}/rest/v1/profiles?role=eq.student&select=id,name&order=created_at.desc`, {
            method: 'GET',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || '학생 목록을 불러오지 못했습니다.');

        return res.status(200).json(data); // 찾은 학생 목록을 프론트로 전달!
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}
