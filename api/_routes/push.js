// api/push.js
// 웹 푸시(Web Push) 구독 등록 및 알림 센터 API
import { authenticate, supabaseAdminFetch } from './_auth.js';
import { VAPID_PUBLIC_KEY } from './_pushSender.js';

export default async function handler(req, res) {
    try {
        const auth = await authenticate(req);

        // 1. GET 요청: VAPID 공개키 요청 또는 최근 알림 목록 조회
        if (req.method === 'GET') {
            const { action } = req.query;

            // (1) VAPID 공개키 반환
            if (action === 'vapid_public_key') {
                return res.status(200).json({ publicKey: VAPID_PUBLIC_KEY });
            }

            // (2) 사용자의 최근 알림 목록 조회
            const notifications = await supabaseAdminFetch(
                `/rest/v1/notifications?user_id=eq.${auth.userId}&order=created_at.desc&limit=20`
            );
            return res.status(200).json(notifications);
        }

        // 2. POST 요청: 푸시 구독 저장 / 알림 읽음 처리 / 수동 알림 발송
        if (req.method === 'POST') {
            const { action } = req.body;

            // (1) 기기 푸시 구독 정보 저장
            if (action === 'subscribe') {
                const { subscription } = req.body;
                if (!subscription || !subscription.endpoint || !subscription.keys) {
                    return res.status(400).json({ error: '유효한 푸시 구독 정보가 필요합니다.' });
                }

                // 기존 endpoint 있으면 갱신, 없으면 추가 (Upsert)
                const endpoint = subscription.endpoint;
                const p256dh = subscription.keys.p256dh;
                const authKey = subscription.keys.auth;

                // 기존 구독 삭제 후 재등록
                await supabaseAdminFetch(`/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
                    method: 'DELETE'
                }).catch(() => {});

                await supabaseAdminFetch('/rest/v1/push_subscriptions', {
                    method: 'POST',
                    headers: { 'Prefer': 'return=minimal' },
                    body: JSON.stringify({
                        user_id: auth.userId,
                        endpoint,
                        p256dh,
                        auth: authKey
                    })
                });

                return res.status(200).json({ message: '푸시 알림 구독이 등록되었습니다.' });
            }

            // (2) 알림 확인 처리 -> DB에서 완전 삭제
            if (action === 'mark_read') {
                const { id } = req.body;
                if (!id) return res.status(400).json({ error: '알림 ID가 필요합니다.' });

                await supabaseAdminFetch(`/rest/v1/notifications?id=eq.${id}&user_id=eq.${auth.userId}`, {
                    method: 'DELETE'
                });

                return res.status(200).json({ message: '확인한 알림이 DB에서 삭제되었습니다.' });
            }

            // (3) 모든 알림 확인 처리 -> DB에서 완전 삭제
            if (action === 'mark_all_read') {
                await supabaseAdminFetch(`/rest/v1/notifications?user_id=eq.${auth.userId}`, {
                    method: 'DELETE'
                });

                return res.status(200).json({ message: '모든 알림이 DB에서 삭제되었습니다.' });
            }

            return res.status(400).json({ error: '알 수 없는 action입니다.' });
        }

        // 3. DELETE 요청: 푸시 구독 해제
        if (req.method === 'DELETE') {
            const { endpoint } = req.query;
            if (endpoint) {
                await supabaseAdminFetch(`/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}&user_id=eq.${auth.userId}`, {
                    method: 'DELETE'
                });
            }
            return res.status(200).json({ message: '푸시 구독이 해제되었습니다.' });
        }

        return res.status(405).json({ error: '지원하지 않는 HTTP 메서드입니다.' });
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message || '서버 오류가 발생했습니다.' });
    }
}
