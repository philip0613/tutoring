// api/index.js
// Vercel Serverless 단일 통합 라우터 (Hobby 플랜 12개 함수 제한 완벽 해결)

import login from './_routes/login.js';
import getStudents from './_routes/getStudents.js';
import createStudent from './_routes/createStudent.js';
import getQuestions from './_routes/getQuestions.js';
import askQuestion from './_routes/askQuestion.js';
import answerQuestion from './_routes/answerQuestion.js';
import getExams from './_routes/getExams.js';
import uploadExam from './_routes/uploadExam.js';
import getFeedbacks from './_routes/getFeedbacks.js';
import sendFeedback from './_routes/sendFeedback.js';
import changePassword from './_routes/changePassword.js';
import adminAction from './_routes/adminAction.js';
import subjects from './_routes/subjects.js';
import enrollments from './_routes/enrollments.js';
import schedules from './_routes/schedules.js';
import push from './_routes/push.js';
import refreshToken from './_routes/refreshToken.js';

const routes = {
    login,
    getStudents,
    createStudent,
    getQuestions,
    askQuestion,
    answerQuestion,
    getExams,
    uploadExam,
    getFeedbacks,
    sendFeedback,
    changePassword,
    adminAction,
    subjects,
    enrollments,
    schedules,
    push,
    refreshToken
};

export default async function handler(req, res) {
    try {
        // 1. 요청 경로 추출 (/api/schedules -> schedules)
        const urlObj = new URL(req.url, 'http://localhost');
        const pathname = urlObj.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');

        // 2. 쿼리 파라미터 보존 및 주입
        if (!req.query || Object.keys(req.query).length === 0) {
            req.query = Object.fromEntries(urlObj.searchParams.entries());
        }

        // 3. 일치하는 라우트 핸들러 탐색
        const targetRoute = routes[pathname];

        if (!targetRoute) {
            return res.status(404).json({
                error: `존재하지 않는 API 엔드포인트입니다: /api/${pathname}`,
                availableRoutes: Object.keys(routes)
            });
        }

        // 4. 해당 라우트 핸들러 실행
        return await targetRoute(req, res);
    } catch (error) {
        console.error('API Gateway Router Error:', error);
        return res.status(500).json({ error: error.message || '서버 내부 오류가 발생했습니다.' });
    }
}
