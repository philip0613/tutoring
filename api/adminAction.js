export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 가능합니다.' });

    const { action, id, recordId, studentId, student_id, exam_title, score, feedbackTitle, feedbackText, answerText } = req.body;
    
    const targetId = id || recordId;
    const targetStudentId = studentId || student_id;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    const headers = { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };

    try {
        let dbRes;

        // 💡 [핵심 해결] 학생 삭제 시 테이블 이름을 students 에서 users 로 변경!
        if (action === 'deleteStudent') {
            dbRes = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${targetStudentId}`, { method: 'DELETE', headers });
        }
        else if (action === 'deleteExam') {
            dbRes = await fetch(`${supabaseUrl}/rest/v1/exams?id=eq.${targetId}`, { method: 'DELETE', headers });
        }
        else if (action === 'editExam') {
            dbRes = await fetch(`${supabaseUrl}/rest/v1/exams?id=eq.${targetId}`, {
                method: 'PATCH', 
                headers: { ...headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify({ exam_title: exam_title, score: parseInt(score) })
            });
        }
        else if (action === 'addFeedback') {
            dbRes = await fetch(`${supabaseUrl}/rest/v1/feedbacks`, {
                method: 'POST', 
                headers: { ...headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify({ student_id: targetStudentId, feedback_title: feedbackTitle, feedback_text: feedbackText })
            });
        }
        else if (action === 'deleteFeedback') {
            dbRes = await fetch(`${supabaseUrl}/rest/v1/feedbacks?id=eq.${targetId}`, { method: 'DELETE', headers });
        }
        else if (action === 'editFeedback') {
            dbRes = await fetch(`${supabaseUrl}/rest/v1/feedbacks?id=eq.${targetId}`, {
                method: 'PATCH', 
                headers: { ...headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify({ feedback_title: feedbackTitle, feedback_text: feedbackText })
            });
        }
        else if (action === 'deleteQuestion') {
            dbRes = await fetch(`${supabaseUrl}/rest/v1/questions?id=eq.${targetId}`, { method: 'DELETE', headers });
        }
        else if (action === 'deleteAnswer') {
            dbRes = await fetch(`${supabaseUrl}/rest/v1/questions?id=eq.${targetId}`, {
                method: 'PATCH', 
                headers: { ...headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify({ answer_text: null, answer_image_url: null })
            });
        }
        else if (action === 'editAnswer') {
            dbRes = await fetch(`${supabaseUrl}/rest/v1/questions?id=eq.${targetId}`, {
                method: 'PATCH', 
                headers: { ...headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify({ answer_text: answerText })
            });
        }
        else {
            return res.status(400).json({ error: '올바르지 않은 명령 유형입니다.' });
        }

        if (!dbRes.ok) {
            const errorText = await dbRes.text().catch(() => 'Unknown DB Error');
            return res.status(400).json({ error: `Supabase 오류: ${errorText}` });
        }

        return res.status(200).json({ message: '요청 처리에 성공했습니다.' });

    } catch (error) {
        console.error('adminAction 내부 크래시:', error);
        return res.status(500).json({ error: `서버 내부 에러: ${error.message}` });
    }
}
