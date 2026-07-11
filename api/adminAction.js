export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 가능' });

    // 프론트엔드가 보내는 모든 액션과 데이터를 받습니다.
    const { action, id, recordId, studentId, student_id, exam_title, score, feedbackTitle, feedbackText, answerText } = req.body;
    
    // 이름표 충돌 방지용 (융단폭격 방어)
    const targetId = id || recordId;
    const targetStudentId = studentId || student_id;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    const headers = { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };

    try {
        // 🚨 1. 학생 삭제
        if (action === 'deleteStudent') {
            const dbRes = await fetch(`${supabaseUrl}/rest/v1/students?id=eq.${targetStudentId}`, { method: 'DELETE', headers });
            if (!dbRes.ok) throw new Error('학생 삭제 실패');
        }
        // 🚨 2. 시험 점수 관련 삭제 / 수정
        else if (action === 'deleteExam') {
            const dbRes = await fetch(`${supabaseUrl}/rest/v1/exams?id=eq.${targetId}`, { method: 'DELETE', headers });
            if (!dbRes.ok) throw new Error('시험 삭제 실패');
        }
        else if (action === 'editExam') {
            const dbRes = await fetch(`${supabaseUrl}/rest/v1/exams?id=eq.${targetId}`, {
                method: 'PATCH', headers: { ...headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify({ exam_title: exam_title, score: parseInt(score) })
            });
            if (!dbRes.ok) throw new Error('시험 수정 실패');
        }
        // 🚨 3. 피드백 관련 등록 / 삭제 / 수정
        else if (action === 'addFeedback') {
            const dbRes = await fetch(`${supabaseUrl}/rest/v1/feedbacks`, {
                method: 'POST', headers: { ...headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify({ student_id: targetStudentId, feedback_title: feedbackTitle, feedback_text: feedbackText })
            });
            if (!dbRes.ok) throw new Error('피드백 등록 실패');
        }
        else if (action === 'deleteFeedback') {
            const dbRes = await fetch(`${supabaseUrl}/rest/v1/feedbacks?id=eq.${targetId}`, { method: 'DELETE', headers });
            if (!dbRes.ok) throw new Error('피드백 삭제 실패');
        }
        else if (action === 'editFeedback') {
            const dbRes = await fetch(`${supabaseUrl}/rest/v1/feedbacks?id=eq.${targetId}`, {
                method: 'PATCH', headers: { ...headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify({ feedback_title: feedbackTitle, feedback_text: feedbackText })
            });
            if (!dbRes.ok) throw new Error('피드백 수정 실패');
        }
        // 🚨 4. 질문 및 답변 관련 삭제 / 수정
        else if (action === 'deleteQuestion') {
            const dbRes = await fetch(`${supabaseUrl}/rest/v1/questions?id=eq.${targetId}`, { method: 'DELETE', headers });
            if (!dbRes.ok) throw new Error('질문 삭제 실패');
        }
        else if (action === 'deleteAnswer') {
            // 답변 삭제는 질문 게시글을 지우는게 아니라, 선생님 답변 칸만 빈칸(null)으로 되돌리는 겁니다.
            const dbRes = await fetch(`${supabaseUrl}/rest/v1/questions?id=eq.${targetId}`, {
                method: 'PATCH', headers: { ...headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify({ answer_text: null, answer_image_url: null })
            });
            if (!dbRes.ok) throw new Error('답변 내용 지우기 실패');
        }
        else if (action === 'editAnswer') {
            const dbRes = await fetch(`${supabaseUrl}/rest/v1/questions?id=eq.${targetId}`, {
                method: 'PATCH', headers: { ...headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify({ answer_text: answerText })
            });
            if (!dbRes.ok) throw new Error('답변 수정 실패');
        }
        else {
            throw new Error('서버가 알 수 없는 명령(action)입니다: ' + action);
        }

        return res.status(200).json({ message: '요청 성공' });
    } catch (error) {
        console.error('adminAction 통신 에러:', error);
        return res.status(500).json({ error: error.message });
    }
}
