// api/uploadExam.js
// 선생님 시험 성적 및 시험지 업로드 API (JWT 인증, 과목 연결, 학생 알림 발송)
import { authenticate, getSupabaseConfig, supabaseAdminFetch } from './_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 가능합니다.' });

    try {
        const auth = await authenticate(req);
        if (!auth.isTeacher) {
            return res.status(403).json({ error: '선생님 계정만 시험 성적을 등록할 수 있습니다.' });
        }

        const { supabaseUrl, supabaseKey } = getSupabaseConfig();
        const headers = { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };

        const { student_id, studentId, id, userId, exam_title, examTitle, score, image_base64, image_name, subject_id } = req.body;
        const targetStudentId = student_id || studentId || id || userId;
        const targetTitle = exam_title || examTitle;

        if (!targetStudentId || !targetTitle || score === undefined) {
            return res.status(400).json({ error: '필수 데이터(학생ID, 시험명, 점수)가 누락되었습니다.' });
        }

        let uploadedImageUrl = null;
        if (image_base64) {
            const base64Data = image_base64.split(',')[1] || image_base64;
            const buffer = Buffer.from(base64Data, 'base64');
            
            const randomStr = Math.random().toString(36).substring(2, 10);
            const uniqueFileName = `exam_${Date.now()}_${randomStr}.png`;
            const storageUrl = `${supabaseUrl}/storage/v1/object/tutor_files/exams/${uniqueFileName}`;

            const storageRes = await fetch(storageUrl, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'image/png' },
                body: buffer
            });

            if (!storageRes.ok) throw new Error('스토리지에 시험지 사진을 올리는데 실패했습니다.');
            uploadedImageUrl = `${supabaseUrl}/storage/v1/object/public/tutor_files/exams/${uniqueFileName}`;
        }

        const dbRes = await supabaseAdminFetch('/rest/v1/exams', {
            method: 'POST',
            headers: { 'Prefer': 'return=representation' },
            body: JSON.stringify({
                student_id: targetStudentId,
                exam_title: targetTitle,
                score: parseInt(score, 10),
                paper_image_url: uploadedImageUrl,
                subject_id: subject_id || null
            })
        });

        // 학생에게 알림 발송
        await supabaseAdminFetch('/rest/v1/notifications', {
            method: 'POST',
            headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({
                user_id: targetStudentId,
                title: `새로운 시험 성적이 등록되었습니다 📊`,
                body: `${targetTitle}: ${score}점`,
                link: '#exam'
            })
        }).catch(() => {});

        return res.status(200).json({ message: '시험 점수 및 사진 등록 성공!', data: dbRes[0] });
    } catch (error) {
        return res.status(error.status || 500).json({ error: error.message || '시험 등록 실패' });
    }
}
