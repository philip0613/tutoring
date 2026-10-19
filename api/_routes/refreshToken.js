// api/_routes/refreshToken.js
// 로그인 세션 갱신 API (Supabase refresh_token 기반)
import { getSupabaseConfig, supabaseAdminFetch } from './_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'POST 요청만 가능합니다.' });
    }

    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(400).json({ error: 'refresh_token이 필요합니다.' });
    }

    const { supabaseUrl, supabaseKey } = getSupabaseConfig();

    try {
        const refreshRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey
            },
            body: JSON.stringify({ refresh_token: refreshToken })
        });

        const data = await refreshRes.json();
        if (!refreshRes.ok) {
            return res.status(401).json({ error: data.error_description || data.msg || '토큰 갱신 실패' });
        }

        const userId = data.user?.id;
        let role = 'student';
        let name = '사용자';

        if (userId) {
            try {
                const profileRes = await supabaseAdminFetch(`/rest/v1/profiles?id=eq.${userId}&select=role,name`);
                if (Array.isArray(profileRes) && profileRes.length > 0) {
                    role = profileRes[0].role;
                    name = profileRes[0].name;
                }
            } catch (e) {
                console.warn('Profile fetch during refresh warning:', e);
            }
        }

        return res.status(200).json({
            token: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: data.expires_at,
            expiresIn: data.expires_in,
            user: data.user,
            role,
            name
        });
    } catch (error) {
        console.error('Refresh token error:', error);
        return res.status(500).json({ error: error.message || '세션 갱신 중 서버 오류가 발생했습니다.' });
    }
}
