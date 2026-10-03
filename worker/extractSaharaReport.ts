import Anthropic from '@anthropic-ai/sdk';

/**
 * قراءة صورة الكشف اليومي لشركة الصحاري عبر Claude واستخراج أرقامها كـ JSON:
 * الاستهلاك (آليات / مزارع / مولدات)، المرسل للمزارع (= المبيعات)، الوارد (داخلي / الاتحاد / خارجي حكومي)،
 * والرصيد التراكمي لكل محطة مع مطابقتها لأسماء محطات النظام.
 */

export interface SaharaReportExtraction {
  generators: number;
  vehicles: number;
  farms: number;
  sentToFarms: number;
  inboundInternal: number;
  inboundEtihad: number;
  inboundExternal: number;
  stations: { nameInImage: string; matchedStation: string | null; balance: number }[];
  notes: string;
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['generators', 'vehicles', 'farms', 'sentToFarms', 'inboundInternal', 'inboundEtihad', 'inboundExternal', 'stations', 'notes'],
  properties: {
    generators: { type: 'number', description: 'المصروف اليومي للمولدات' },
    vehicles: { type: 'number', description: 'المصروف اليومي للآليات' },
    farms: { type: 'number', description: 'المصروف اليومي للمزارع' },
    sentToFarms: { type: 'number', description: 'الرصيد المرسل إلى المزارع' },
    inboundInternal: { type: 'number', description: 'الوارد الداخلي' },
    inboundEtihad: { type: 'number', description: 'وارد من الاتحاد' },
    inboundExternal: { type: 'number', description: 'الوارد الخارجي' },
    stations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['nameInImage', 'matchedStation', 'balance'],
        properties: {
          nameInImage: { type: 'string' },
          matchedStation: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          balance: { type: 'number', description: 'الرصيد التراكمي' }
        }
      }
    },
    notes: { type: 'string', description: 'ملاحظة قصيرة بالعربية عن أي رقم غير واضح، أو نص فارغ' }
  }
} as const;

const buildPrompt = (stationNames: string[]) => `هذه صورة كشف يومي لرصيد وقود (كاز) شركة الصحاري. استخرج الأرقام كما هي مكتوبة في الصورة بالضبط.

الحقول المطلوبة:
- generators: "المصروف اليومي للمولدات"
- vehicles: "المصروف اليومي للآليات"
- farms: "المصروف اليومي للمزارع"
- sentToFarms: "الرصيد المرسل الى المزارع"
- inboundInternal: "الوارد الداخلي"
- inboundEtihad: "وارد من الاتحاد"
- inboundExternal: "الوارد الخارجي"
- stations: من جدول "تفاصيل الكميات في الموقع"، لكل صف: اسم الموقع كما في الصورة (nameInImage) وقيمة عمود "الرصيد التراكمي" (balance).

لكل محطة، ضع في matchedStation الاسم المطابق من قائمة محطات النظام التالية إذا كان واضحًا أنها نفس المحطة (تجاهل كلمة "محطة" أو "معمل" والفروق الإملائية البسيطة)، وإلا ضع null:
${stationNames.map(n => `- ${n}`).join('\n')}

إذا لم يظهر حقل في الصورة ضع 0 واذكر ذلك في notes. الأرقام بدون فواصل.`;

export async function extractSaharaReport(
  apiKey: string,
  image: { data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' },
  stationNames: string[]
): Promise<SaharaReportExtraction> {
  const client = new Anthropic({ apiKey });

  const response = await client.beta.messages.create({
    model: 'claude-opus-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
          { type: 'text', text: buildPrompt(stationNames) }
        ]
      }
    ]
  });

  if (response.stop_reason === 'refusal') throw new Error('تعذّر تحليل الصورة');
  if (response.stop_reason === 'max_tokens') throw new Error('انقطع التحليل قبل اكتماله، حاول مرة أخرى');

  const text = response.content.find(b => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('لم يُرجع التحليل أي بيانات');
  return JSON.parse(text.text) as SaharaReportExtraction;
}
