import Anthropic from '@anthropic-ai/sdk';

/**
 * القراءة الذكية لأسماء كشف الوارد (PDF): نص بعض ملفات PDF يفقد حروفًا (مثل الراء الأخيرة في "الخير")،
 * أو يقلب "لا" إلى "ال"، أو يحفظ الحروف المركّبة برموز تالفة. الأرقام تُقرأ من نص الملف (مضمونة)،
 * وهنا يقرأ Claude الصفحات كما تُرى ويصحح الخانات النصية فقط لكل صف مستخرج.
 */

export interface InboundNameRow {
  supplierName: string;
  supplierCompany: string;
  driverName: string;
  truckNumber: string;
  voucherNumber: string;
  receivedQuantity: number;
}

export interface InboundNameFix {
  i: number;
  supplierName: string;
  supplierCompany: string;
  driverName: string;
  truckNumber: string;
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rows'],
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['i', 'supplierName', 'supplierCompany', 'driverName', 'truckNumber'],
        properties: {
          i: { type: 'integer', description: 'رقم الصف كما في القائمة المرسلة' },
          supplierName: { type: 'string' },
          supplierCompany: { type: 'string' },
          driverName: { type: 'string' },
          truckNumber: { type: 'string' }
        }
      }
    }
  }
} as const;

const buildPrompt = (rows: InboundNameRow[]) => `هذا ملف PDF لكشف وارد وقود. استُخرجت صفوفه من طبقة النص في الملف، والأرقام فيها صحيحة، لكن الخانات النصية العربية قد تكون تالفة:
- حرف ناقص (كثيرًا ما تسقط الراء، مثل "الخي" بدل "الخير")
- "لا" مقلوبة إلى "ال" (مثل "تفويالت" بدل "تفويلات")
- رموز غريبة ليست عربية بدل حروف
- رقم عجلة بحروف مقلوبة الترتيب

لكل صف أدناه، اعثر عليه في الملف (بالفوجر والكمية وترتيبه) واكتب الخانات الأربع كما تظهر مرئيًا في الملف بالضبط: اسم المجهز (supplierName)، الشركة المجهزة (supplierCompany)، اسم السائق (driverName)، رقم العجلة (truckNumber).
لا تخمّن ولا تغيّر اسمًا صحيحًا ولا تصحح الإملاء الأصلي للملف. الخانة الفارغة في الملف (أو "_" أو "-") تبقى نصًا فارغًا. أرجع صفًا لكل صف مرسل بنفس رقمه i.

الصفوف (i | المجهز | الشركة | السائق | العجلة | الفوجر | الكمية):
${rows.map((r, i) => [i, r.supplierName, r.supplierCompany, r.driverName, r.truckNumber, r.voucherNumber, r.receivedQuantity].join(' | ')).join('\n')}`;

export async function readInboundNames(apiKey: string, pdfBase64: string, rows: InboundNameRow[]): Promise<InboundNameFix[]> {
  const client = new Anthropic({ apiKey });
  // بث حتى لا تنقطع الطلبات الطويلة (ملف بمئات الصفوف)، ثم الرسالة كاملة
  const stream = client.beta.messages.stream({
    model: 'claude-opus-5-5',
    max_tokens: 64000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: buildPrompt(rows) }
        ]
      }
    ]
  });
  const response = await stream.finalMessage();

  if (response.stop_reason === 'refusal') throw new Error('تعذّرت قراءة الملف');
  if (response.stop_reason === 'max_tokens') throw new Error('الملف كبير جدًا للقراءة الذكية دفعة واحدة');

  const text = response.content.find(b => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('لم تُرجع القراءة أي بيانات');
  const out = JSON.parse(text.text) as { rows: InboundNameFix[] };
  return out.rows.filter(r => Number.isInteger(r.i) && r.i >= 0 && r.i < rows.length);
}
