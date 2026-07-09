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

    // URL에서 파일 이름만 정확하게 추출하는 함수
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
            // [개별 삭제] 질문이나 시험 점수를 하나씩 지울 때도 사진 같이 삭제
            if (table === 'questions' || table === 'exams') {
                const getRes = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}`, { headers });
                const getData = await getRes.json();
                if (getData && getData.length > 0) {
                    const item = getData[0];
                    const files = [
                        extractFilename(item.question_image_url), 
                        extractFilename(item.answer_image_url), 
                        extractFilename(item.paper_image_url)
                    ].filter(Boolean);
                    
                    // Supabase 공식 대량 삭제 API 규격 부합화 (body에 파일명 배열 전송)
                    if (files.length > 0) {
                        await fetch(`${supabaseUrl}/storage/v1/object/tutor_files`, {
                            method: 'DELETE',
                            headers: headers,
                            body: JSON.stringify({ prefixes: files })
                        });
                    }
                }
            }

            const response = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
                method: 'DELETE', headers: headers
            });
            if (!response.ok) throw new Error('DB 데이터 삭제 실패');
        } 
        else if (action === 'deleteStudent') {
            // [학생 전체 삭제] 1. 이 학생과 관련된 모든 사진 파일명 명단 수집
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
                    filesToDelete.push(extractFilename(q.answer_image_url)); // 선생님 답변 사진 포함
                });
            }
            filesToDelete = filesToDelete.filter(Boolean); 

            // 2. 수집된 명단이 있다면 Supabase 공식 API를 이용해 창고(Storage)에서 한방에 완전 폭파!
            if (filesToDelete.length > 0) {
                await fetch(`${supabaseUrl}/storage/v1/object/tutor_files`, { 
                    method: 'DELETE', 
                    headers: headers,
                    body: JSON.stringify({ prefixes: filesToDelete }) // 규격 매칭
                });
            }

            // 3. 데이터베이스 글자 데이터(DB) 삭제
            await fetch(`${supabaseUrl}/rest/v1/exams?student_id=eq.${student_id}`, { method: 'DELETE', headers });
            await fetch(`${supabaseUrl}/rest/v1/questions?student_id=eq.${student_id}`, { method: 'DELETE', headers });
            await fetch(`${supabaseUrl}/rest/v1/feedbacks?student_id=eq.${student_id}`, { method: 'DELETE', headers });
            await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${student_id}`, { method: 'DELETE', headers });

            // 4. Auth 유저 로그인 계정 폭파
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
