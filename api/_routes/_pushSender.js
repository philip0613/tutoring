// api/_routes/_pushSender.js
// 웹 푸시(Web Push) 발송 유틸리티 (백그라운드 OS 푸시 전송)
import webpush from 'web-push';
import { supabaseAdminFetch } from './_auth.js';

// VAPID 키 (Vercel 환경 변수가 설정되어 있으면 우선 사용, 없으면 내장 기본키 사용)
export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BPMp5qI6lvhW29Tu5df8weAf2Kn7EMIi50_TP3iqa4TfcWVGRvORt090lFb7F9kFQkdT2to3qW7GVw7CLkojLR4';
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'Zt_eylRhqp0fYAhkpjCgHCTuj2eUHov_jr2wmf0TEqc';
export const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@tutoring.app';

try {
    webpush.setVapidDetails(
        VAPID_SUBJECT,
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
    );
} catch (e) {
    console.error('VAPID 설정 오류:', e);
}

/**
 * 특정 사용자(또는 여러 사용자)에게 백그라운드 웹 푸시 알림 발송
 * @param {string|string[]} userIds - 알림을 받을 사용자 ID (UUID)
 * @param {object} payload - { title, body, link }
 */
export async function sendWebPush(userIds, payload = {}) {
    try {
        const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [userIds].filter(Boolean);
        if (ids.length === 0) return;

        // 1. 대상 사용자들의 push_subscriptions 조회
        const idListStr = ids.join(',');
        const subscriptions = await supabaseAdminFetch(
            `/rest/v1/push_subscriptions?user_id=in.(${idListStr})&select=*`
        );

        if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
            return;
        }

        const pushData = JSON.stringify({
            title: payload.title || '과외노트 알림',
            body: payload.body || '새로운 알림이 도착했습니다.',
            link: payload.link || '/'
        });

        // 2. 각 기기(구독)로 푸시 발송
        const promises = subscriptions.map(async (sub) => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            };

            try {
                await webpush.sendNotification(pushSubscription, pushData);
            } catch (err) {
                // 410 Gone 또는 404 Not Found인 경우 만료된 구독이므로 DB에서 정리
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await supabaseAdminFetch(`/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, {
                        method: 'DELETE'
                    }).catch(() => {});
                } else {
                    console.warn(`푸시 발송 실패 (${sub.endpoint.slice(0, 30)}...):`, err.message);
                }
            }
        });

        await Promise.allSettled(promises);
    } catch (err) {
        console.error('sendWebPush 실행 에러:', err);
    }
}
