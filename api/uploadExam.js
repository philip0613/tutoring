export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 가능합니다.' });

    // 프론트에서 보낸 데이터 받기
    const { student_id, exam_title, score } = req.body;
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    try {
        // exams 테이블에 데이터 꽂아넣기
        const response = await fetch(`${supabaseUrl}/rest/v1/exams`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Prefer': 'return=minimal' // 저장만 하고 데이터는 굳이 안 돌려받음
            },
            body: JSON.stringify({
                student_id: student_id,
                exam_title: exam_title,
                score: score
                // paper_image_url 은 다음 단계에서 추가할 예정!
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || '데이터베이스 저장 실패');
        }

        return res.status(200).json({ message: '점수 저장 완료' });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}
