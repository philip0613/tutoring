export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 가능합니다.' });

    const { student_id, exam_title, score, image_base64, image_name } = req.body;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    try {
        let paper_image_url = null;

        // 1. 사진 파일이 넘어왔다면 Storage 창고에 먼저 업로드!
        if (image_base64 && image_name) {
            // 파일 이름이 겹치지 않게 앞에 현재 시간을 붙여줌
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
            
            // 성공하면 퍼블릭 링크(URL) 만들기
            paper_image_url = `${supabaseUrl}/storage/v1/object/public/tutor_files/${uniqueFileName}`;
        }

        // 2. DB exams 테이블에 데이터 저장 (이미지 URL 포함)
        const dbRes = await fetch(`${supabaseUrl}/rest/v1/exams`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                student_id: student_id,
                exam_title: exam_title,
                score: score,
                paper_image_url: paper_image_url // 사진 없으면 null이 저장됨
            })
        });

        if (!dbRes.ok) throw new Error('데이터베이스 저장 실패');

        return res.status(200).json({ message: '점수 및 사진 저장 완료' });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}
