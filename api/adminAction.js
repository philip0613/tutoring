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

        // 🚨 1. 학생 완전 삭제 (Storage 사진 -> DB 기록 -> Authentication 계정 순서로 싹쓸이)
        if (action === 'deleteStudent') {
            // [1단계] 학생이 올린 시험지/질문/답변 사진 URL들 Storage에서 싹 다 지우기 위해 조회
            const [examsRes, qsRes] = await Promise.all([
                fetch(`${supabaseUrl}/rest/v1/exams?student_id=eq.${targetStudentId}&select=paper_image_url`, { headers }),
                fetch(`${supabaseUrl}/rest/v1/questions?student_id=eq.${targetStudentId}&select=question_image_url,answer_image_url`, { headers })
            ]);
            const exams = await examsRes.json().catch(()=>[]);
            const qs = await qsRes.json().catch(()=>[]);

            const filesToDelete = [];
            if (Array.isArray(exams)) exams.forEach(e => e.paper_image_url && filesToDelete.push(e.paper_image_url));
            if (Array.isArray(qs)) qs.forEach(q => {
                if (q.question_image_url) filesToDelete.push(q.question_image_url);
                if (q.answer_image_url) filesToDelete.push(q.answer_image_url);
            });

            // Storage 실제 삭제 통신
            for (const url of filesToDelete) {
                if (!url || url === 'null') continue;
                const parts = url.split('/tutor_files/');
                if (parts.length > 1) {
                    await fetch(`${supabaseUrl}/storage/v1/object/tutor_files/${parts[1]}`, { method: 'DELETE', headers });
                }
            }

            // [2단계] DB 테이블 관련 데이터 싹 다 지우기
            await fetch(`${supabaseUrl}/rest/v1/exams?student_id=eq.${targetStudentId}`, { method: 'DELETE', headers });
            await fetch(`${supabaseUrl}/rest/v1/questions?student_id=eq.${targetStudentId}`, { method: 'DELETE', headers });
            await fetch(`${supabaseUrl}/rest/v1/feedbacks?student_id=eq.${targetStudentId}`, { method: 'DELETE', headers });
            await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${targetStudentId}`, { method: 'DELETE', headers });

            // [3단계] Supabase Authentication (진짜 계정) 완전 삭제! -> 이거 해야 같은 아이디 또 생성 가능
            dbRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${targetStudentId}`, { method: 'DELETE', headers });
        }
        
        // 🚨 2. 개별 시험지 삭제 (사진 Storage 삭제 포함)
        else if (action === 'deleteExam') {
            const exRes = await fetch(`${supabaseUrl}/rest/v1/exams?id=eq.${targetId}&select=paper_image_url`, { headers });
            const exData = await exRes.json().catch(()=>[]);
            if(Array.isArray(exData) && exData[0] && exData[0].paper_image_url) {
                const parts = exData[0].paper_image_url.split('/tutor_files/');
                if (parts.length > 1) await fetch(`${supabaseUrl}/storage/v1/object/tutor_files/${parts[1]}`, { method: 'DELETE', headers });
            }
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
        
        // 🚨 3. 개별 질문 삭제 (질문 사진 및 답변 사진 Storage 삭제 포함)
        else if (action === 'deleteQuestion') {
            const qRes = await fetch(`${supabaseUrl}/rest/v1/questions?id=eq.${targetId}&select=question_image_url,answer_image_url`, { headers });
            const qData = await qRes.json().catch(()=>[]);
            if(Array.isArray(qData) && qData[0]) {
                if (qData[0].question_image_url) {
                    const parts = qData[0].question_image_url.split('/tutor_files/');
                    if (parts.length > 1) await fetch(`${supabaseUrl}/storage/v1/object/tutor_files/${parts[1]}`, { method: 'DELETE', headers });
                }
                if (qData[0].answer_image_url) {
                    const parts = qData[0].answer_image_url.split('/tutor_files/');
                    if (parts.length > 1) await fetch(`${supabaseUrl}/storage/v1/object/tutor_files/${parts[1]}`, { method: 'DELETE', headers });
                }
            }
            dbRes = await fetch(`${supabaseUrl}/rest/v1/questions?id=eq.${targetId}`, { method: 'DELETE', headers });
        }
        
        // 🚨 4. 선생님 답변만 삭제 (답변 사진 Storage 삭제 포함 후 빈칸 처리)
        else if (action === 'deleteAnswer') {
            const qRes = await fetch(`${supabaseUrl}/rest/v1/questions?id=eq.${targetId}&select=answer_image_url`, { headers });
            const qData = await qRes.json().catch(()=>[]);
            if(Array.isArray(qData) && qData[0] && qData[0].answer_image_url) {
                const parts = qData[0].answer_image_url.split('/tutor_files/');
                if (parts.length > 1) await fetch(`${supabaseUrl}/storage/v1/object/tutor_files/${parts[1]}`, { method: 'DELETE', headers });
            }
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
