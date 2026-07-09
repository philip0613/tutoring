export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 가능합니다.' });

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
            const response = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
                method: 'PATCH',
                headers: { ...headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify(updateData)
            });
            if (!response.ok) {
                const err = await response.json(); throw new Error(err.message || 'DB 데이터 수정 실패');
            }
        } 
        else if (action === 'delete') {
            const response = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
                method: 'DELETE', headers: headers
            });
            if (!response.ok) {
                const err = await response.json(); throw new Error(err.message || 'DB 데이터 삭제 실패');
            }
        } 
        else if (action === 'deleteStudent') {
            // 1. 찌끄레기 데이터들(점수, 질문, 피드백, 프로필) 먼저 삭제
            await fetch(`${supabaseUrl}/rest/v1/exams?student_id=eq.${student_id}`, { method: 'DELETE', headers });
            await fetch(`${supabaseUrl}/rest/v1/questions?student_id=eq.${student_id}`, { method: 'DELETE', headers });
            await fetch(`${supabaseUrl}/rest/v1/feedbacks?student_id=eq.${student_id}`, { method: 'DELETE', headers });
            await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${student_id}`, { method: 'DELETE', headers });

            // 2. 🔥 [핵심 추가] Supabase 내부 Auth(인증) 유저까지 영구 삭제!
            const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${student_id}`, {
                method: 'DELETE',
                headers: headers
            });
            
            if (!authResponse.ok) {
                const err = await authResponse.json();
                console.log("Auth 계정 삭제 실패(이미 지워졌을 수 있음):", err);
            }
        } 
        else {
            throw new Error('알 수 없는 명령입니다.');
        }

        return res.status(200).json({ message: '성공' });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}
