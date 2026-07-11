export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 가능' });

    // 프론트가 보내는 데이터 추출
    const { student_id, studentId, id, userId, exam_title, examTitle, score, image_base64, image_name } = req.body;

    const targetStudentId = student_id || studentId || id || userId;
    const targetTitle = exam_title || examTitle;

    if (!targetStudentId || !targetTitle || score === undefined) {
        return res.status(400).json({ error: '필수 데이터(학생ID, 시험명, 점수)가 누락되었습니다.' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    const headers = { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };

    try {
        let uploadedImageUrl = null;

        // 💡 [핵심 패치] 여기서 사진을 진짜 이미지 파일로 변환해서 저장소에 올립니다!
        if (image_base64 && image_name) {
            const base64Data = image_base64.split(',')[1] || image_base64;
            const buffer = Buffer.from(base64Data, 'base64');
            
            // 파일명 깨짐 방지 무작위 세탁
            const randomStr = Math.random().toString(36).substring(2, 10);
            const uniqueFileName = `exam_${Date.now()}_${randomStr}.png`;

            // tutor_files 버킷의 exams 폴더(없으면 자동생성)에 안전하게 저장!
            const storageUrl = `${supabaseUrl}/storage/v1/object/tutor_files/exams/${uniqueFileName}`;

            const storageRes = await fetch(storageUrl, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'image/png' },
                body: buffer
            });

            if (!storageRes.ok) throw new Error('스토리지에 시험지 사진을 올리는데 실패했습니다.');
            
            // 사진이 정상적으로 올라갔다면 인터넷 주소를 완성해서 담아두기
            uploadedImageUrl = `${supabaseUrl}/storage/v1/object/public/tutor_files/exams/${uniqueFileName}`;
        }

        // 💡 [DB 저장] 프론트엔드가 찾는 'paper_image_url'이라는 이름으로 URL 주소를 쏙 넣어주기!
        const dbRes = await fetch(`${supabaseUrl}/rest/v1/exams`, {
            method: 'POST',
            headers: { ...headers, 'Prefer': 'return=minimal' },
            body: JSON.stringify({
                student_id: targetStudentId,
                exam_title: targetTitle,
                score: parseInt(score),
                paper_image_url: uploadedImageUrl  // 드디어 짝이 맞았습니다!
            })
        });

        if (!dbRes.ok) throw new Error('DB 테이블 저장 실패');
        
        return res.status(200).json({ message: '시험 점수 및 사진 등록 성공!' });

    } catch (error) {
        return res.status(500).json({ error: '업로드 에러', details: error.message });
    }
}
