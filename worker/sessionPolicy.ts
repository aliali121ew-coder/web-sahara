/**
 * الجلسة تنتهي بعد 7 أيام من آخر دخول مهما كان الجهاز نشطًا، فيعود المستخدم لشاشة الدخول.
 * الاستخدام لا يمدّدها، وتُلغى قبل ذلك بتسجيل الخروج أو تغيير كلمة المرور أو إيقاف الحساب
 */
export const SESSION_MAX_MS = 7 * 24 * 3600_000;
/** هل مضت مدة الجلسة منذ آخر دخول؟ */
export const sessionExpired = (createdAt: number, now: number) => now - createdAt > SESSION_MAX_MS;
