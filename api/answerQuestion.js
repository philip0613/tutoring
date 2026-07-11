export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 가능' });

    const { student_id, studentId, id, userId, question_text, questionText, image_base64, image_name } = req.body;
    const targetStudentId = student_id || studentId || id || userId;
    const targetText = question_text || questionText;

    if (!targetStudentId || !targetText) return res.status(400).json({ error: 'ID 또는 질문 내용 누락' });

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY; 
    const headers = { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };

    try {
        let uploadedImageUrl = null;

        if (image_base64 && image_name) {
            const base64Data = image_base64.split(',')[1] || image_base64;
            const buffer = Buffer.from(base64Data, 'base64');
            
            // 💡 핵심 패치: 한글 파일명 깨짐 방지를 위한 안전한 URL 변환
            const safeFileName = encodeURIComponent(image_name);
            const uniqueFileName = `${Date.now()}_${safeFileName}`;
            
            const storageUrl = `${supabaseUrl}/storage/v1/object/tutor_files/questions/${uniqueFileName}`;

            const storageRes = await fetch(storageUrl, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'image/png' },
                body: buffer
            });

            if (!storageRes.ok) throw new Error('스토리지 업로드 실패');
            uploadedImageUrl = `${supabaseUrl}/storage/v1/object/public/tutor_files/questions/${uniqueFileName}`;
        }

        const dbRes = await fetch(`${supabaseUrl}/rest/v1/questions`, {
            method: 'POST',
            headers: { ...headers, 'Prefer': 'return=minimal' },
            body: JSON.stringify({
                student_id: targetStudentId,
                question_text: targetText,
                question_image_url: uploadedImageUrl 
            })
        });

        if (!dbRes.ok) throw new Error('데이터베이스 저장 실패');
        return res.status(200).json({ message: '질문 등록 성공' });

    } catch (error) {
        return res.status(500).json({ error: '백엔드 내부 연동 실패', details: error.message });
    }
}
