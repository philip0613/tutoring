export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 가능합니다.' });

    // 프론트엔드에서 '어떤 액션(action)'을 할 건지 신호를 보낼 거야!
    const { action, table, id, updateData, student_id } = req.body;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    const headers = {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
    };

    try {
        if (action === 'update') {
            // 일반 데이터 수정
            const response = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
                method: 'PATCH',
                headers: { ...headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify(updateData)
            });
            if (!response.ok) throw new Error('데이터 수정 실패');
        } 
        else if (action === 'delete') {
            // 일반 데이터 삭제
            const response = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
                method: 'DELETE',
                headers: headers
            });
            if (!response.ok) throw new Error('데이터 삭제 실패');
        } 
        else if (action === 'deleteStudent') {
            // 학생 계정 완전 삭제 (파괴 광선)
            await fetch(`${supabaseUrl}/rest/v1/exams?student_id=eq.${student_id}`, { method: 'DELETE', headers });
            await fetch(`${supabaseUrl}/rest/v1/questions?student_id=eq.${student_id}`, { method: 'DELETE', headers });
            await fetch(`${supabaseUrl}/rest/v1/feedbacks?student_id=eq.${student_id}`, { method: 'DELETE', headers });
            const response = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${student_id}`, { method: 'DELETE', headers });
            if (!response.ok) throw new Error('학생 프로필 삭제 실패');
        } 
        else {
            throw new Error('알 수 없는 명령입니다.');
        }

        return res.status(200).json({ message: '성공' });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}
