export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 가능합니다.' });

    const { action, id, recordId, studentId, student_id, exam_title, score, feedbackTitle, feedbackText, answerText } = req.body;
    
    const targetId = id || recordId;
    const targetStudentId = studentId || student_id;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    const headers = { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };

    // 💡 [핵심 기능] 스토리지 사진들을 배열로 묶어서 한 번에 날려버리는 공식 삭제 엔진
    const deleteStorageFiles = async (urls) => {
        const prefixes = urls.filter(url => url && url !== 'null').map(url => {
            const parts = url.split('/tutor_files/');
            return parts.length > 1 ? parts[1].split('?')[0] : null;
        }).filter(Boolean);

        if (prefixes.length > 0) {
            await fetch(`${supabaseUrl}/storage/v1/object/tutor_files`, {
                method: 'DELETE',
                headers: headers,
                body: JSON.stringify({ prefixes }) // 파일 경로들을 배열로 던져서 일괄 삭제!
            }).catch(err => console.error('스토리지 삭제 에러:', err));
        }
    };

    try {
        let dbRes;

        if (action === 'deleteStudent') {
            const [examsRes, qsRes] = await Promise.all([
                fetch(`${supabaseUrl}/rest/v1/exams?student_id=eq.${targetStudentId}&select=paper_image_url`, { headers }),
                fetch(`${supabaseUrl}/rest/v1/questions?student_id=eq.${targetStudentId}&select=question_image_url,answer_image_url`, { headers })
            ]);
            const exams = await examsRes.json().catch(()=>[]);
            const qs = await qsRes.json().catch(()=>[]);

            const filesToDelete = [];
            if (Array.isArray(exams)) exams.forEach(e => filesToDelete.push(e.paper_image_url));
            if (Array.isArray(qs)) qs.forEach(q => {
                filesToDelete.push(q.question_image_url);
                filesToDelete.push(q.answer_image_url);
            });

            // 1. 스토리지(사진) 싹쓸이 먼저 실행
            await deleteStorageFiles(filesToDelete);

            // 2. DB 기록 싹쓸이
            await fetch(`${supabaseUrl}/rest/v1/exams?student_id=eq.${targetStudentId}`, { method: 'DELETE', headers });
            await fetch(`${supabaseUrl}/rest/v1/questions?student_id=eq.${targetStudentId}`, { method: 'DELETE', headers });
            await fetch(`${supabaseUrl}/rest/v1/feedbacks?student_id=eq.${targetStudentId}`, { method: 'DELETE', headers });
            
            // 3. 학생 계정 완전 소멸
            dbRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${targetStudentId}`, { method: 'DELETE', headers });
            await fetch(`${supabaseUrl}/auth/v1/admin/users/${targetStudentId}`, { method: 'DELETE', headers });
        }
        else if (action === 'deleteExam') {
            const exRes = await fetch(`${supabaseUrl}/rest/v1/exams?id=eq.${targetId}&select=paper_image_url`, { headers });
            const exData = await exRes.json().catch(()=>[]);
            if(Array.isArray(exData) && exData[0]) await deleteStorageFiles([exData[0].paper_image_url]);
            
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
            const qRes = await fetch(`${supabaseUrl}/rest/v1/questions?id=eq.${targetId}&select=question_image_url,answer_image_url`, { headers });
            const qData = await qRes.json().catch(()=>[]);
            if(Array.isArray(qData) && qData[0]) await deleteStorageFiles([qData[0].question_image_url, qData[0].answer_image_url]);

            dbRes = await fetch(`${supabaseUrl}/rest/v1/questions?id=eq.${targetId}`, { method: 'DELETE', headers });
        }
        else if (action === 'deleteAnswer') {
            const qRes = await fetch(`${supabaseUrl}/rest/v1/questions?id=eq.${targetId}&select=answer_image_url`, { headers });
            const qData = await qRes.json().catch(()=>[]);
            if(Array.isArray(qData) && qData[0]) await deleteStorageFiles([qData[0].answer_image_url]);

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

        if (dbRes && !dbRes.ok) {
            const errorText = await dbRes.text().catch(() => 'Unknown DB Error');
            return res.status(400).json({ error: `Supabase 오류: ${errorText}` });
        }

        return res.status(200).json({ message: '요청 처리에 성공했습니다.' });

    } catch (error) {
        console.error('adminAction 내부 크래시:', error);
        return res.status(500).json({ error: `서버 내부 에러: ${error.message}` });
    }
}
