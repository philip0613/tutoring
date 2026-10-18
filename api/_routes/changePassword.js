// api/changePassword.js
// 비밀번호 변경 API (JWT 인증 기반 - 본인 또는 선생님 권한)
import { authenticate, getSupabaseConfig } from './_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 가능합니다.' });

    try {
        const auth = await authenticate(req);
        const { supabaseUrl, supabaseKey } = getSupabaseConfig();
        const headers = { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };

        const { id, userId, user_id, newPassword, password } = req.body;
        let targetId = id || userId || user_id;
        const targetPw = newPassword || password;

        if (!targetPw) {
            return res.status(400).json({ error: '새로운 비밀번호를 입력해 주세요.' });
        }

        // 학생은 본인 비밀번호만 변경 가능
        if (auth.isStudent) {
            targetId = auth.userId;
        } else if (!targetId) {
            targetId = auth.userId;
        }

        const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${targetId}`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify({ password: targetPw })
        });

        if (!authRes.ok) {
            const errorText = await authRes.text().catch(() => '비밀번호 변경 실패');
            return res.status(400).json({ error: `비밀번호 변경 실패: ${errorText}` });
        }

        return res.status(200).json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
    } catch (error) {
        return res.status(error.status || 500).json({ error: error.message || '비밀번호 변경 실패' });
    }
}
