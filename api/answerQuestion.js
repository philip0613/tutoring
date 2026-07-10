export default async function handler(req, res) {
    // 🚨 POST 요청 방어
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'POST 요청만 가능합니다.' });
    }

    // 💡 프론트엔드에서 보낸 융단폭격 데이터 추출
    const { questionId, id, answer_text, answerText, image_base64, image_name } = req.body;
    
    // 변수명 불일치 방어
    const targetId = questionId || id;
    const targetText = answer_text || answerText;

    if (!targetId || !targetText) {
        return res.status(400).json({ error: '질문 ID 또는 답변 내용이 누락되었습니다.' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY; 

    const headers = {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
    };

    try {
        let uploadedImageUrl = null;

        // ==========================================
        // 1. [스토리지 처리] 선생님이 사진을 같이 올렸을 경우
        // ==========================================
        if (image_base64 && image_name) {
            // Base64 순수 데이터 분리
            const base64Data = image_base64.split(',')[1] || image_base64;
            const buffer = Buffer.from(base64Data, 'base64');
            const uniqueFileName = `${Date.now()}_ans_${image_name}`;
            
            // 답변용 사진도 똑같이 questions 폴더나 answers 폴더에 저장 (여기선 편의상 questions 폴더 유지)
            const storageUrl = `${supabaseUrl}/storage/v1/object/tutor_files/questions/${uniqueFileName}`;

            const storageRes = await fetch(storageUrl, {
                method: 'POST',
                headers: {
                    ...headers,
                    'Content-Type': 'image/png' 
                },
                body: buffer
            });

            if (!storageRes.ok) {
                const storageErr = await storageRes.json().catch(() => ({}));
                throw new Error(`답변 이미지 업로드 실패: ${JSON.stringify(storageErr)}`);
            }

            uploadedImageUrl = `${supabaseUrl}/storage/v1/object/public/tutor_files/questions/${uniqueFileName}`;
        }

        // ==========================================
        // 2. [DB 업데이트] 기존 질문(questions) 행에 선생님 답변 내용 추가(PATCH)
        // ==========================================
        const dbRes = await fetch(`${supabaseUrl}/rest/v1/questions?id=eq.${targetId}`, {
            method: 'PATCH', // 💡 새로 만드는 게 아니라 기존 질문에 덮어쓰는 거라 PATCH 사용!
            headers: {
                ...headers,
                'Prefer': 'return=minimal' 
            },
            body: JSON.stringify({
                answer_text: targetText,
                // 사진을 올렸을 때만 URL 업데이트, 안 올렸으면 기존 데이터 유지
                ...(uploadedImageUrl && { answer_image_url: uploadedImageUrl }) 
            })
        });

        if (!dbRes.ok) {
            const dbErr = await dbRes.json().catch(() => ({}));
            throw new Error(`데이터베이스 답변 업데이트 실패: ${JSON.stringify(dbErr)}`);
        }

        return res.status(200).json({ message: '답변 등록 성공!' });

    } catch (error) {
        console.error('❌ 답변 업로드 백엔드 에러:', error);
        return res.status(500).json({ 
            error: '백엔드 내부 연동 실패', 
            details: error.message 
        });
    }
}
