export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 가능' });

    const { table, id } = req.body;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
            method: 'DELETE',
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });

        if (!response.ok) throw new Error('데이터 삭제 실패');
        return res.status(200).json({ message: '성공' });
    } catch (error) { return res.status(400).json({ error: error.message }); }
}
