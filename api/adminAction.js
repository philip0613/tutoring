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

        // 1. 학생 계정 삭제
        if (action === 'deleteStudent') {
            dbRes = await fetch(`${supabaseUrl}/rest/v1/students?id=eq.${targetStudentId}`, { method: 'DELETE', headers });
        }
        // 2. 쪽지시험 삭제
        else if (action === 'deleteExam') {
            dbRes = await fetch(`${supabaseUrl}/rest/v1/exams?id=eq.${targetId}`, { method: 'DELETE', headers });
        }
        // 3. 쪽지시험 점수 및 제목 수정
        else if (action === 'editExam') {
            dbRes = await fetch(`${supabaseUrl}/rest/v1/exams?id=eq.${targetId}`, {
                method: 'PATCH', 
                headers: { ...headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify({ exam_title: exam_title, score: parseInt(score) })
            });
        }
        // 4. 피드백 신규 등록
        else if (action === 'addFeedback') {
            dbRes = await fetch(`${supabaseUrl}/rest/v1/feedbacks`, {
                method: 'POST', 
                headers: { ...headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify({ student_id: targetStudentId, feedback_title: feedbackTitle, feedback_text: feedbackText })
            });
        }
        // 5. 피드백 삭제
        else if (action === 'deleteFeedback') {
            dbRes = await fetch(`${supabaseUrl}/rest/v1/feedbacks?id=eq.${targetId}`, { method: 'DELETE', headers });
        }
        // 6. 피드백 수정
        else if (action === 'editFeedback') {
            dbRes = await fetch(`${supabaseUrl}/rest/v1/feedbacks?id=eq.${targetId}`, {
                method: 'PATCH', 
                headers: { ...headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify({ feedback_title: feedbackTitle, feedback_text: feedbackText })
            });
        }
        // 7. 질문 삭제
        else if (action === 'deleteQuestion') {
            dbRes = await fetch(`${supabaseUrl}/rest/v1/questions?id=eq.${targetId}`, { method: 'DELETE', headers });
        }
        // 8. 선생님 답변 삭제 (내용물만 초기화)
        else if (action === 'deleteAnswer') {
            dbRes = await fetch(`${supabaseUrl}/rest/v1/questions?id=eq.${targetId}`, {
                method: 'PATCH', 
                headers: { ...headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify({ answer_text: null, answer_image_url: null })
            });
        }
        // 9. 선생님 답변 내용 수정
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

        // 💡 Supabase 에러 원문을 그대로 프론트엔드로 전달하는 핵심 로직
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
