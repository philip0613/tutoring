export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 가능합니다.' });

    // 질문의 고유 ID와 선생님이 작성한 답변 텍스트를 받음
    const { question_id, answer_text } = req.body;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    try {
        // 이미 있는 데이터의 일부만 수정할 때는 PATCH 메서드를 사용해!
        const response = await fetch(`${supabaseUrl}/rest/v1/questions?id=eq.${question_id}`, {
            method: 'PATCH', 
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                answer_text: answer_text,
                is_answered: true // 답변 완료 상태로 변경
            })
        });

        if (!response.ok) throw new Error('답변 등록에 실패했습니다.');

        return res.status(200).json({ message: '답변이 성공적으로 등록되었습니다.' });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}
