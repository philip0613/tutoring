// api/askQuestion.js
// 학생 질문 등록 및 미답변 질문 취소/삭제 API (JWT 인증, 과목 연결, 담당 선생님 알림 발송)
import { authenticate, getSupabaseConfig, supabaseAdminFetch } from './_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST' && req.method !== 'DELETE') {
        return res.status(405).json({ error: 'POST 또는 DELETE 요청만 가능합니다.' });
    }

    try {
        const auth = await authenticate(req);
        const { supabaseUrl, supabaseKey } = getSupabaseConfig();
        const headers = { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };

        // 🗑️ 1. 질문 삭제 (DELETE) - 미답변 상태인 경우 학생 본인도 삭제 가능
        if (req.method === 'DELETE') {
            const questionId = req.query.id || req.body?.id;
            if (!questionId) return res.status(400).json({ error: '질문 ID가 필요합니다.' });

            const qs = await supabaseAdminFetch(`/rest/v1/questions?id=eq.${questionId}&select=id,student_id,is_answered,answer_text,question_image_url`);
            if (!qs || qs.length === 0) {
                return res.status(404).json({ error: '해당 질문을 찾을 수 없습니다.' });
            }
            const q = qs[0];

            // 권한 검증: 본인 학생이거나 선생님 계정이어야 함
            if (auth.isStudent && q.student_id !== auth.userId) {
                return res.status(403).json({ error: '본인이 등록한 질문만 삭제할 수 있습니다.' });
            }

            // 학생인 경우: 답변 완료된 질문은 삭제 불가 ("답변된거 제외하고 답변아직 안된거는 학생도 지울 수 있어야지")
            const hasAnswer = Boolean(q.is_answered || (q.answer_text && q.answer_text.trim() !== ''));
            if (auth.isStudent && hasAnswer) {
                return res.status(400).json({ error: '선생님이 이미 풀이/답변을 작성한 질문은 학생이 삭제할 수 없습니다.' });
            }

            // 첨부 문제 사진이 있다면 스토리지에서 삭제
            if (q.question_image_url) {
                const parts = q.question_image_url.split('/tutor_files/');
                const prefix = parts.length > 1 ? parts[1].split('?')[0] : null;
                if (prefix) {
                    await fetch(`${supabaseUrl}/storage/v1/object/tutor_files`, {
                        method: 'DELETE',
                        headers,
                        body: JSON.stringify({ prefixes: [prefix] })
                    }).catch(err => console.error('질문 이미지 스토리지 삭제 에러:', err));
                }
            }

            // DB에서 질문 레코드 삭제
            await supabaseAdminFetch(`/rest/v1/questions?id=eq.${questionId}`, { method: 'DELETE' });

            return res.status(200).json({ message: '질문이 성공적으로 삭제되었습니다.' });
        }

        // 📝 2. 질문 등록 (POST)
        const { question_text, questionText, image_base64, image_name, subject_id } = req.body;
        const targetText = question_text || questionText;
        const studentId = auth.isStudent ? auth.userId : (req.body.student_id || auth.userId);

        if (!targetText) return res.status(400).json({ error: '질문 내용을 입력해 주세요.' });

        let uploadedImageUrl = null;
        if (image_base64) {
            const base64Data = image_base64.split(',')[1] || image_base64;
            const buffer = Buffer.from(base64Data, 'base64');
            
            const randomStr = Math.random().toString(36).substring(2, 10);
            const uniqueFileName = `q_${Date.now()}_${randomStr}.png`;
            const storageUrl = `${supabaseUrl}/storage/v1/object/tutor_files/questions/${uniqueFileName}`;

            const storageRes = await fetch(storageUrl, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'image/png' },
                body: buffer
            });

            if (!storageRes.ok) throw new Error('사진 업로드에 실패했습니다.');
            uploadedImageUrl = `${supabaseUrl}/storage/v1/object/public/tutor_files/questions/${uniqueFileName}`;
        }

        // 1. 질문 DB 저장
        const dbPayload = {
            student_id: studentId,
            question_text: targetText,
            question_image_url: uploadedImageUrl,
            subject_id: subject_id || null
        };

        const inserted = await supabaseAdminFetch('/rest/v1/questions', {
            method: 'POST',
            headers: { 'Prefer': 'return=representation' },
            body: JSON.stringify(dbPayload)
        });

        // 2. 담당 선생님에게 알림 생성
        let teacherId = null;
        if (subject_id) {
            const subject = await supabaseAdminFetch(`/rest/v1/subjects?id=eq.${subject_id}&select=teacher_id,name`);
            if (subject && subject.length > 0) {
                teacherId = subject[0].teacher_id;
            }
        }

        if (!teacherId) {
            // 과목 지정이 없으면 첫 번째 선생님/관리자 계정 조회
            const teachers = await supabaseAdminFetch(`/rest/v1/profiles?role=in.(teacher,admin)&select=id&limit=1`);
            if (teachers && teachers.length > 0) {
                teacherId = teachers[0].id;
            }
        }

        if (teacherId) {
            await supabaseAdminFetch('/rest/v1/notifications', {
                method: 'POST',
                headers: { 'Prefer': 'return=minimal' },
                body: JSON.stringify({
                    user_id: teacherId,
                    title: `새 질문 도착 🙋‍♂️ (${auth.name} 학생)`,
                    body: targetText.length > 40 ? targetText.substring(0, 40) + '...' : targetText,
                    link: `#question-${inserted[0]?.id || ''}`
                })
            }).catch(() => {});
        }

        return res.status(200).json({ message: '질문이 성공적으로 등록되었습니다.', data: inserted[0] });
    } catch (error) {
        return res.status(error.status || 500).json({ error: error.message || '질문 처리 실패' });
    }
}
