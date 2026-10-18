// api/_auth.js
// Vercel Serverless 공통 인증 및 Supabase 통신 헬퍼

export const getSupabaseConfig = () => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
    }
    return { supabaseUrl, supabaseKey };
};

// Supabase REST / Auth API 호출 헬퍼 (Service Role 키 사용)
export async function supabaseAdminFetch(endpoint, options = {}) {
    const { supabaseUrl, supabaseKey } = getSupabaseConfig();
    const url = endpoint.startsWith('http') ? endpoint : `${supabaseUrl}${endpoint}`;
    
    const headers = {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    const res = await fetch(url, {
        ...options,
        headers
    });

    const contentType = res.headers.get('content-type');
    let data = null;
    if (contentType && contentType.includes('application/json')) {
        data = await res.json();
    } else {
        data = await res.text();
    }

    if (!res.ok) {
        const errorMsg = (data && data.message) || (data && data.error) || (data && data.error_description) || (typeof data === 'string' && data) || 'Supabase 요청 실패';
        throw new Error(errorMsg);
    }

    return data;
}

// 🔐 JWT 토큰 검증 미들웨어
// 클라이언트의 Authorization: Bearer <token> 헤더를 검증하고 사용자 정보와 역할을 반환
export async function authenticate(req) {
    const { supabaseUrl, supabaseKey } = getSupabaseConfig();
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const err = new Error('로그인이 필요합니다. (인증 토큰 누락)');
        err.status = 401;
        throw err;
    }

    const token = authHeader.replace('Bearer ', '').trim();

    // 1. Supabase Auth에 토큰 유효성 검증 요청
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: 'GET',
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${token}`
        }
    });

    if (!userRes.ok) {
        const err = new Error('유효하지 않거나 만료된 로그인 토큰입니다.');
        err.status = 401;
        throw err;
    }

    const user = await userRes.json();

    // 2. 해당 유저의 profile 정보 (role, name) 조회
    const profiles = await supabaseAdminFetch(`/rest/v1/profiles?id=eq.${user.id}&select=id,role,name`);
    const profile = profiles && profiles.length > 0 ? profiles[0] : null;

    const role = profile ? profile.role : 'student';
    const name = profile ? profile.name : (user.user_metadata?.name || '사용자');
    const isTeacher = role === 'admin' || role === 'teacher';
    const isStudent = role === 'student';

    return {
        user,
        userId: user.id,
        role,
        name,
        token,
        isTeacher,
        isStudent
    };
}
