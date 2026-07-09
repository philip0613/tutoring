export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET 요청만 가능합니다.' });

    const { student_id } = req.query;
    if (!student_id) return res.status(400).json({ error: '학생 ID가 필요합니다.' });

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/feedbacks?student_id=eq.${student_id}&select=*&order=created_at.desc`, {
            method: 'GET',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        const data = await response.json();
        if (!response.ok) throw new Error('피드백을 불러오지 못했습니다.');

        return res.status(200).json(data);
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}
