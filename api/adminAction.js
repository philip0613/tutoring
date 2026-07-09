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

    // 🌟 [추가됨] URL에서 순수 파일 이름만 뽑아내는 마법의 헬퍼 함수
    const extractFilename = (url) => {
        if (!url) return null;
        const parts = url.split('/tutor_files/');
        return parts.length > 1 ? parts[1] : null;
    };

    try {
        if (action === 'update') {
            const response = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
                method: 'PATCH',
                headers: { ...headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify(updateData)
            });
            if (!response.ok) throw new Error('DB 데이터 수정 실패');
        } 
        else if (action === 'delete') {
            // 🌟 [추가됨] 개별 삭제 시: 먼저 데이터를 조회해서 사진이 있으면 창고에서 지워버림!
            if (table === 'questions' || table === 'exams') {
                const getRes = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}`, { headers });
                const getData = await getRes.json();
                if (getData && getData.length > 0) {
                    const item = getData[0];
                    const files = [extractFilename(item.question_image_url), extractFilename(item.answer_image_url), extractFilename(item.paper_image_url)].filter(Boolean);
                    for (const file of files) {
                        await fetch(`${supabaseUrl}/storage/v1/object/tutor_files/${file}`, { method: 'DELETE', headers });
                    }
                }
            }

            const response = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
                method: 'DELETE', headers: headers
            });
            if (!response.ok) throw new Error('DB 데이터 삭제 실패');
        } 
        else if (action === 'deleteStudent') {
            // 🌟 [추가됨] 1. 학생과 관련된 모든 시험/질문 데이터를 가져와서 사진 파일명만 싹 수집!
            const examsRes = await fetch(`${supabaseUrl}/rest/v1/exams?student_id=eq.${student_id}`, { headers });
            const exams = await examsRes.json();
            
            const questionsRes = await fetch(`${supabaseUrl}/rest/v1/questions?student_id=eq.${student_id}`, { headers });
            const questions = await questionsRes.json();

            let filesToDelete = [];
            if (exams && exams.length > 0) {
                exams.forEach(ex => filesToDelete.push(extractFilename(ex.paper_image_url)));
            }
            if (questions && questions.length > 0) {
                questions.forEach(q => {
                    filesToDelete.push(extractFilename(q.question_image_url));
                    filesToDelete.push(extractFilename(q.answer_image_url)); // 선생님 답변 사진도 수집!
                });
            }
            // null 값 찌끄레기들 제거
            filesToDelete = filesToDelete.filter(Boolean); 

            // 🌟 [추가됨] 2. 수집된 사진들을 Storage 창고에서 진짜로 폭파시키기!
            for (const file of filesToDelete) {
                await fetch(`${supabaseUrl}/storage/v1/object/tutor_files/${file}`, { 
                    method: 'DELETE', headers 
                });
            }

            // 3. 기존대로 텍스트 데이터(DB) 삭제
            await fetch(`${supabaseUrl}/rest/v1/exams?student_id=eq.${student_id}`, { method: 'DELETE', headers });
            await fetch(`${supabaseUrl}/rest/v1/questions?student_id=eq.${student_id}`, { method: 'DELETE', headers });
            await fetch(`${supabaseUrl}/rest/v1/feedbacks?student_id=eq.${student_id}`, { method: 'DELETE', headers });
            await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${student_id}`, { method: 'DELETE', headers });

            // 4. 마지막 Auth 유저 계정 폭파
            await fetch(`${supabaseUrl}/auth/v1/admin/users/${student_id}`, {
                method: 'DELETE',
                headers: headers
            });
        } 
        else {
            throw new Error('알 수 없는 명령입니다.');
        }

        return res.status(200).json({ message: '성공' });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}
