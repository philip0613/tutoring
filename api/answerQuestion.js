export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 가능합니다.' });

    const { question_id, answer_text, image_base64, image_name } = req.body;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    try {
        let answer_image_url = null;

        // 1. 선생님이 사진을 첨부했다면 Storage에 먼저 업로드
        if (image_base64 && image_name) {
            const uniqueFileName = `answer_${Date.now()}_${encodeURIComponent(image_name)}`;
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
            answer_image_url = `${supabaseUrl}/storage/v1/object/public/tutor_files/${uniqueFileName}`;
        }

        // 2. DB 업데이트 (답변 내용 + 답변 사진 URL)
        const response = await fetch(`${supabaseUrl}/rest/v1/questions?id=eq.${question_id}`, {
            method: 'PATCH', 
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                answer_text: answer_text,
                is_answered: true,
                answer_image_url: answer_image_url // 새로 추가된 칸에 저장!
            })
        });

        if (!response.ok) throw new Error('답변 등록에 실패했습니다.');

        return res.status(200).json({ message: '답변이 성공적으로 등록되었습니다.' });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}
