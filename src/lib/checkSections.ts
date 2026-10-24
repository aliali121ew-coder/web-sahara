/** أقسام التحقق من صحة التقارير وصلاحية عرض كل قسم (بلا اعتماديات: تُستخدم في الصلاحيات والقائمة) */
export type CheckSection = 'sahara-gas' | 'etihad-gas' | 'petrol' | 'black-oil-sahara' | 'black-oil-etihad';
export const CHECK_SECTION_PERM: Record<CheckSection, string> = {
  'sahara-gas': 'sahara.balance',
  'etihad-gas': 'etihad.balance',
  petrol: 'sahara.petrol',
  'black-oil-sahara': 'sahara.black-oil',
  'black-oil-etihad': 'etihad.black-oil',
};
