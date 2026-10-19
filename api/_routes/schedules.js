// api/_routes/schedules.js
// 수업 캘린더 (일정 등록, 조회, 수정, 삭제) API 및 학생 알림 발송
import { authenticate, supabaseAdminFetch } from './_auth.js';
import { sendWebPush } from './_pushSender.js';

export default async function handler(req, res) {
    try {
        const auth = await authenticate(req);

        // 1. 수업 일정 목록 조회 (GET)
        if (req.method === 'GET') {
            const { subject_id, start_date, end_date } = req.query;

            let query = '/rest/v1/schedules?select=*,subjects:subject_id(name,color),profiles:student_id(id,name)&order=start_time.asc';

            if (auth.isTeacher) {
                // 선생님: 본인이 개설한 과목의 일정만
                query += `&teacher_id=eq.${auth.userId}`;
            } else {
                // 학생: 자신이 수강 중인 과목의 enrollment 확인
                const enrollments = await supabaseAdminFetch(`/rest/v1/enrollments?student_id=eq.${auth.userId}&select=subject_id`);
                const subjectIds = enrollments.map(e => e.subject_id);

                if (subjectIds.length === 0) {
                    return res.status(200).json([]);
                }

                query += `&subject_id=in.(${subjectIds.join(',')})&or=(student_id.is.null,student_id.eq.${auth.userId})`;
            }

            if (subject_id) {
                query += `&subject_id=eq.${subject_id}`;
            }
            if (start_date) {
                query += `&start_time=gte.${start_date}`;
            }
            if (end_date) {
                query += `&end_time=lte.${end_date}`;
            }

            const schedules = await supabaseAdminFetch(query);
            return res.status(200).json(schedules);
        }

        // 2. 수업 일정 등록 (POST) - 선생님 전용 + 학생 대상 알림 자동 발송
        if (req.method === 'POST') {
            if (!auth.isTeacher) {
                return res.status(403).json({ error: '선생님 계정만 수업 일정을 등록할 수 있습니다.' });
            }

            const { subject_id, student_id, title, start_time, end_time, status, notes } = req.body;
            if (!subject_id || !title || !start_time || !end_time) {
                return res.status(400).json({ error: '과목, 수업 제목, 시작 및 종료 시간은 필수 항목입니다.' });
            }

            // 본인 과목인지 검증
            const subject = await supabaseAdminFetch(`/rest/v1/subjects?id=eq.${subject_id}&teacher_id=eq.${auth.userId}&select=id,name`);
            if (!subject || subject.length === 0) {
                return res.status(403).json({ error: '해당 과목에 대한 권한이 없습니다.' });
            }

            const newSchedule = await supabaseAdminFetch('/rest/v1/schedules', {
                method: 'POST',
                headers: { 'Prefer': 'return=representation' },
                body: JSON.stringify({
                    subject_id,
                    teacher_id: auth.userId,
                    student_id: student_id || null,
                    title: title.trim(),
                    start_time,
                    end_time,
                    status: status || 'scheduled',
                    notes: notes ? notes.trim() : null
                })
            });

            // 🔔 학생에게 수업 일정 등록 알림 발송
            try {
                const notifyStudentIds = [];
                if (student_id) {
                    notifyStudentIds.push(student_id);
                } else {
                    // 과목 전체 공통 수업인 경우, 해당 과목의 모든 수강생에게 알림
                    const enrollments = await supabaseAdminFetch(`/rest/v1/enrollments?subject_id=eq.${subject_id}&select=student_id`).catch(() => []);
                    enrollments.forEach(e => {
                        if (e.student_id && !notifyStudentIds.includes(e.student_id)) {
                            notifyStudentIds.push(e.student_id);
                        }
                    });
                }

                const subjectName = subject[0]?.name || '수업';
                const dateObj = new Date(start_time);
                const dateText = `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

                const notifTitle = '📅 새로운 수업 일정이 등록되었습니다!';
                const notifBody = `[${subjectName}] ${title.trim()} (${dateText})`;
                const notifLink = '#studentCalendarTab';

                for (const sId of notifyStudentIds) {
                    await supabaseAdminFetch('/rest/v1/notifications', {
                        method: 'POST',
                        headers: { 'Prefer': 'return=minimal' },
                        body: JSON.stringify({
                            user_id: sId,
                            title: notifTitle,
                            body: notifBody,
                            link: notifLink
                        })
                    }).catch(() => {});
                }

                // 🔔 학생 기기들로 백그라운드 웹 푸시 발송
                if (notifyStudentIds.length > 0) {
                    await sendWebPush(notifyStudentIds, {
                        title: notifTitle,
                        body: notifBody,
                        link: notifLink
                    }).catch(() => {});
                }
            } catch (notifyErr) {
                console.error('일정 등록 알림 발송 에러:', notifyErr);
            }

            return res.status(201).json(newSchedule[0]);
        }

        // 3. 수업 일정 수정 (PUT) - 선생님 전용
        if (req.method === 'PUT') {
            if (!auth.isTeacher) {
                return res.status(403).json({ error: '선생님 계정만 수업 일정을 수정할 수 있습니다.' });
            }

            const { id, title, start_time, end_time, status, notes, student_id, subject_id } = req.body;
            if (!id) return res.status(400).json({ error: '일정 ID가 필요합니다.' });

            // 본인 일정인지 검증
            const existing = await supabaseAdminFetch(`/rest/v1/schedules?id=eq.${id}&teacher_id=eq.${auth.userId}&select=id,student_id,subject_id`);
            if (!existing || existing.length === 0) {
                return res.status(403).json({ error: '해당 수업 일정에 대한 수정 권한이 없습니다.' });
            }

            const updatePayload = {};
            if (title) updatePayload.title = title.trim();
            if (start_time) updatePayload.start_time = start_time;
            if (end_time) updatePayload.end_time = end_time;
            if (status) updatePayload.status = status;
            if (notes !== undefined) updatePayload.notes = notes;
            if (student_id !== undefined) updatePayload.student_id = student_id || null;
            if (subject_id) updatePayload.subject_id = subject_id;

            const updated = await supabaseAdminFetch(`/rest/v1/schedules?id=eq.${id}`, {
                method: 'PATCH',
                headers: { 'Prefer': 'return=representation' },
                body: JSON.stringify(updatePayload)
            });

            return res.status(200).json(updated[0]);
        }

        // 4. 수업 일정 삭제 (DELETE) - 선생님 전용
        if (req.method === 'DELETE') {
            if (!auth.isTeacher) {
                return res.status(403).json({ error: '선생님 계정만 수업 일정을 삭제할 수 있습니다.' });
            }

            const { id } = req.query;
            if (!id) return res.status(400).json({ error: '일정 ID가 필요합니다.' });

            // 본인 일정인지 검증
            const existing = await supabaseAdminFetch(`/rest/v1/schedules?id=eq.${id}&teacher_id=eq.${auth.userId}&select=id`);
            if (!existing || existing.length === 0) {
                return res.status(403).json({ error: '해당 수업 일정에 대한 삭제 권한이 없습니다.' });
            }

            await supabaseAdminFetch(`/rest/v1/schedules?id=eq.${id}`, {
                method: 'DELETE'
            });

            return res.status(200).json({ message: '수업 일정이 삭제되었습니다.' });
        }

        return res.status(405).json({ error: '지원하지 않는 HTTP 메서드입니다.' });
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message || '서버 오류가 발생했습니다.' });
    }
}
