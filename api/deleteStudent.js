export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 가능합니다.' });

    const { student_id } = req.body;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    try {
        // 1. 해당 학생의 쪽지시험 점수(exams) 삭제
        await fetch(`${supabaseUrl}/rest/v1/exams?student_id=eq.${student_id}`, {
            method: 'DELETE',
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });

        // 2. 해당 학생이 올린 질문(questions) 삭제
        await fetch(`${supabaseUrl}/rest/v1/questions?student_id=eq.${student_id}`, {
            method: 'DELETE',
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });

        // 3. 해당 학생에게 쓴 알림장 피드백(feedbacks) 삭제
        await fetch(`${supabaseUrl}/rest/v1/feedbacks?student_id=eq.${student_id}`, {
            method: 'DELETE',
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });

        // 4. 프로필(profiles) 테이블에서 학생 유저 삭제
        const response = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${student_id}`, {
            method: 'DELETE',
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });

        if (!response.ok) throw new Error('학생 프로필 삭제 실패');

        return res.status(200).json({ message: '학생의 모든 데이터가 완벽히 삭제되었습니다.' });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}
