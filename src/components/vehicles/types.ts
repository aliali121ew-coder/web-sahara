export interface VehicleCompartment {
  id: string;
  code: string; // e.g. '#A1', '#A2'
  name: string; // e.g. 'حجرة الديزل الأمامية'
  capacityLiters: number;
  currentLiters: number;
  percentage: number;
  product: string;
  density: string;
  temperatureC: number;
  status: 'loaded' | 'express' | 'reserve' | 'empty';
  colorTag?: string;
}

export interface VehicleRefillRecord {
  id: string;
  date: string;
  time: string;
  voucherNumber: string;
  quantityLiters: number;
  product: string;
  density: string;
  unitPriceIqd: number;
  totalCostIqd: number;
  driverName: string;
  supplierCompany: string;
  company: string;
  status: 'مكتمل' | 'قيد التفريغ' | 'في الفحص' | 'ملغي';
  dockOrPump: string;
}

export interface VehicleCurvePoint {
  date: string;
  displayDate: string;
  liters: number;
  avgLiters: number;
  efficiencyKmPerL: number;
  voucherNumber: string;
}

export interface VehicleItem {
  id: string;
  truckNumber: string; // رقم العجلة / اللوحة
  plateDisplay: string; // مثلاً: 'TRC-204' أو '11547 / بغداد'
  modelName: string; // مثلاً: 'Volvo FH16 750' أو 'Mercedes Actros'
  company: 'صحاري كربلاء' | 'شركة الاتحاد' | 'مشترك';
  supplierCompany: string;
  driverName: string;
  driverPhone: string;
  driverAvatar?: string;
  driverRating: number; // 4.9
  isTopDriver: boolean;
  status: 'loading' | 'completed' | 'ready' | 'not_started' | 'on_route';
  statusText: string;
  dockNumber: string; // e.g. 'مضخة #3' أو 'رصيف #1'
  route: {
    from: string;
    to: string;
  };
  fuelType: string;
  // Metrics
  fuelingsCount: number; // كم تفويلة
  lastFuelingDate: string; // متى آخر تفويلة
  lastFuelingTime: string;
  totalFuelLiters: number; // إجمالي الوقود المستلم
  avgLitersPerFill: number;
  lastQuantityLiters: number;
  // Capacity & specs
  tankCapacityLiters: number;
  currentFillLiters: number;
  currentFillPercent: number;
  engineType: string; // e.g. 'Turbine Type uHG / Engine XCT7H'
  fuelEfficiency: string; // e.g. '8.7 km/L'
  utilizationPercent: number; // e.g. 78%
  // 15% Top consumption classification
  isTop15Percent: boolean;
  consumptionRank: number;
  consumptionSharePercent: number; // e.g. 14.5%
  // Detailed data
  compartments: VehicleCompartment[];
  refillHistory: VehicleRefillRecord[];
  curveData: VehicleCurvePoint[];
}

export interface VehicleFleetKPIs {
  totalVehicles: number;
  activeTrucksNow: number;
  totalFuelings: number;
  totalFuelVolumeLiters: number;
  avgLitersPerFueling: number;
  latestRefillDate: string;
  latestRefillTruck: string;
  topRefueledTruck: {
    truckNumber: string;
    count: number;
    volume: number;
  };
  top15PercentCount: number;
  top15PercentFuelShare: number;
}
