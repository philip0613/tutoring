export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 가능합니다.' });

    const { student_id, question_text } = req.body;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/questions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                student_id: student_id,
                question_text: question_text
            })
        });

        if (!response.ok) throw new Error('질문 등록에 실패했습니다.');

        return res.status(200).json({ message: '질문이 성공적으로 등록되었습니다.' });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}
