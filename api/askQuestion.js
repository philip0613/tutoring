export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 가능합니다.' });

    const { student_id, question_text, image_base64, image_name } = req.body;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    try {
        let question_image_url = null;

        if (image_base64 && image_name) {
            const uniqueFileName = `${Date.now()}_${encodeURIComponent(image_name)}`;
            const buffer = Buffer.from(image_base64, 'base64');
            const mimeType = image_name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

            const storageRes = await fetch(`${supabaseUrl}/storage/v1/object/tutor_files/${uniqueFileName}`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': mimeType
                },
                body: buffer
            });

            if (!storageRes.ok) throw new Error('스토리지 이미지 업로드 실패');
            question_image_url = `${supabaseUrl}/storage/v1/object/public/tutor_files/${uniqueFileName}`;
        }

        const dbRes = await fetch(`${supabaseUrl}/rest/v1/questions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Prefer': 'return=minimal' },
            body: JSON.stringify({ student_id: student_id, question_text: question_text, question_image_url: question_image_url })
        });

        if (!dbRes.ok) throw new Error('질문 등록 실패');
        return res.status(200).json({ message: '질문이 성공적으로 등록되었습니다.' });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}
