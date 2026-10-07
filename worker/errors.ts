/** خطأ برمز ثابت (code) تترجمه الواجهة حسب اللغة؛ النص العربي يبقى للتوافق مع العملاء القدامى */
export const codedError = (message: string, code: string) => Object.assign(new Error(message), { code });

/** رمز الخطأ إن وُجد (للأخطاء المرمية من وحدات النظام والتخزين) */
export const errorCode = (e: unknown) => (e as { code?: string } | null)?.code;
