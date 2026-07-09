export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 가능' });

    // 어떤 테이블인지, 어떤 ID인지, 무슨 내용을 바꿀지 한 번에 받음!
    const { table, id, updateData } = req.body;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(updateData)
        });

        if (!response.ok) throw new Error('데이터 수정 실패');
        return res.status(200).json({ message: '성공' });
    } catch (error) { return res.status(400).json({ error: error.message }); }
}
