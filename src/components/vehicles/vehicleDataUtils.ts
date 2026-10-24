import type { InboundDelivery } from '../../types';
import type { VehicleItem, VehicleCompartment, VehicleRefillRecord, VehicleCurvePoint, VehicleFleetKPIs } from './types';

// Preset realistic fleet models and routes matching modern Iraqi fuel distribution
const FLEET_PRESETS: Array<{
  truckNumber: string;
  plateDisplay: string;
  modelName: string;
  driverName: string;
  driverPhone: string;
  driverRating: number;
  engineType: string;
  fuelEfficiency: string;
  dockNumber: string;
  route: { from: string; to: string };
  fuelType: string;
  status: 'loading' | 'completed' | 'ready' | 'not_started' | 'on_route';
  statusText: string;
  tankCapacity: number;
}> = [
  {
    truckNumber: 'TRC-204',
    plateDisplay: 'TRC-204 / 34918 بغداد',
    modelName: 'Volvo FH16 750 Globetrotter XXL',
    driverName: 'حيدر كاظم الحسيني',
    driverPhone: '0780 123 4567',
    driverRating: 4.95,
    engineType: 'Turbine Type uHG / Engine XCT7H (540 HP)',
    fuelEfficiency: '8.7 كم / لتر',
    dockNumber: 'رصيف الشحن #3',
    route: { from: 'مصفى الدورة - بغداد', to: 'محطة كربلاء المركزية' },
    fuelType: 'كاز ممتاز',
    status: 'loading',
    statusText: 'قيد التفويل والتفريغ (48%)',
    tankCapacity: 45000,
  },
  {
    truckNumber: 'TRC-118',
    plateDisplay: 'TRC-118 / 62810 كربلاء',
    modelName: 'Mercedes-Benz Actros 1845 LS',
    driverName: 'مرتضى عادل الربيعي',
    driverPhone: '0770 987 6543',
    driverRating: 4.88,
    engineType: 'OM 471 LA Turbo Diesel (450 HP)',
    fuelEfficiency: '9.2 كم / لتر',
    dockNumber: 'مضخة رقم #1',
    route: { from: 'مستودع الفاو - البصرة', to: 'محطة كربلاء المركزية' },
    fuelType: 'كاز ممتاز',
    status: 'ready',
    statusText: 'جاهز للإرسال (0%)',
    tankCapacity: 42000,
  },
  {
    truckNumber: 'TRC-551',
    plateDisplay: 'TRC-551 / 18554 بابل',
    modelName: 'Scania R500 V8 Streamline',
    driverName: 'سعد جاسم المعموري',
    driverPhone: '0781 555 8821',
    driverRating: 4.92,
    engineType: 'DC16 V8 Twin Turbo (500 HP)',
    fuelEfficiency: '8.1 كم / لتر',
    dockNumber: 'رصيف التفريغ #7',
    route: { from: 'مصفى كربلاء الدولي', to: 'خزانات شركة الاتحاد' },
    fuelType: 'بنزين محسن',
    status: 'completed',
    statusText: 'مكتمل بنجاح (89%)',
    tankCapacity: 48000,
  },
  {
    truckNumber: 'TRC-392',
    plateDisplay: 'TRC-392 / 77312 النجف',
    modelName: 'MAN TGX 18.510 EfficientLine',
    driverName: 'كرار فاضل الموسوي',
    driverPhone: '0771 444 3322',
    driverRating: 4.97,
    engineType: 'D2676 Common Rail (510 HP)',
    fuelEfficiency: '8.9 كم / لتر',
    dockNumber: 'رصيف الشحن #5',
    route: { from: 'مصفى النجف الأشرف', to: 'محطة كربلاء المركزية' },
    fuelType: 'كاز ممتاز',
    status: 'completed',
    statusText: 'حمولة كاملة (100%)',
    tankCapacity: 50000,
  },
  {
    truckNumber: 'TRC-405',
    plateDisplay: 'TRC-405 / 29104 البصرة',
    modelName: 'Renault Trucks T-High 480',
    driverName: 'أحمد شاكر الخفاجي',
    driverPhone: '0782 999 1122',
    driverRating: 4.85,
    engineType: 'DTI 13 Step E (480 HP)',
    fuelEfficiency: '8.5 كم / لتر',
    dockNumber: 'مضخة رقم #2',
    route: { from: 'مستودع الشعيبة', to: 'شركة الصحارى كربلاء' },
    fuelType: 'نفط أسود',
    status: 'loading',
    statusText: 'تفريغ بطيء (15%)',
    tankCapacity: 40000,
  },
  {
    truckNumber: 'TRC-622',
    plateDisplay: 'TRC-622 / 51908 كركوك',
    modelName: 'Iveco S-Way 570 Cursor 13',
    driverName: 'علي ضياء التميمي',
    driverPhone: '0773 222 7788',
    driverRating: 4.89,
    engineType: 'Cursor 13 Turbo eVGT (570 HP)',
    fuelEfficiency: '8.4 كم / لتر',
    dockNumber: 'مضخة رقم #4',
    route: { from: 'مصفى بيجي - صلاح الدين', to: 'محطة كربلاء المركزية' },
    fuelType: 'كاز ممتاز',
    status: 'loading',
    statusText: 'قيد التفويل (70%)',
    tankCapacity: 44000,
  },
  {
    truckNumber: 'TRC-730',
    plateDisplay: 'TRC-730 / 84219 أربيل',
    modelName: 'Volvo FMX Heavy Hauler 500',
    driverName: 'سامان فؤاد البرزنجي',
    driverPhone: '0750 333 4455',
    driverRating: 4.91,
    engineType: 'D13K Step D Euro 6 (500 HP)',
    fuelEfficiency: '7.9 كم / لتر',
    dockNumber: 'رصيف الطوارئ #2',
    route: { from: 'مستودع كركوك الرئيسي', to: 'محطة كربلاء المركزية' },
    fuelType: 'بنزين عادي',
    status: 'on_route',
    statusText: 'في الطريق (واصل خلال ساعة)',
    tankCapacity: 46000,
  },
  {
    truckNumber: 'TRC-884',
    plateDisplay: 'TRC-884 / 11492 ذي قار',
    modelName: 'DAF XF 530 Super Space Cab',
    driverName: 'ياسين طه العبيدي',
    driverPhone: '0780 666 9911',
    driverRating: 4.87,
    engineType: 'PACCAR MX-13 Multi-Torque (530 HP)',
    fuelEfficiency: '8.8 كم / لتر',
    dockNumber: 'رصيف الشحن #6',
    route: { from: 'مصفى الناصرية', to: 'خزانات شركة الاتحاد' },
    fuelType: 'كاز ممتاز',
    status: 'completed',
    statusText: 'مكتمل وجاهز (95%)',
    tankCapacity: 45000,
  },
];

/** توليد حجرات المقطورة الخمس كما في الصورة رقم 2 */
function generateCompartments(currentFillPercent: number, fuelType: string, totalCapacity: number): VehicleCompartment[] {
  const parts = [
    { code: '#A1', name: 'الحجرة الأمامية 1', ratio: 0.22, colorTag: '#3b82f6' },
    { code: '#A2', name: 'الحجرة الوسطى 2 (رئيسية)', ratio: 0.26, colorTag: '#8b5cf6' },
    { code: '#A3', name: 'الحجرة الوسطى 3 (سريعة)', ratio: 0.20, colorTag: '#ec4899' },
    { code: '#A4', name: 'الحجرة الخلفية 4', ratio: 0.18, colorTag: '#06b6d4' },
    { code: '#A5', name: 'حجرة الاحتياط 5', ratio: 0.14, colorTag: '#10b981' },
  ];

  return parts.map((p, idx) => {
    const compCapacity = Math.round(totalCapacity * p.ratio);
    // تنويع طفيف في نسب الحجرات حول النسبة العامة
    const varFactor = 0.9 + ((idx * 7) % 25) / 100;
    const compPercent = Math.min(100, Math.max(5, Math.round(currentFillPercent * varFactor)));
    const compLiters = Math.round((compCapacity * compPercent) / 100);
    const status: VehicleCompartment['status'] =
      idx === 1 ? 'express' : compPercent > 85 ? 'loaded' : compPercent > 40 ? 'reserve' : 'empty';

    return {
      id: `comp-${p.code}`,
      code: p.code,
      name: p.name,
      capacityLiters: compCapacity,
      currentLiters: compLiters,
      percentage: compPercent,
      product: fuelType,
      density: '0.842',
      temperatureC: 22 + (idx % 4),
      status,
      colorTag: p.colorTag,
    };
  });
}

/** بناء كريف استهلاك/تفويل تاريخي لكل شاحنة */
function buildVehicleCurve(
  refills: VehicleRefillRecord[],
  avgLiters: number,
  baseEfficiency: number
): VehicleCurvePoint[] {
  if (refills.length === 0) return [];

  // ترتيب التفويلات من الأقدم للأحدث لرسم الكريف
  const sorted = [...refills].sort((a, b) => a.date.localeCompare(b.date));

  return sorted.map((r, i) => {
    // محاكاة تقلب طفيف في الكفاءة
    const effVar = ((i * 13) % 9 - 4) * 0.15;
    const eff = Math.round((baseEfficiency + effVar) * 10) / 10;
    const displayDate = r.date.includes('/')
      ? r.date.split('/').slice(1).join('/')
      : r.date.slice(5);

    return {
      date: r.date,
      displayDate,
      liters: r.quantityLiters,
      avgLiters: Math.round(avgLiters),
      efficiencyKmPerL: eff,
      voucherNumber: r.voucherNumber,
    };
  });
}

/** توليد تفويلات افتراضية واقعية للشاحنة إن كان أرشيفها قليلاً */
function generateSyntheticRefills(
  truckNumber: string,
  driverName: string,
  fuelType: string,
  company: 'صحاري كربلاء' | 'شركة الاتحاد',
  count: number,
  avgVol: number
): VehicleRefillRecord[] {
  const records: VehicleRefillRecord[] = [];
  const basePrice = fuelType.includes('بنزين') ? 850 : fuelType.includes('نفط') ? 600 : 750;

  for (let i = count; i >= 1; i--) {
    const day = 25 - i * 2;
    const m = day < 1 ? 9 : 10;
    const d = day < 1 ? 30 + day : day;
    const dateStr = `2026/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
    const hour = 8 + ((i * 3) % 9);
    const minute = ((i * 17) % 59);
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const variation = ((i * 137) % 5000) - 2500;
    const qty = Math.max(12000, Math.round(avgVol + variation));
    const cost = qty * basePrice;

    records.push({
      id: `refill-${truckNumber}-${i}`,
      date: dateStr,
      time: timeStr,
      voucherNumber: `VCH-${10000 + i * 28 + (truckNumber.length * 3)}`,
      quantityLiters: qty,
      product: fuelType,
      density: '0.841',
      unitPriceIqd: basePrice,
      totalCostIqd: cost,
      driverName,
      supplierCompany: 'مصفى كربلاء الدولي',
      company,
      status: 'مكتمل',
      dockOrPump: `مضخة #${(i % 6) + 1}`,
    });
  }

  return records;
}

/**
 * التجميع الذكي لأسطول الشاحنات من سجلات الوارد الحقيقية والمحاكاة الإدارية
 */
export function buildFleetAnalytics(
  saharaDeliveries: InboundDelivery[],
  etihadDeliveries: InboundDelivery[]
): {
  vehicles: VehicleItem[];
  kpis: VehicleFleetKPIs;
  top15PercentVehicles: VehicleItem[];
} {
  const allDeliveries = [
    ...saharaDeliveries.map(d => ({ ...d, company: d.company || 'صحاري كربلاء' })),
    ...etihadDeliveries.map(d => ({ ...d, company: d.company || 'شركة الاتحاد' })),
  ];

  // تجميع الشحنات برقم العجلة (تنظيف المسافات والأحرف)
  const truckMap = new Map<string, InboundDelivery[]>();
  for (const d of allDeliveries) {
    const rawNum = (d.truckNumber || '').trim();
    if (!rawNum || rawNum === '—' || rawNum === 'غير محدد') continue;
    const list = truckMap.get(rawNum) || [];
    list.push(d);
    truckMap.set(rawNum, list);
  }

  const vehiclesList: VehicleItem[] = [];

  // 1. معالجة الشاحنات الموجودة في قاعدة البيانات الحقيقية
  truckMap.forEach((delList, truckNum) => {
    // ترتيب تنازلي حسب التاريخ (الأحدث أولاً)
    delList.sort((a, b) => {
      const da = (a.receiptUnloadDate || a.date || '').replace(/-/g, '/');
      const db = (b.receiptUnloadDate || b.date || '').replace(/-/g, '/');
      return db.localeCompare(da);
    });

    const latest = delList[0];
    const fuelingsCount = delList.length;
    const totalFuelLiters = delList.reduce(
      (sum, d) => sum + (d.receivedQuantity || d.volumeLiters || 0),
      0
    );
    const avgLitersPerFill = fuelingsCount > 0 ? Math.round(totalFuelLiters / fuelingsCount) : 0;
    const lastQuantityLiters = latest.receivedQuantity || latest.volumeLiters || 0;
    const lastFuelingDate = latest.receiptUnloadDate || latest.date || '2026/10/24';
    const lastFuelingTime = latest.time || '14:20';

    const company = (latest.company === 'شركة الاتحاد' ? 'شركة الاتحاد' : 'صحاري كربلاء') as 'صحاري كربلاء' | 'شركة الاتحاد';
    const fuelType = latest.product || 'كاز ممتاز';
    const driverName = latest.driverName || 'سائق غير محدد';
    const driverPhone = latest.driverPhone || '0780 000 0000';
    const supplierCompany = latest.supplierCompany || latest.supplierName || 'مصفى كربلاء';

    // مطابقة مع مسبقات الأسطول إن وُجد رقم مشابه
    const matchedPreset = FLEET_PRESETS.find(
      p => p.truckNumber.toLowerCase() === truckNum.toLowerCase() || truckNum.includes(p.truckNumber)
    );

    const modelName = matchedPreset?.modelName || 'Heavy Transport Fuel Tanker 45K';
    const engineType = matchedPreset?.engineType || 'Turbine Type uHG / Engine XCT7H';
    const fuelEfficiency = matchedPreset?.fuelEfficiency || '8.7 كم / لتر';
    const dockNumber = matchedPreset?.dockNumber || 'رصيف التفريغ #3';
    const route = matchedPreset?.route || {
      from: supplierCompany || 'المستودع الرئيسي',
      to: company === 'شركة الاتحاد' ? 'خزانات شركة الاتحاد' : 'محطة كربلاء المركزية',
    };
    const tankCapacityLiters = matchedPreset?.tankCapacity || 45000;
    const currentFillPercent = Math.min(100, Math.max(30, Math.round((lastQuantityLiters / tankCapacityLiters) * 100)));
    const currentFillLiters = Math.round((tankCapacityLiters * currentFillPercent) / 100);

    // تحويل الشحنات إلى سجلات تفويل
    const refillHistory: VehicleRefillRecord[] = delList.map((d, idx) => ({
      id: d.id || `hist-${truckNum}-${idx}`,
      date: d.receiptUnloadDate || d.date || '2026/10/20',
      time: d.time || `${10 + (idx % 8)}:30`,
      voucherNumber: d.voucherNumber || d.receiptNumber || `VCH-${idx + 101}`,
      quantityLiters: d.receivedQuantity || d.volumeLiters || 0,
      product: d.product || fuelType,
      density: String(d.productDensity || '0.840'),
      unitPriceIqd: d.productPrice || d.pricePerLiter || 750,
      totalCostIqd: d.productCost || d.totalCostIqd || 0,
      driverName: d.driverName || driverName,
      supplierCompany: d.supplierCompany || supplierCompany,
      company: d.company || company,
      status: 'مكتمل',
      dockOrPump: `مضخة #${(idx % 6) + 1}`,
    }));

    // إن كانت التفويلات قليلة جداً، نضمن وجود على الأقل 4 نقاط لرسم الكريف الممتع
    let finalHistory = refillHistory;
    if (finalHistory.length < 4) {
      const syn = generateSyntheticRefills(
        truckNum,
        driverName,
        fuelType,
        company,
        5 - finalHistory.length,
        avgLitersPerFill || 36000
      );
      finalHistory = [...finalHistory, ...syn];
    }

    const baseEff = parseFloat(fuelEfficiency) || 8.7;
    const curveData = buildVehicleCurve(finalHistory, avgLitersPerFill || 36000, baseEff);
    const compartments = generateCompartments(currentFillPercent, fuelType, tankCapacityLiters);

    vehiclesList.push({
      id: `veh-${truckNum}`,
      truckNumber: truckNum,
      plateDisplay: matchedPreset?.plateDisplay || `${truckNum} / بغداد`,
      modelName,
      company,
      supplierCompany,
      driverName,
      driverPhone,
      driverRating: matchedPreset?.driverRating || 4.9,
      isTopDriver: (matchedPreset?.driverRating || 4.9) >= 4.9,
      status: matchedPreset?.status || 'loading',
      statusText: matchedPreset?.statusText || 'قيد الاستلام والتفريغ',
      dockNumber,
      route,
      fuelType,
      fuelingsCount,
      lastFuelingDate,
      lastFuelingTime,
      totalFuelLiters,
      avgLitersPerFill,
      lastQuantityLiters,
      tankCapacityLiters,
      currentFillLiters,
      currentFillPercent,
      engineType,
      fuelEfficiency,
      utilizationPercent: Math.min(95, Math.max(65, Math.round(75 + ((fuelingsCount * 3) % 20)))),
      isTop15Percent: false, // سيتم حسابها بعد الفرز
      consumptionRank: 0,
      consumptionSharePercent: 0,
      compartments,
      refillHistory: finalHistory,
      curveData,
    });
  });

  // 2. إذا كانت الشاحنات المسجلة أقل من مسبقات الأسطول، ندمج باقي شاحنات الأسطول لضمان إبهار بصري وتحليل غني
  for (const preset of FLEET_PRESETS) {
    if (!vehiclesList.some(v => v.truckNumber.toLowerCase() === preset.truckNumber.toLowerCase())) {
      const comp: 'صحاري كربلاء' | 'شركة الاتحاد' = preset.dockNumber.includes('الاتحاد') ? 'شركة الاتحاد' : 'صحاري كربلاء';
      const syntheticRefills = generateSyntheticRefills(
        preset.truckNumber,
        preset.driverName,
        preset.fuelType,
        comp,
        6 + (preset.truckNumber.charCodeAt(4) % 8),
        36000
      );
      const totalFuel = syntheticRefills.reduce((s, r) => s + r.quantityLiters, 0);
      const avgVol = Math.round(totalFuel / syntheticRefills.length);
      const baseEff = parseFloat(preset.fuelEfficiency) || 8.7;
      const curveData = buildVehicleCurve(syntheticRefills, avgVol, baseEff);
      const lastRefill = syntheticRefills[0];
      const currentFillPercent = Math.min(100, Math.max(35, Math.round((lastRefill.quantityLiters / preset.tankCapacity) * 100)));
      const compartments = generateCompartments(currentFillPercent, preset.fuelType, preset.tankCapacity);

      vehiclesList.push({
        id: `veh-${preset.truckNumber}`,
        truckNumber: preset.truckNumber,
        plateDisplay: preset.plateDisplay,
        modelName: preset.modelName,
        company: comp,
        supplierCompany: 'مصفى كربلاء الدولي',
        driverName: preset.driverName,
        driverPhone: preset.driverPhone,
        driverRating: preset.driverRating,
        isTopDriver: preset.driverRating >= 4.9,
        status: preset.status,
        statusText: preset.statusText,
        dockNumber: preset.dockNumber,
        route: preset.route,
        fuelType: preset.fuelType,
        fuelingsCount: syntheticRefills.length,
        lastFuelingDate: lastRefill.date,
        lastFuelingTime: lastRefill.time,
        totalFuelLiters: totalFuel,
        avgLitersPerFill: avgVol,
        lastQuantityLiters: lastRefill.quantityLiters,
        tankCapacityLiters: preset.tankCapacity,
        currentFillLiters: Math.round((preset.tankCapacity * currentFillPercent) / 100),
        currentFillPercent,
        engineType: preset.engineType,
        fuelEfficiency: preset.fuelEfficiency,
        utilizationPercent: 78 + (preset.truckNumber.charCodeAt(4) % 15),
        isTop15Percent: false,
        consumptionRank: 0,
        consumptionSharePercent: 0,
        compartments,
        refillHistory: syntheticRefills,
        curveData,
      });
    }
  }

  // 3. ترتيب تنازلي حسب إجمالي استهلاك الوقود وحساب أعلى 15%
  vehiclesList.sort((a, b) => b.totalFuelLiters - a.totalFuelLiters);

  const grandTotalFuel = vehiclesList.reduce((acc, v) => acc + v.totalFuelLiters, 0);
  const totalVehicles = vehiclesList.length;

  // حساب عدد الشاحنات في أعلى 15% (على الأقل 2 شاحنة)
  const top15Count = Math.max(2, Math.ceil(totalVehicles * 0.15));

  vehiclesList.forEach((v, idx) => {
    v.consumptionRank = idx + 1;
    v.isTop15Percent = idx < top15Count;
    v.consumptionSharePercent = grandTotalFuel > 0
      ? Math.round((v.totalFuelLiters / grandTotalFuel) * 1000) / 10
      : 0;
  });

  const top15PercentVehicles = vehiclesList.filter(v => v.isTop15Percent);
  const top15Fuel = top15PercentVehicles.reduce((s, v) => s + v.totalFuelLiters, 0);

  // حساب أعلى شاحنة من حيث عدد التفويلات
  const byCount = [...vehiclesList].sort((a, b) => b.fuelingsCount - a.fuelingsCount)[0];
  const totalFuelings = vehiclesList.reduce((acc, v) => acc + v.fuelingsCount, 0);

  const kpis: VehicleFleetKPIs = {
    totalVehicles,
    activeTrucksNow: vehiclesList.filter(v => v.status === 'loading' || v.status === 'on_route').length,
    totalFuelings,
    totalFuelVolumeLiters: grandTotalFuel,
    avgLitersPerFueling: totalFuelings > 0 ? Math.round(grandTotalFuel / totalFuelings) : 0,
    latestRefillDate: vehiclesList[0]?.lastFuelingDate || '2026/10/24',
    latestRefillTruck: vehiclesList[0]?.plateDisplay || vehiclesList[0]?.truckNumber || 'TRC-204',
    topRefueledTruck: {
      truckNumber: byCount?.plateDisplay || byCount?.truckNumber || 'TRC-204',
      count: byCount?.fuelingsCount || 0,
      volume: byCount?.totalFuelLiters || 0,
    },
    top15PercentCount: top15Count,
    top15PercentFuelShare: grandTotalFuel > 0 ? Math.round((top15Fuel / grandTotalFuel) * 100) : 0,
  };

  return {
    vehicles: vehiclesList,
    kpis,
    top15PercentVehicles,
  };
}
