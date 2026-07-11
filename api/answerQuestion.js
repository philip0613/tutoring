export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 가능' });

    const { questionId, id, answer_text, answerText, image_base64, image_name } = req.body;
    const targetId = questionId || id;
    const targetText = answer_text || answerText;

    if (!targetId || !targetText) return res.status(400).json({ error: '질문 ID 또는 답변 내용 누락' });

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY; 
    const headers = { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };

    try {
        let uploadedImageUrl = null;

        if (image_base64 && image_name) {
            const base64Data = image_base64.split(',')[1] || image_base64;
            const buffer = Buffer.from(base64Data, 'base64');
            
            // 💡 핵심 패치: 한글 파일명 깨짐 방지
            const safeFileName = encodeURIComponent(image_name);
            const uniqueFileName = `${Date.now()}_ans_${safeFileName}`;
            
            const storageUrl = `${supabaseUrl}/storage/v1/object/tutor_files/questions/${uniqueFileName}`;

            const storageRes = await fetch(storageUrl, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'image/png' },
                body: buffer
            });

            if (!storageRes.ok) throw new Error('답변 이미지 업로드 실패');
            uploadedImageUrl = `${supabaseUrl}/storage/v1/object/public/tutor_files/questions/${uniqueFileName}`;
        }

        const dbRes = await fetch(`${supabaseUrl}/rest/v1/questions?id=eq.${targetId}`, {
            method: 'PATCH', 
            headers: { ...headers, 'Prefer': 'return=minimal' },
            body: JSON.stringify({
                answer_text: targetText,
                ...(uploadedImageUrl && { answer_image_url: uploadedImageUrl }) 
            })
        });

        if (!dbRes.ok) {
            const err = await dbRes.json().catch(()=>({}));
            throw new Error(`DB 업데이트 실패: ${JSON.stringify(err)}`);
        }
        return res.status(200).json({ message: '답변 등록 성공!' });

    } catch (error) {
        return res.status(500).json({ error: '백엔드 내부 연동 실패', details: error.message });
    }
}
