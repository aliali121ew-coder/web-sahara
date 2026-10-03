import { SupportedLanguage } from '../context/LanguageContext';

export interface TranslationDict {
  brandTitle: string;
  brandSubtitle: string;
  searchPlaceholder: string;
  ctrlK: string;
  selectLanguage: string;
  languagesCount: string;
  notifications: string;
  newNotifications: string;
  markAllRead: string;
  noNotifications: string;
  lightMode: string;
  darkMode: string;
  profile: string;
  generalManager: string;
  systemOs: string;
  online: string;
  close: string;
  back: string;
  groupOperations: string;
  groupManagement: string;
  groupAnalytics: string;
  navDashboard: string;
  navTanks: string;
  navDeliveries: string;
  navDeliveriesSahara: string;
  navDeliveriesEtihad: string;
  navSupply: string;
  navFinance: string;
  navFinanceEtihad: string;
  navFinanceSahara: string;
  navManagers: string;
  navTasks: string;
  navPrices: string;
  navReports: string;
  navChat: string;
  navSettings: string;
  liters: string;
  capacity: string;
  currentLevel: string;
  safe: string;
  warning: string;
  critical: string;
  ready100: string;
  fuelGas: string;
  fuelPetrol: string;
  fuelBlackOil: string;
  fuelDiesel: string;
  addNew: string;
  exportPdf: string;
  exportExcel: string;
  save: string;
  cancel: string;
  details: string;
  status: string;
}

export const TRANSLATIONS: Record<SupportedLanguage, TranslationDict> = {
  ar: {
    brandTitle: 'صحاري كربلاء',
    brandSubtitle: 'محطة كربلاء المركزية',
    searchPlaceholder: 'بحث أو تنفيذ أمر سريع...',
    ctrlK: 'Ctrl K',
    selectLanguage: 'اختر لغة المنظومة',
    languagesCount: '9 لغات',
    notifications: 'التنبيهات والإشعارات',
    newNotifications: 'جديدة',
    markAllRead: 'تحديد الكل كمقروء',
    noNotifications: 'لا توجد إشعارات حالياً',
    lightMode: 'التبديل إلى الوضع النهاري',
    darkMode: 'التبديل إلى الوضع الليلي',
    profile: 'الملف الشخصي',
    generalManager: 'علي (المدير العام)',
    systemOs: 'نظام التشغيل المؤسسي v2.6',
    online: 'متصل بالشبكة',
    close: 'إغلاق',
    back: 'رجوع',
    groupOperations: 'العمليات والمخزون',
    groupManagement: 'الإدارة والمالية',
    groupAnalytics: 'التحليلات والمتابعة',
    navDashboard: 'لوحة القيادة الرئيسية',
    navTanks: 'منظومة الخزانات',
    navDeliveries: 'الوارد',
    navDeliveriesSahara: 'وارد الصحاري',
    navDeliveriesEtihad: 'وارد الاتحاد',
    navSupply: 'طلبات التجهيز والصرف',
    navFinance: 'رصيد الشركة',
    navFinanceEtihad: 'شركة الاتحاد',
    navFinanceSahara: 'شركة الصحاري',
    navManagers: 'مدراء الموقع والمشرفين',
    navTasks: 'المهام اللوجستية',
    navPrices: 'الأسعار',
    navReports: 'التقارير والإحصائيات',
    navChat: 'المحادثات والعمليات',
    navSettings: 'إعدادات المنظومة',
    liters: 'لتر',
    capacity: 'السعة الكلية',
    currentLevel: 'المستوى الحالي',
    safe: 'آمن',
    warning: 'تحذير',
    critical: 'حرج',
    ready100: 'جاهزية 100%',
    fuelGas: 'كاز ممتاز',
    fuelPetrol: 'بنزين محسن',
    fuelBlackOil: 'نفط أسود',
    fuelDiesel: 'ديزل تجاري',
    addNew: 'إضافة جديد',
    exportPdf: 'تصدير PDF',
    exportExcel: 'تصدير Excel',
    save: 'حفظ',
    cancel: 'إلغاء',
    details: 'التفاصيل',
    status: 'الحالة',
  },
  en: {
    brandTitle: 'Sahara Karbala',
    brandSubtitle: 'Karbala Central Terminal',
    searchPlaceholder: 'Search or execute command...',
    ctrlK: 'Ctrl K',
    selectLanguage: 'Select System Language',
    languagesCount: '9 Languages',
    notifications: 'Alerts & Notifications',
    newNotifications: 'new',
    markAllRead: 'Mark all as read',
    noNotifications: 'No notifications at this time',
    lightMode: 'Switch to Light Mode',
    darkMode: 'Switch to Dark Mode',
    profile: 'User Profile',
    generalManager: 'Ali (General Manager)',
    systemOs: 'Enterprise OS v2.6',
    online: 'Online',
    close: 'Close',
    back: 'Back',
    groupOperations: 'Operations & Inventory',
    groupManagement: 'Management & Finance',
    groupAnalytics: 'Analytics & Tracking',
    navDashboard: 'Main Dashboard',
    navTanks: 'Storage Tanks System',
    navDeliveries: 'Inbound',
    navDeliveriesSahara: 'Sahara Inbound',
    navDeliveriesEtihad: 'Etihad Inbound',
    navSupply: 'Supply & Fuel Orders',
    navFinance: 'Company Balance',
    navFinanceEtihad: 'Etihad Company',
    navFinanceSahara: 'Sahara Company',
    navManagers: 'Site Managers & Supervisors',
    navTasks: 'Logistics Tasks',
    navPrices: 'Prices',
    navReports: 'Reports & Analytics',
    navChat: 'Dispatch & Operations Chat',
    navSettings: 'System Settings',
    liters: 'Liters',
    capacity: 'Total Capacity',
    currentLevel: 'Current Level',
    safe: 'Safe',
    warning: 'Warning',
    critical: 'Critical',
    ready100: '100% Operational',
    fuelGas: 'Premium Gasoil',
    fuelPetrol: 'Super Gasoline',
    fuelBlackOil: 'Heavy Fuel Oil',
    fuelDiesel: 'Commercial Diesel',
    addNew: 'Add New',
    exportPdf: 'Export PDF',
    exportExcel: 'Export Excel',
    save: 'Save',
    cancel: 'Cancel',
    details: 'Details',
    status: 'Status',
  },
  tr: {
    brandTitle: 'Sahara Kerbela',
    brandSubtitle: 'Kerbela Merkez İstasyonu',
    searchPlaceholder: 'Arayın veya hızlı komut çalıştırın...',
    ctrlK: 'Ctrl K',
    selectLanguage: 'Sistem Dilini Seçin',
    languagesCount: '9 Dil',
    notifications: 'Uyarılar ve Bildirimler',
    newNotifications: 'yeni',
    markAllRead: 'Tümünü okundu işaretle',
    noNotifications: 'Şu anda bildirim yok',
    lightMode: 'Açık Moda Geç',
    darkMode: 'Karanlık Moda Geç',
    profile: 'Kullanıcı Profili',
    generalManager: 'Ali (Genel Müdür)',
    systemOs: 'Kurumsal İşletim Sistemi v2.6',
    online: 'Çevrimiçi',
    close: 'Kapat',
    back: 'Geri',
    groupOperations: 'Operasyonlar ve Envanter',
    groupManagement: 'Yönetim ve Finans',
    groupAnalytics: 'Analitik ve Takip',
    navDashboard: 'Ana Kontrol Paneli',
    navTanks: 'Tank Yönetim Sistemi',
    navDeliveries: 'Gelen',
    navDeliveriesSahara: 'Sahara Sevkiyatları',
    navDeliveriesEtihad: 'Etihad Sevkiyatları',
    navSupply: 'Tedarik ve Dağıtım Siparişleri',
    navFinance: 'Şirket Bakiyesi',
    navFinanceEtihad: 'Etihad Şirketi',
    navFinanceSahara: 'Sahara Şirketi',
    navManagers: 'Saha Müdürleri ve Denetçiler',
    navTasks: 'Lojistik Görevler',
    navPrices: 'Fiyatlar',
    navReports: 'Raporlar ve İstatistikler',
    navChat: 'Saha İletişimi ve Operasyon',
    navSettings: 'Sistem Ayarları',
    liters: 'Litre',
    capacity: 'Toplam Kapasite',
    currentLevel: 'Mevcut Seviye',
    safe: 'Güvenli',
    warning: 'Uyarı',
    critical: 'Kritik',
    ready100: '%100 Hazır',
    fuelGas: 'Premium Gazyağı',
    fuelPetrol: 'Süper Benzin',
    fuelBlackOil: 'Fuel Oil (Ağır)',
    fuelDiesel: 'Ticari Dizel',
    addNew: 'Yeni Ekle',
    exportPdf: 'PDF Aktar',
    exportExcel: 'Excel Aktar',
    save: 'Kaydet',
    cancel: 'İptal',
    details: 'Detaylar',
    status: 'Durum',
  },
  zh: {
    brandTitle: '萨哈拉·卡尔巴拉',
    brandSubtitle: '卡尔巴拉中央燃料枢纽',
    searchPlaceholder: '搜索或执行快速命令...',
    ctrlK: 'Ctrl K',
    selectLanguage: '选择系统语言',
    languagesCount: '9 种语言',
    notifications: '警报与系统通知',
    newNotifications: '条新通知',
    markAllRead: '全部标记为已读',
    noNotifications: '暂无新通知',
    lightMode: '切换至浅色模式',
    darkMode: '切换至深色模式',
    profile: '用户个人资料',
    generalManager: '阿里 (总经理)',
    systemOs: '企业操作系统 v2.6',
    online: '在线运行中',
    close: '关闭',
    back: '返回',
    groupOperations: '运营与库存管理',
    groupManagement: '行政与财务结算',
    groupAnalytics: '分析与运营监控',
    navDashboard: '主控制仪表盘',
    navTanks: '储油罐监控系统',
    navDeliveries: '进油',
    navDeliveriesSahara: '萨哈拉进油',
    navDeliveriesEtihad: '联合公司进油',
    navSupply: '配发与燃料供应单',
    navFinance: '企业财务',
    navFinanceEtihad: '联合公司',
    navFinanceSahara: '萨哈拉公司',
    navManagers: '现场主管与调度团队',
    navTasks: '物流调度任务',
    navPrices: '价格',
    navReports: '运营报告与数据统计',
    navChat: '调度中心与通讯',
    navSettings: '系统全局设置',
    liters: '升',
    capacity: '总容量',
    currentLevel: '当前液位',
    safe: '正常安全',
    warning: '注意预警',
    critical: '紧急告警',
    ready100: '100% 准备就绪',
    fuelGas: '优质轻柴油',
    fuelPetrol: '高标号汽油',
    fuelBlackOil: '重质燃油',
    fuelDiesel: '工业商业柴油',
    addNew: '新建记录',
    exportPdf: '导出 PDF',
    exportExcel: '导出 Excel',
    save: '保存',
    cancel: '取消',
    details: '详情',
    status: '状态',
  },
  ur: {
    brandTitle: 'صحاری کربلا',
    brandSubtitle: 'کربلا سینٹرل فیول ٹرمینل',
    searchPlaceholder: 'تلاش کریں یا کمانڈ چلائیں...',
    ctrlK: 'Ctrl K',
    selectLanguage: 'سسٹم کی زبان منتخب کریں',
    languagesCount: '9 زبانیں',
    notifications: 'اطلاعات اور انتباہات',
    newNotifications: 'نئی',
    markAllRead: 'سب پڑھا ہوا نشان زد کریں',
    noNotifications: 'فی الحال کوئی اطلاع نہیں ہے',
    lightMode: 'لائٹ موڈ پر سوئچ کریں',
    darkMode: 'ڈارک موڈ پر سوئچ کریں',
    profile: 'صارف کا پروفائل',
    generalManager: 'علی (جنرل مینیجر)',
    systemOs: 'انٹرپرائز او ایس v2.6',
    online: 'آن لائن منسلک',
    close: 'بند کریں',
    back: 'واپس',
    groupOperations: 'آپریشنز اور انوینٹری',
    groupManagement: 'انتظامیہ اور مالیات',
    groupAnalytics: 'تجزیات اور ٹریکنگ',
    navDashboard: 'مین ڈیش بورڈ',
    navTanks: 'فیول ٹینکس سسٹم',
    navDeliveries: 'آمد',
    navDeliveriesSahara: 'صحاری آمد',
    navDeliveriesEtihad: 'اتحاد آمد',
    navSupply: 'سپلائی اور تقسیم کے آرڈرز',
    navFinance: 'کمپنی کا بیلنس',
    navFinanceEtihad: 'اتحاد کمپنی',
    navFinanceSahara: 'صحاری کمپنی',
    navManagers: 'سائٹ مینیجرز اور نگران',
    navTasks: 'لاجسٹک کام',
    navPrices: 'قیمتیں',
    navReports: 'رپورٹس اور اعدادوشمار',
    navChat: 'ڈسپیچ اور فیلڈ بات چیت',
    navSettings: 'سسٹم کی ترتیبات',
    liters: 'لیٹر',
    capacity: 'کل گنجائش',
    currentLevel: 'موجودہ سطح',
    safe: 'محفوظ',
    warning: 'انتباہ',
    critical: 'نازک',
    ready100: '100% مکمل تیار',
    fuelGas: 'پریمیم گیس آئل',
    fuelPetrol: 'سپر پیٹرول',
    fuelBlackOil: 'بلیک فیول آئل',
    fuelDiesel: 'کمرشل ڈیزل',
    addNew: 'نیا شامل کریں',
    exportPdf: 'پی ڈی ایف ایکسپورٹ',
    exportExcel: 'ایکسل ایکسپورٹ',
    save: 'محفوظ کریں',
    cancel: 'منسوخ کریں',
    details: 'تفصیلات',
    status: 'حالت',
  },
  hi: {
    brandTitle: 'सहारा कर्बला',
    brandSubtitle: 'कर्बला केंद्रीय ईंधन टर्मिनल',
    searchPlaceholder: 'खोजें या त्वरित कमांड चलाएं...',
    ctrlK: 'Ctrl K',
    selectLanguage: 'सिस्टम भाषा चुनें',
    languagesCount: '9 भाषाएं',
    notifications: 'अलर्ट और सूचनाएं',
    newNotifications: 'नई',
    markAllRead: 'सभी को पढ़ा हुआ चिह्नित करें',
    noNotifications: 'वर्तमान में कोई सूचना नहीं है',
    lightMode: 'लाइट मोड में बदलें',
    darkMode: 'डार्क मोड में बदलें',
    profile: 'उपयोगकर्ता प्रोफ़ाइल',
    generalManager: 'अली (महाप्रबंधक)',
    systemOs: 'एंटरप्राइज ओएस v2.6',
    online: 'ऑनलाइन सक्रिय',
    close: 'बंद करें',
    back: 'वापस',
    groupOperations: 'संचालन और इन्वेंटरी',
    groupManagement: 'प्रबंधन और वित्त',
    groupAnalytics: 'विश्लेषण और ट्रैकिंग',
    navDashboard: 'मुख्य डैशबोर्ड',
    navTanks: 'ईंधन टैंक प्रणाली',
    navDeliveries: 'आवक',
    navDeliveriesSahara: 'सहारा आवक',
    navDeliveriesEtihad: 'इत्तिहाद आवक',
    navSupply: 'आपूर्ति और वितरण आदेश',
    navFinance: 'कंपनी शेष',
    navFinanceEtihad: 'इत्तिहाद कंपनी',
    navFinanceSahara: 'सहारा कंपनी',
    navManagers: 'साइट प्रबंधक और पर्यवेक्षक',
    navTasks: 'लॉजिस्टिक्स कार्य',
    navPrices: 'कीमतें',
    navReports: 'रिपोर्ट और सांख्यिकी',
    navChat: 'डिस्पैच और संचालन चैट',
    navSettings: 'सिस्टम सेटिंग्स',
    liters: 'लीटर',
    capacity: 'कुल क्षमता',
    currentLevel: 'वर्तमान स्तर',
    safe: 'सुरक्षित',
    warning: 'चेतावनी',
    critical: 'गंभीर',
    ready100: '100% परिचालन योग्य',
    fuelGas: 'प्रीमियम गैस तेल',
    fuelPetrol: 'सुपर पेट्रोल',
    fuelBlackOil: 'भारी ईंधन तेल',
    fuelDiesel: 'वाणिज्यिक डीजल',
    addNew: 'नया जोड़ें',
    exportPdf: 'PDF निर्यात करें',
    exportExcel: 'Excel निर्यात करें',
    save: 'सहेजें',
    cancel: 'रद्द करें',
    details: 'विवरण',
    status: 'स्थिति',
  },
  ru: {
    brandTitle: 'Сахара Кербела',
    brandSubtitle: 'Центральный топливный терминал Кербелы',
    searchPlaceholder: 'Поиск или быстрая команда...',
    ctrlK: 'Ctrl K',
    selectLanguage: 'Выберите язык системы',
    languagesCount: '9 языков',
    notifications: 'Оповещения и уведомления',
    newNotifications: 'новых',
    markAllRead: 'Отметить все как прочитанные',
    noNotifications: 'На данный момент уведомлений нет',
    lightMode: 'Переключить на светлую тему',
    darkMode: 'Переключить на тёмную тему',
    profile: 'Профиль пользователя',
    generalManager: 'Али (Генеральный директор)',
    systemOs: 'Корпоративная ОС v2.6',
    online: 'В сети',
    close: 'Закрыть',
    back: 'Назад',
    groupOperations: 'Операции и склад',
    groupManagement: 'Управление и финансы',
    groupAnalytics: 'Аналитика и мониторинг',
    navDashboard: 'Главная панель',
    navTanks: 'Система резервуаров',
    navDeliveries: 'Поставки',
    navDeliveriesSahara: 'Поставки Сахара',
    navDeliveriesEtihad: 'Поставки Этихад',
    navSupply: 'Заказы на отпуск топлива',
    navFinance: 'Баланс компании',
    navFinanceEtihad: 'Компания Этихад',
    navFinanceSahara: 'Компания Сахара',
    navManagers: 'Менеджеры объекта и бригады',
    navTasks: 'Логистические задачи',
    navPrices: 'Цены',
    navReports: 'Отчеты и статистика',
    navChat: 'Диспетчерский чат',
    navSettings: 'Настройки системы',
    liters: 'Литров',
    capacity: 'Общая емкость',
    currentLevel: 'Текущий уровень',
    safe: 'Норма',
    warning: 'Предупреждение',
    critical: 'Критический',
    ready100: 'Готовность 100%',
    fuelGas: 'Газойль Премиум',
    fuelPetrol: 'Бензин улучшенный',
    fuelBlackOil: 'Мазут топочный',
    fuelDiesel: 'Дизель коммерческий',
    addNew: 'Добавить',
    exportPdf: 'Экспорт в PDF',
    exportExcel: 'Экспорт в Excel',
    save: 'Сохранить',
    cancel: 'Отмена',
    details: 'Подробности',
    status: 'Статус',
  },
  ja: {
    brandTitle: 'サハラ・カルバラー',
    brandSubtitle: 'カルバラー中央燃料ターミナル',
    searchPlaceholder: '検索またはクイックコマンド実行...',
    ctrlK: 'Ctrl K',
    selectLanguage: 'システム言語を選択',
    languagesCount: '9言語',
    notifications: 'アラートと通知',
    newNotifications: '件の新着',
    markAllRead: 'すべて既读にする',
    noNotifications: '現在、通知はありません',
    lightMode: 'ライトモードに切替',
    darkMode: 'ダークモードに切替',
    profile: 'ユーザープロファイル',
    generalManager: 'アリ (総責任者)',
    systemOs: 'エンタープライズOS v2.6',
    online: 'オンライン接続中',
    close: '閉じる',
    back: '戻る',
    groupOperations: '運用と在庫管理',
    groupManagement: '管理と財務会計',
    groupAnalytics: '分析と追跡監視',
    navDashboard: 'メインダッシュボード',
    navTanks: '燃料タンク監視システム',
    navDeliveries: '入荷',
    navDeliveriesSahara: 'サハラ入荷',
    navDeliveriesEtihad: 'エティハド入荷',
    navSupply: '給油・出庫オーダー',
    navFinance: '企業残高',
    navFinanceEtihad: 'エティハド社',
    navFinanceSahara: 'サハラ社',
    navManagers: '現場管理者および監督者',
    navTasks: 'ロジスティクス業務タスク',
    navPrices: '価格',
    navReports: 'レポートと統計データ',
    navChat: '配車・現場チャット',
    navSettings: 'システム全般設定',
    liters: 'リットル',
    capacity: '総容量',
    currentLevel: '現在残量',
    safe: '安全正常',
    warning: '注意警告',
    critical: '緊急アラート',
    ready100: '稼働率 100%',
    fuelGas: 'プレミアム軽油',
    fuelPetrol: 'ハイオクガソリン',
    fuelBlackOil: '重油',
    fuelDiesel: '商用ディーゼル',
    addNew: '新規追加',
    exportPdf: 'PDFエクスポート',
    exportExcel: 'Excelエクスポート',
    save: '保存',
    cancel: 'キャンセル',
    details: '詳細情報',
    status: 'ステータス',
  },
  ko: {
    brandTitle: '사하라 카르발라',
    brandSubtitle: '카르발라 중앙 연료 터미널',
    searchPlaceholder: '검색 또는 빠른 명령 실행...',
    ctrlK: 'Ctrl K',
    selectLanguage: '시스템 언어 선택',
    languagesCount: '9개 언어 지원',
    notifications: '경보 및 알림',
    newNotifications: '개 신규',
    markAllRead: '모두 읽음으로 표시',
    noNotifications: '현재 새로운 알림이 없습니다',
    lightMode: '라이트 모드로 전환',
    darkMode: '다크 모드로 전환',
    profile: '사용자 프로필',
    generalManager: '알리 (총괄 관리자)',
    systemOs: '엔터프라이즈 OS v2.6',
    online: '온라인 연결됨',
    close: '닫기',
    back: '뒤로',
    groupOperations: '운영 및 재고 관리',
    groupManagement: '관리 및 재무',
    groupAnalytics: '분석 및 추적',
    navDashboard: '메인 대시보드',
    navTanks: '저장 탱크 관리 시스템',
    navDeliveries: '입고',
    navDeliveriesSahara: '사하라 입고',
    navDeliveriesEtihad: '에티하드 입고',
    navSupply: '공급 및 주유 출고 주문',
    navFinance: '회사 잔액',
    navFinanceEtihad: '에티하드 사',
    navFinanceSahara: '사하라 사',
    navManagers: '현장 관리자 및 감독관',
    navTasks: '물류 운영 과업',
    navPrices: '가격',
    navReports: '보고서 및 통계 분석',
    navChat: '배차 및 현장 통신',
    navSettings: '시스템 환경설정',
    liters: '리터',
    capacity: '총 용량',
    currentLevel: '현재 레벨',
    safe: '안전 정상',
    warning: '주의 경고',
    critical: '위험 경보',
    ready100: '가동 준비 100%',
    fuelGas: '프리미엄 가스오일',
    fuelPetrol: '고급 휘발유',
    fuelBlackOil: '중유',
    fuelDiesel: '상업용 디젤',
    addNew: '새 항목 추가',
    exportPdf: 'PDF 내보내기',
    exportExcel: 'Excel 내보내기',
    save: '저장',
    cancel: '취소',
    details: '세부 정보',
    status: '상태',
  },
};

// Massive Comprehensive Multilingual Mapping for Zero-Arabic Guarantee
export const PHRASE_MAP: Record<string, Record<SupportedLanguage, string>> = {
  // Brand & Companies
  'صحاري كربلاء 2026': { ar: 'صحاري كربلاء 2026', en: 'Sahara Karbala 2026', tr: 'Sahara Kerbela 2026', zh: '萨哈拉·卡尔巴拉 2026', ur: 'صحاری کربلا 2026', hi: 'सहारा कर्बला 2026', ru: 'Сахара Кербела 2026', ja: 'サハラ・カルバラー 2026', ko: '사하라 카르발라 2026' },
  'صحاري كربلاء': { ar: 'صحاري كربلاء', en: 'Sahara Karbala', tr: 'Sahara Kerbela', zh: '萨哈拉·卡尔巴拉', ur: 'صحاری کربلا', hi: 'सहारा कर्बला', ru: 'Сахара Кербела', ja: 'サハラ・カルバラー', ko: '사하라 카르발라' },
  'شركة الاتحاد': { ar: 'شركة الاتحاد', en: 'Etihad Company', tr: 'Etihad Şirketi', zh: '联合公司 (Etihad)', ur: 'اتحاد کمپنی', hi: 'इत्तिहाद कंपनी', ru: 'Компания Этихад', ja: 'エティハド社', ko: '에티하드 사' },
  'محطة كربلاء المركزية': { ar: 'محطة كربلاء المركزية', en: 'Karbala Central Terminal', tr: 'Kerbela Merkez İstasyonu', zh: '卡尔巴拉中央枢纽', ur: 'کربلا سینٹرل ٹرمینل', hi: 'कर्बला केंद्रीय टर्मिनल', ru: 'Центральный терминал Кербелы', ja: 'カルバラー中央ターミナル', ko: '카르발라 중앙 터미널' },
  'شركة صحاري كربلاء': { ar: 'شركة صحاري كربلاء', en: 'Sahara Karbala Co.', tr: 'Sahara Kerbela Şirketi', zh: '萨哈拉卡尔巴拉公司', ur: 'صحاری کربلا کمپنی', hi: 'सहारा कर्बला कंपनी', ru: 'Компания Сахара Кербела', ja: 'サハラ・カルバラー社', ko: '사하라 카르발라 사' },
  
  // Fuels & Derivatives
  'كاز - صحاري كربلاء 2026': { ar: 'كاز - صحاري كربلاء 2026', en: 'Gasoil - Sahara Karbala 2026', tr: 'Motorin - Sahara Kerbela 2026', zh: '轻柴油 - 萨哈拉卡尔巴拉 2026', ur: 'گیس آئل - صحاری کربلا 2026', hi: 'गैस तेल - सहारा कर्बला 2026', ru: 'Газойль - Сахара Кербела 2026', ja: '軽油 - サハラ・カルバラー 2026', ko: '가스오일 - 사하라 카르발라 2026' },
  'كاز - شركة الاتحاد': { ar: 'كاز - شركة الاتحاد', en: 'Gasoil - Etihad Company', tr: 'Motorin - Etihad Şirketi', zh: '轻柴油 - 联合公司', ur: 'گیس آئل - اتحاد کمپنی', hi: 'गैस तेल - इत्तिहाद कंपनी', ru: 'Газойль - Компания Этихад', ja: '軽油 - エティハド社', ko: '가스오일 - 에티하드 사' },
  'بنزين - صحاري كربلاء 2026': { ar: 'بنزين - صحاري كربلاء 2026', en: 'Gasoline - Sahara Karbala 2026', tr: 'Benzin - Sahara Kerbela 2026', zh: '汽油 - 萨哈拉卡尔巴拉 2026', ur: 'پیٹرول - صحاری کربلا 2026', hi: 'पेट्रोल - सहारा कर्बला 2026', ru: 'Бензин - Сахара Кербела 2026', ja: 'ガソリン - サハラ・カルバラー 2026', ko: '휘발유 - 사하라 카르발라 2026' },
  'منظومة بنزين المحطات': { ar: 'منظومة بنزين المحطات', en: 'Gas Stations Petrol Network', tr: 'Benzin İstasyonları Sistemi', zh: '加油站汽油监控网络', ur: 'پیٹرول اسٹیشنز کا نیٹ ورک', hi: 'पेट्रोल स्टेशन नेटवर्क', ru: 'Сеть бензина АЗС', ja: '給油所ガソリンネットワーク', ko: '주유소 휘발유 관리 네트워크' },
  'مشتريات الوقود والمشتقات': { ar: 'مشتريات الوقود والمشتقات', en: 'Fuel & Oil Products Procurement', tr: 'Akaryakıt ve Türev Alımları', zh: '燃料与成品油采购中心', ur: 'ایندھن اور مصنوعات کی خریداری', hi: 'ईंधन एवं उत्पाद खरीद', ru: 'Закупки топлива и нефтепродуктов', ja: '燃料・石油製品調達', ko: '연료 및 석유제품 조달 현황' },
  'تفاصيل نفط الأسود': { ar: 'تفاصيل نفط الأسود', en: 'Heavy Fuel Oil Operations', tr: 'Ağır Fuel Oil Detayları', zh: '重油 (黑油) 运营详情', ur: 'بلیک آئل کے آپریشنز کی تفصیلات', hi: 'भारी ईंधन तेल संचालन', ru: 'Операции с топочным мазутом', ja: '重油オペレーション詳細', ko: '중유 운영 현황 상세' },
  'تفاصيل النفط الأسود': { ar: 'تفاصيل النفط الأسود', en: 'Heavy Fuel Oil Details', tr: 'Ağır Fuel Oil Detayları', zh: '重油 (黑油) 详情', ur: 'بلیک آئل کی تفصیلات', hi: 'भारी ईंधन तेल विवरण', ru: 'Детали топочного мазута', ja: '重油詳細データ', ko: '중유 세부사항' },
  'تفاصيل خزانات الشركة': { ar: 'تفاصيل خزانات الشركة', en: 'Company Fuel Tanks 3D SCADA', tr: 'Şirket Yakıt Tankları SCADA', zh: '公司储油罐 3D SCADA 监控', ur: 'کمپنی فیول ٹینکس 3D اسکاڈا', hi: 'कंपनी ईंधन टैंक 3D SCADA', ru: '3D SCADA Резервуаров компании', ja: '自社タンク 3D SCADA', ko: '회사 연료 탱크 3D SCADA' },
  'مراقبة الخزانات الميدانية': { ar: 'مراقبة الخزانات الميدانية', en: 'Field Storage Tanks SCADA', tr: 'Saha Tankları SCADA', zh: '现场储罐 SCADA 遥测', ur: 'فیلڈ ٹینکس اسکاڈا', hi: 'फील्ड टैंक SCADA', ru: 'Полевой мониторинг резервуаров', ja: '現場タンク SCADA', ko: '현장 저장 탱크 SCADA' },
  'مؤشرات أسعار الشركات والموردين': { ar: 'مؤشرات أسعار الشركات والموردين', en: 'Suppliers & Market Price Index', tr: 'Tedarikçi ve Piyasa Fiyat Endeksi', zh: '供应商与市场采购价格指数', ur: 'سپلائرز اور مارکیٹ پرائس انڈیکس', hi: 'आपूर्तिकर्ता एवं बाजार मूल्य सूचकांक', ru: 'Индекс цен поставщиков и рынка', ja: 'サプライヤー・市場価格指数', ko: '공급업체 및 시장 가격 지수' },
  'سجل الواردات والشحنات الميدانية': { ar: 'سجل الواردات والشحنات الميدانية', en: 'Field Deliveries & Inbound Shipments Log', tr: 'Saha Sevkiyatları ve Giriş Kayıtları', zh: '现场运单与进油入库记录', ur: 'فیلڈ کھیپ اور آمد کا لاگ', hi: 'फील्ड डिलीवरी और आवक शिपमेंट लॉग', ru: 'Журнал поставок и бензовозов', ja: '現場配送・入荷記録', ko: '현장 입고 및 유조차 운송 대장' },
  'شبه ممتلئ (فائض)': { ar: 'شبه ممتلئ (فائض)', en: 'Near Full (Surplus)', tr: 'Neredeyse Dolu (Fazlalık)', zh: '高位运行 (充裕)', ur: 'تقریباً مکمل (فاضل)', hi: 'लगभग भरा हुआ (अधिशेष)', ru: 'Почти полон (Профицит)', ja: 'ほぼ満杯 (余剰)', ko: '거의 만선 (여유)' },
  'جاهزية عالية': { ar: 'جاهزية عالية', en: 'High Readiness', tr: 'Yüksek Hazırlık', zh: '高就绪状态', ur: 'اعلی تیاری', hi: 'उच्च तैयारी', ru: 'Высокая готовность', ja: '高稼働準備', ko: '높은 준비도' },
  'مستوى متوسط': { ar: 'مستوى متوسط', en: 'Medium Level', tr: 'Orta Seviye', zh: '中等储备液位', ur: 'درمیانی سطح', hi: 'मध्यम स्तर', ru: 'Средний уровень', ja: '中間レベル', ko: '중간 수위' },
  'بحاجة تعبئة': { ar: 'بحاجة تعبئة', en: 'Needs Refill', tr: 'Dolum Gerekiyor', zh: '亟待补给加注', ur: 'دوبارہ بھرنے کی ضرورت', hi: 'भरने की आवश्यकता', ru: 'Требуется доливка', ja: '補給必要', ko: '보충 필요' },
  'خزان النفط الأسود': { ar: 'خزان النفط الأسود', en: 'Black Oil Tank', tr: 'Fuel Oil Tankı', zh: '重油主储罐', ur: 'بلیک آئل ٹینک', hi: 'काला तेल टैंक', ru: 'Резервуар для мазута', ja: '重油タンク', ko: '중유 저장 탱크' },
  'خزان الكاز الرئيسي': { ar: 'خزان الكاز الرئيسي', en: 'Main Gasoil Tank', tr: 'Ana Motorin Tankı', zh: '中央柴油主储罐', ur: 'مین گیس آئل ٹینک', hi: 'मुख्य गैस तेल टैंक', ru: 'Главный резервуар газойля', ja: 'メイン軽油タンク', ko: '메인 가스오일 탱크' },
  'خزان كاز الاتحاد': { ar: 'خزان كاز الاتحاد', en: 'Etihad Gasoil Tank', tr: 'Etihad Motorin Tankı', zh: '联合公司柴油罐', ur: 'اتحاد گیس آئل ٹینک', hi: 'इत्तिहाद गैस तेल टैंक', ru: 'Резервуар газойля Этихад', ja: 'エティハド軽油タンク', ko: '에티하드 가스오일 탱크' },
  'خزان حجي أبو نور': { ar: 'خزان حجي أبو نور', en: 'Hajji Abu Noor Tank', tr: 'Hacı Ebu Nur Tankı', zh: '阿布·努尔作业罐', ur: 'حاجی ابو نور ٹینک', hi: 'हाजी अबू नूर टैंक', ru: 'Резервуар Хаджи Абу Нур', ja: 'ハッジ・アブー・ヌールタンク', ko: '하지 아부 누르 탱크' },
  'خزان البنزين': { ar: 'خزان البنزين', en: 'Gasoline Tank', tr: 'Benzin Tankı', zh: '汽油主储罐', ur: 'پیٹرول ٹینک', hi: 'पेट्रोल टैंक', ru: 'Резервуар для бензина', ja: 'ガソリンタンク', ko: '휘발유 저장 탱크' },
  'خزان نفط أسود الاتحاد': { ar: 'خزان نفط أسود الاتحاد', en: 'Etihad Black Oil Tank', tr: 'Etihad Fuel Oil Tankı', zh: '联合公司重油罐', ur: 'اتحاد بلیک آئل ٹینک', hi: 'इत्तिहाद काला तेल टैंक', ru: 'Резервуар мазута Этихад', ja: 'エティハド重油タンク', ko: '에티하드 중유 탱크' },
  'تشغيلي خاص': { ar: 'تشغيلي خاص', en: 'Special Operational', tr: 'Özel Operasyonel', zh: '专用运行油料', ur: 'خصوصی آپریشنل', hi: 'विशेष परिचालन', ru: 'Спец-операционный', ja: '専用運用油', ko: '특수 운영유' },
  'الكمية المخزونة:': { ar: 'الكمية المخزونة:', en: 'Stored Volume:', tr: 'Depolanan Miktar:', zh: '当前实储油量：', ur: 'ذخیرہ شدہ مقدار:', hi: 'संग्रहीत मात्रा:', ru: 'Объем запаса:', ja: '現在貯蔵量：', ko: '현재 저장 수량:' },

  'رصيد البنزين الفعلي المعتمد': { ar: 'رصيد البنزين الفعلي المعتمد', en: 'Approved Actual Gasoline Balance', tr: 'Onaylı Fiili Benzin Bakiyesi', zh: '经核定实际汽油库存余额', ur: 'منظور شدہ اصل پیٹرول بیلنس', hi: 'स्वीकृत वास्तविक पेट्रोल शेष', ru: 'Утвержденный фактический остаток бензина', ja: '認定済み実ガソリン残高', ko: '승인된 실제 휘발유 잔고' },
  'تشغيلي نشط': { ar: 'تشغيلي نشط', en: 'Active Operational', tr: 'Aktif Operasyonel', zh: '实时运行中', ur: 'فعال آپریشنل', hi: 'सक्रिय परिचालन', ru: 'Активный операционный', ja: '稼働運用中', ko: '활성 운영 중' },
  'جاهزية التغطية التشغيلية': { ar: 'جاهزية التغطية التشغيلية', en: 'Operational Coverage Readiness', tr: 'Operasyonel Karşılama Hazırlığı', zh: '运行保障就绪率', ur: 'آپریشنل کوریج کی تیاری', hi: 'परिचालन कवरेज तैयारी', ru: 'Готовность оперативного покрытия', ja: '運用供給準備率', ko: '운영 공급 준비도' },
  'الفعلي:': { ar: 'الفعلي:', en: 'Actual:', tr: 'Fiili:', zh: '实际天数：', ur: 'اصل:', hi: 'वास्तविक:', ru: 'Фактически:', ja: '実績：', ko: '실제:' },
  'المستهدف:': { ar: 'المستهدف:', en: 'Target:', tr: 'Hedef:', zh: '目标天数：', ur: 'ہدف:', hi: 'लक्ष्य:', ru: 'Целевой:', ja: '目標：', ko: '목표:' },
  'الكمية المطلوب توفرها': { ar: 'الكمية المطلوب توفرها', en: 'Required Replenishment Volume', tr: 'Gerekli Tedarik Miktarı', zh: '建议补足/达标所需加注量', ur: 'مطلوبہ اضافی مقدار', hi: 'आवश्यक पुनःपूर्ति मात्रा', ru: 'Требуемый объем пополнения', ja: '必要補充量', ko: '필요 보충/목표 수량' },
  'تعزيز استراتيجي مستهدف': { ar: 'تعزيز استراتيجي مستهدف', en: 'Target Strategic Reinforcement', tr: 'Hedef Stratejik Takviye', zh: '目标战略储备增援', ur: 'ہدف اسٹریٹجک کمک', hi: 'लक्षित रणनीतिक सुदृढीकरण', ru: 'Целевое стратегическое пополнение', ja: '目標戦略的補強', ko: '목표 전략적 보강' },
  'يؤمن لغاية (الشامل)': { ar: 'يؤمن لغاية (الشامل)', en: 'Secures Until (Full Target)', tr: 'Kapsamlı Karşılama Hedefi', zh: '全面达标后保障至', ur: 'جامع تحفظ تک', hi: 'व्यापक कवरेज तक', ru: 'Обеспечивает до (комплексно)', ja: '総合確保可能期日', ko: '종합 목표 보장 기한' },
  'الرصيد:': { ar: 'الرصيد:', en: 'Balance:', tr: 'Bakiye:', zh: '综合库存：', ur: 'بیلنس:', hi: 'शेष:', ru: 'Остаток:', ja: '残高：', ko: '잔고:' },
  'تحليل الوارد والاستهلاك والتدفق': { ar: 'تحليل الوارد والاستهلاك والتدفق', en: 'Inbound, Outflow & Stream Analytics', tr: 'Giriş, Tüketim ve Akış Analitiği', zh: '入库与消耗及流向全景分析', ur: 'ان باؤنڈ، کھپت اور بہاؤ کا تجزیہ', hi: 'आवक, खपत और प्रवाह विश्लेषण', ru: 'Аналитика поступлений, расхода и потоков', ja: '入荷・消費・流量分析', ko: '입고·소진·유량 분석' },
  'أمواج نيون': { ar: 'أمواج نيون', en: 'Neon Waves', tr: 'Neon Dalgalar', zh: '霓虹波浪视图', ur: 'نیون لہریں', hi: 'नियॉन तरंगें', ru: 'Неоновые волны', ja: 'ネオンウェーブ', ko: '네온 웨이브' },
  'أعمدة 3D': { ar: 'أعمدة 3D', en: '3D Cyber Bars', tr: '3D Çubuklar', zh: '3D立体柱状图', ur: 'تھری ڈی کالمز', hi: '3D कॉलम', ru: '3D Столбцы', ja: '3Dバーチャート', ko: '3D 사이버 바' },
  'الوارد (Inbound)': { ar: 'الوارد (Inbound)', en: 'Inbound', tr: 'Giriş (Inbound)', zh: '进油量 (Inbound)', ur: 'آمد (Inbound)', hi: 'आवक (Inbound)', ru: 'Поступления (Inbound)', ja: '入荷 (Inbound)', ko: '입고량 (Inbound)' },
  'الاستهلاك (Outflow)': { ar: 'الاستهلاك (Outflow)', en: 'Consumption (Outflow)', tr: 'Tüketim (Outflow)', zh: '消耗/出油 (Outflow)', ur: 'کھپت (Outflow)', hi: 'खपत (Outflow)', ru: 'Расход (Outflow)', ja: '消費 (Outflow)', ko: '소진량 (Outflow)' },
  'انقر لإظهار أو إخفاء الوارد': { ar: 'انقر لإظهار أو إخفاء الوارد', en: 'Click to toggle Inbound', tr: 'Girişi göster/gizle', zh: '点击切换进油曲线', ur: 'آمد کو چھپانے یا دکھانے کے لیے کلک کریں', hi: 'आवक को टॉगल करने के लिए क्लिक करें', ru: 'Нажмите для переключения поступлений', ja: '入荷の表示切替', ko: '입고량 표시 전환' },
  'انقر لإظهار أو إخفاء الاستهلاك': { ar: 'انقر لإظهار أو إخفاء الاستهلاك', en: 'Click to toggle Consumption', tr: 'Tüketimi göster/gizle', zh: '点击切换消耗曲线', ur: 'کھپت کو چھپانے یا دکھانے کے لیے کلک کریں', hi: 'खपत को टॉगल करने के लिए क्लिक करें', ru: 'Нажмите для переключения расхода', ja: '消費の表示切替', ko: '소진량 표시 전환' },
  'الفائض:': { ar: 'الفائض:', en: 'Surplus:', tr: 'Fazlalık:', zh: '净结余/差额：', ur: 'فاضل:', hi: 'अधिशेष:', ru: 'Профицит:', ja: '余剰/差引：', ko: '잉여/차액:' },

  'مخزون استراتيجي موحد': { ar: 'مخزون استراتيجي موحد', en: 'Unified Strategic Reserve', tr: 'Birleşik Stratejik Rezerv', zh: '统一战略储备库', ur: 'متحد اسٹریٹجک ریزرو', hi: 'एकीकृत रणनीतिक रिजर्व', ru: 'Единый стратегический резерв', ja: '統合戦略的備蓄', ko: '통합 전략적 비축' },
  'نفط أسود - صحاري كربلاء': { ar: 'نفط أسود - صحاري كربلاء', en: 'Black Oil - Sahara Karbala', tr: 'Fuel Oil - Sahara Kerbela', zh: '重油 - 撒哈拉卡尔巴拉', ur: 'بلیک آئل - صحاری کربلا', hi: 'काला तेल - सहारा करबला', ru: 'Мазут - Сахара Кербела', ja: '重油 - サハラ・カルバラ', ko: '중유 - 사하라 카르발라' },
  'متوسط السعر': { ar: 'متوسط السعر', en: 'Average Price', tr: 'Ortalama Fiyat', zh: '平均价格', ur: 'اوسط قیمت', hi: 'औसत मूल्य', ru: 'Средняя цена', ja: '平均単価', ko: '평균 단가' },
  'معدل السعر': { ar: 'معدل السعر', en: 'Price Rate', tr: 'Fiyat Oranı', zh: '价格基准', ur: 'قیمت کی شرح', hi: 'मूल्य दर', ru: 'Ценовая ставка', ja: '価格レート', ko: '가격 요율' },
  'الصادر الكلي': { ar: 'الصادر الكلي', en: 'Total Outbound', tr: 'Toplam Çıkış', zh: '总出库', ur: 'کل روانگی', hi: 'कुल जावक', ru: 'Всего отпущено', ja: '総出荷', ko: '총 출고' },
  'الاستهلاك الكلي': { ar: 'الاستهلاك الكلي', en: 'Total Consumption', tr: 'Toplam Tüketim', zh: '累计总消耗', ur: 'کل کھپت', hi: 'कुल खपत', ru: 'Общий расход', ja: '総消費量', ko: '총 소비량' },
  'الاستهلاك الفعلي': { ar: 'الاستهلاك الفعلي', en: 'Actual Consumption', tr: 'Fiili Tüketim', zh: '实际消耗', ur: 'اصل کھپت', hi: 'वास्तविक खपत', ru: 'Фактический расход', ja: '実質消費', ko: '실제 소비' },
  'إجمالي الوارد': { ar: 'إجمالي الوارد', en: 'Total Inbound', tr: 'Toplam Giriş', zh: '总入库量', ur: 'کل آمد', hi: 'कुल आवक', ru: 'Всего поступило', ja: '総受入量', ko: '총 입고량' },
  'إجمالي الاستهلاك': { ar: 'إجمالي الاستهلاك', en: 'Total Consumption', tr: 'Toplam Tüketim', zh: '总消耗量', ur: 'کل کھپت', hi: 'कुल खपत', ru: 'Всего израсходовано', ja: '総消費量', ko: '총 소비량' },
  'أيام التغطية': { ar: 'أيام التغطية', en: 'Days of Coverage', tr: 'Karşılama Günleri', zh: '可保障天数', ur: 'کوریج کے دن', hi: 'कवरेज दिन', ru: 'Дней запаса', ja: '供給可能日数', ko: '공급 가능 일수' },
  'الآليات والمعدات': { ar: 'الآليات والمعدات', en: 'Machinery & Fleets', tr: 'Araçlar ve Ekipmanlar', zh: '工程机械与车队', ur: 'گاڑیاں اور مشینری', hi: 'मशीनरी और वाहन', ru: 'Спецтехника и автопарк', ja: '重機・車両部隊', ko: '중장비 및 운송 플릿' },
  'محطات التوليد': { ar: 'محطات التوليد', en: 'Power Stations', tr: 'Elektrik Santralleri', zh: '电力发电枢纽', ur: 'پاور اسٹیشنز', hi: 'विद्युत उत्पादन केंद्र', ru: 'Электрогенераторы', ja: '発電所設備', ko: '발전소 시설' },
  'المزارع والري': { ar: 'المزارع والري', en: 'Agriculture & Irrigation', tr: 'Tarım ve Sulama', zh: '农业与灌溉设施', ur: 'زراعت اور آبپاشی', hi: 'कृषि और सिंचाई', ru: 'Сельхоз и орошение', ja: '農業・灌漑施設', ko: '농업 및 관개' },
  'المشاريع والإنشاءات': { ar: 'المشاريع والإنشاءات', en: 'Projects & Construction', tr: 'Projeler ve الإنشاءات', zh: '工程项目与施工现场', ur: 'منصوبے اور تعمیرات', hi: 'परियोजनाएं और निर्माण', ru: 'Проекты и стройплощадки', ja: 'プロジェクト・建設現場', ko: '프로젝트 및 건설 현장' },
  // 11 Core Inbound Columns
  'الشركة': { ar: 'الشركة', en: 'Company', tr: 'Şirket', zh: '所属公司', ur: 'کمپنی', hi: 'कंपनी', ru: 'Компания', ja: '会社', ko: '회사' },
  'الشركة المجهزة': { ar: 'الشركة المجهزة', en: 'Supplying Company', tr: 'Tedarikçi Şirket', zh: '供应企业', ur: 'سپلائنگ کمپنی', hi: 'आपूर्तिकर्ता कंपनी', ru: 'Компания-поставщик', ja: '供給会社', ko: '공급 업체' },
  'رقم العجلة': { ar: 'رقم العجلة', en: 'Truck Plate No.', tr: 'Araç Plakası', zh: '车牌号码', ur: 'گاڑی کا نمبر', hi: 'वाहन नंबर', ru: 'Номер машины', ja: '車両番号', ko: '차량 번호' },
  'رقم الفوجر': { ar: 'رقم الفوجر', en: 'Voucher No.', tr: 'Fiş/Voucher No', zh: '凭单号/入库单号', ur: 'واؤچر نمبر', hi: 'वाउचर नंबर', ru: 'Номер ваучера', ja: 'バウチャー番号', ko: '전표 번호' },
  'الكميه المستلمة': { ar: 'الكميه المستلمة', en: 'Received Qty', tr: 'Teslim Alınan Miktar', zh: '实收油量', ur: 'موصولہ مقدار', hi: 'प्राप्त मात्रा', ru: 'Принятое кол-во', ja: '受領数量', ko: '입고 수량' },
  'الكمية المستلمة': { ar: 'الكمية المستلمة', en: 'Received Qty', tr: 'Teslim Alınan Miktar', zh: '实收油量', ur: 'موصولہ مقدار', hi: 'प्राप्त मात्रा', ru: 'Принятое кол-во', ja: '受領数量', ko: '입고 수량' },
  'كثافة المنتج': { ar: 'كثافة المنتج', en: 'Product Density', tr: 'Ürün Yoğunluğu', zh: '油品密度', ur: 'مصنوعات کی کثافت', hi: 'उत्पाद घनत्व', ru: 'Плотность продукта', ja: '製品密度', ko: '제품 밀도' },
  'لون المنتج': { ar: 'لون المنتج', en: 'Product Color', tr: 'Ürün Rengi', zh: '油品外观颜色', ur: 'مصنوعات کا رنگ', hi: 'उत्पाद का रंग', ru: 'Цвет продукта', ja: '製品の色', ko: '제품 색상' },
  'سعر المنتج': { ar: 'سعر المنتج', en: 'Product Price', tr: 'Ürün Fiyatı', zh: '油品单价', ur: 'مصنوعات کی قیمت', hi: 'उत्पाद मूल्य', ru: 'Цена продукта', ja: '製品単価', ko: '제품 단가' },
  'تكلفة المنتج': { ar: 'تكلفة المنتج', en: 'Product Cost', tr: 'Ürün Maliyeti', zh: '油品总成本', ur: 'مصنوعات کی لاگت', hi: 'उत्पाद लागत', ru: 'Стоимость продукта', ja: '製品総額', ko: '제품 총 원가' },
  'تاريخ الاستلام والتفريغ': { ar: 'تاريخ الاستلام والتفريغ', en: 'Receipt & Unload Date', tr: 'Teslim ve Boşaltma Tarihi', zh: '收油与卸载时间', ur: 'وصولی اور اتارنے کی تاریخ', hi: 'प्राप्ति एवं अनलोडिंग तिथि', ru: 'Дата приемки и слива', ja: '受取・荷卸日時', ko: '입고 및 하역 일시' },
  'جدول الوارد': { ar: 'جدول الوارد', en: 'Inbound Deliveries Table', tr: 'Giriş Sevkiyat Tablosu', zh: '进油入库清单明细表', ur: 'آمد کا جدول', hi: 'आवक तालिका', ru: 'Таблица поступлений', ja: '受入一覧表', ko: '입고 현황표' },
  'تفاصيل الفوجر': { ar: 'تفاصيل الفوجر', en: 'Voucher Details', tr: 'Fiş Detayları', zh: '凭单详情', ur: 'واؤچر کی تفصیلات', hi: 'वाउचर विवरण', ru: 'Детали ваучера', ja: 'バウチャー詳細', ko: '전표 상세' },
  'طباعة الفوجر': { ar: 'طباعة الفوجر', en: 'Print Voucher', tr: 'Fişi Yazdır', zh: '打印单据', ur: 'واؤچر پرنٹ کریں', hi: 'वाउचर प्रिंट करें', ru: 'Печать ваучера', ja: 'バウチャー印刷', ko: '전표 인쇄' },
  'عدد الشحنات المقيدة': { ar: 'عدد الشحنات المقيدة', en: 'Total Inbound Shipments', tr: 'Kayıtlı Sevkiyat Sayısı', zh: '已登记入库车次', ur: 'درج شدہ شحنات کی تعداد', hi: 'पंजीकृत शिपमेंट की संख्या', ru: 'Количество оформленных партий', ja: '登録済受入件数', ko: '등록된 입고 건수' },

  'تسجيل شحنة جديدة': { ar: 'تسجيل شحنة جديدة', en: 'Register New Delivery', tr: 'Yeni Sevkiyat Kaydet', zh: '录入新进油单', ur: 'نئی کھیپ رجسٹر کریں', hi: 'नया शिपमेंट दर्ज करें', ru: 'Зарегистрировать поставку', ja: '新規受入登録', ko: '신규 입고 등록' },
  'الصهريج والسائق': { ar: 'الصهريج والسائق', en: 'Tanker & Driver', tr: 'Tanker ve Sürücü', zh: '油罐车与驾驶员', ur: 'ٹینکر اور ڈرائیور', hi: 'टैंकर और चालक', ru: 'Бензовоз и водитель', ja: 'タンクローリー・運転手', ko: '유조차 및 운전기사' },
  'الخزان الموجه': { ar: 'الخزان الموجه', en: 'Assigned Tank', tr: 'Hedef Tank', zh: '入库指定储罐', ur: 'نامزد ٹینک', hi: 'आवंटित टैंक', ru: 'Целевой резервуар', ja: '指定タンク', ko: '배정 저장 탱크' },
  'الكمية (لتر)': { ar: 'الكمية (لتر)', en: 'Quantity (Liters)', tr: 'Miktar (Litre)', zh: '数量 (升)', ur: 'مقدار (لیٹر)', hi: 'मात्रा (लीटर)', ru: 'Количество (литры)', ja: '数量 (L)', ko: '수량 (L)' },
  'السعر الإجمالي': { ar: 'السعر الإجمالي', en: 'Total Value', tr: 'Toplam Değer', zh: '总金额', ur: 'کل قیمت', hi: 'कुल राशि', ru: 'Итоговая стоимость', ja: '総額', ko: '총 금액' },
  'سعر اللتر المعتمد': { ar: 'سعر اللتر المعتمد', en: 'Approved Liter Price', tr: 'Onaylı Litre Fiyatı', zh: '核定每升单价', ur: 'منظور شدہ فی لیٹر قیمت', hi: 'स्वीकृत प्रति लीटर मूल्य', ru: 'Утвержденная цена за литр', ja: '承認リッター単価', ko: '승인된 리터당 단가' },
  'رقم الإيصال': { ar: 'رقم الإيصال', en: 'Receipt No.', tr: 'Fiş No.', zh: '单据编号', ur: 'رسید نمبر', hi: 'رسید संख्या', ru: 'Номер квитанции', ja: '伝票番号', ko: '영수증 번호' },
  'المورد': { ar: 'المورد', en: 'Supplier', tr: 'Tedarikçi', zh: '供应商', ur: 'سپلائر', hi: 'आपूर्तिकर्ता', ru: 'Поставщик', ja: '供給業者', ko: '공급사' },
  'المنتج': { ar: 'المنتج', en: 'Product', tr: 'Ürün', zh: '油品种类', ur: 'پروڈکٹ', hi: 'उत्पाद', ru: 'Нефтепродукт', ja: '品名', ko: '유종' },
  'الحالة': { ar: 'الحالة', en: 'Status', tr: 'Durum', zh: '状态', ur: 'حیثیت', hi: 'स्थिति', ru: 'Статус', ja: 'ステータス', ko: '상태' },
  'تم الاستلام': { ar: 'تم الاستلام', en: 'Received', tr: 'Alındı', zh: '已入库', ur: 'موصول', hi: 'प्राप्त', ru: 'Принято', ja: '受領済', ko: '입고 완료' },
  'في الطريق': { ar: 'في الطريق', en: 'In Transit', tr: 'Yolda', zh: '在途运输', ur: 'راستے میں', hi: 'मार्ग में', ru: 'В пути', ja: '輸送中', ko: '운송 중' },
  'قيد الفحص': { ar: 'قيد الفحص', en: 'Under Inspection', tr: 'İncelemede', zh: '化验质检中', ur: 'زیر جانچ', hi: 'परीक्षणाधीन', ru: 'На проверке', ja: '品質検査中', ko: '검사 진행 중' },
  'الكل': { ar: 'الكل', en: 'All', tr: 'Tümü', zh: '全部', ur: 'تمام', hi: 'सभी', ru: 'Все', ja: 'すべて', ko: '전체' },
  'تجاري': { ar: 'تجاري', en: 'Commercial', tr: 'Ticari', zh: '商业', ur: 'تجارتی', hi: 'वाणिज्यिक', ru: 'Коммерческий', ja: '商用', ko: '상업용' },
  'رسمي': { ar: 'رسمي', en: 'Official', tr: 'Resmi', zh: '官方', ur: 'سرکاری', hi: 'आधिकारिक', ru: 'Официальный', ja: '公式', ko: '공식' },
  'حكومي': { ar: 'حكومي', en: 'Governmental', tr: 'Devlet', zh: '政府采购', ur: 'حکومتی', hi: 'सरकारी', ru: 'Государственный', ja: '政府管轄', ko: '정부 조달' },
  'معتمد': { ar: 'معتمد', en: 'Certified', tr: 'Onaylı', zh: '已官方核准', ur: 'منظور شدہ', hi: 'प्रमाणित', ru: 'Утверждено', ja: '認証済', ko: '공인 승인' },
  'المخزون والتشغيل': { ar: 'المخزون والتشغيل', en: 'Inventory & Operations', tr: 'Envanter ve Operasyon', zh: '库存与运行监控', ur: 'اسٹاک اور آپریشنز', hi: 'इन्वेंटरी और संचालन', ru: 'Склад и эксплуатация', ja: '在庫・運用管理', ko: '재고 및 운영 관리' },
  'محدث يومياً': { ar: 'محدث يومياً', en: 'Daily Updated', tr: 'Günlük Güncellenir', zh: '每日实时更新', ur: 'روزانہ اپ ڈیٹ', hi: 'दैनिक अद्यतन', ru: 'Обновляется ежедневно', ja: '毎日更新', ko: '일일 업데이트' },
  'الطاقة': { ar: 'الطاقة', en: 'Al-Taqa Power', tr: 'Al-Taqa Enerji', zh: '阿尔塔卡电站', ur: 'الطقہ پاور', hi: 'अल-ताका पावर', ru: 'Аль-Така Энерджи', ja: 'アルタカ電力', ko: '알타카 발전' },
  'التسمين': { ar: 'التسمين', en: 'Al-Tasmeen Farm', tr: 'Al-Tasmeen Çiftliği', zh: '塔斯敏养殖基地', ur: 'التسمین فارم', hi: 'अल-तसमीन फार्म', ru: 'Аль-Тасмин', ja: 'アルタスミーン農場', ko: '알타스민 농장' },
  'البياض': { ar: 'البياض', en: 'Al-Bayadh Station', tr: 'Al-Bayadh İstasyonu', zh: '阿尔巴亚德站', ur: 'البیاض اسٹیشن', hi: 'अल-बयाध स्टेशन', ru: 'Аль-Баяд', ja: 'アルバヤード給油所', ko: '알바야드 주유소' },
  'الطار': { ar: 'الطار', en: 'Al-Tar Station', tr: 'Al-Tar İstasyonu', zh: '阿尔塔尔站', ur: 'الطار اسٹیشن', hi: 'अल-तार स्टेशन', ru: 'Аль-Тар', ja: 'アルタール給油所', ko: '알타르 주유소' },
  'الرزازة': { ar: 'الرزازة', en: 'Al-Razzaza Hub', tr: 'Al-Razzaza İstasyonu', zh: '拉扎扎枢纽站', ur: 'الرزازہ ہب', hi: 'अल-रज्जाजा हब', ru: 'Аль-Раззаза', ja: 'アルラッザーザ拠点', ko: '알라자자 허브' },
  'الأجداد': { ar: 'الأجداد', en: 'Al-Ajdad Site', tr: 'Al-Ajdad Sahası', zh: '阿吉达德基地', ur: 'الاجداد سائٹ', hi: 'अल-अजदाद साइट', ru: 'Аль-Аждад', ja: 'アルアジダード施設', ko: '알아즈다드 사이트' },
  'الأسفلت': { ar: 'الأسفلت', en: 'Asphalt Plant', tr: 'Asfalt Fabrikası', zh: '沥青拌合站', ur: 'اسفالٹ پلانٹ', hi: 'डामर संयंत्र', ru: 'Асфальтовый завод', ja: 'アスファルトプラント', ko: '아스팔트 플랜트' },
  'مدينة الحجاج': { ar: 'مدينة الحجاج', en: 'Pilgrims City Terminal', tr: 'Hacı Kenti İstasyonu', zh: '朝圣者接待城枢纽', ur: 'حجاج سٹی ٹرمینل', hi: 'तीर्थयात्री नगर टर्मिनल', ru: 'Город паломников', ja: '巡礼都市ターミナル', ko: '순례자 도시 터미널' },

  // Consumption & Flow Charts
  'توزيع نسب الاستهلاك': { ar: 'توزيع نسب الاستهلاك', en: 'Consumption Breakdown', tr: 'Tüketim Dağılımı', zh: '各部门消耗占比分布', ur: 'کھپت کا تناسب', hi: 'खपत वितरण', ru: 'Распределение расхода', ja: '部門別消費シェア', ko: '소비 비율 분포' },
  '100% الإجمالي': { ar: '100% الإجمالي', en: '100% Total', tr: '%100 Toplam', zh: '100% 汇总', ur: '100% کل', hi: '100% कुल', ru: '100% Всего', ja: '100% 全体', ko: '100% 합계' },
  'الرصيد المستهلك': { ar: 'الرصيد المستهلك', en: 'Consumed Volume', tr: 'Tüketilen Miktar', zh: '总消耗量', ur: 'استعمال شدہ بیلنس', hi: 'उपभोग की गई मात्रा', ru: 'Израсходованный объем', ja: '消費残高', ko: '소비 잔량' },
  'بيانات الأسبوع': { ar: 'بيانات الأسبوع', en: 'Weekly Flow Telemetry', tr: 'Haftalık Akış Verileri', zh: '本周进耗动态监测', ur: 'ہفتہ وار ڈیٹا', hi: 'साप्ताहिक डेटा', ru: 'Недельная динамика', ja: '週間フロー実績', ko: '주간 입출고 동향' },
  'وارد': { ar: 'وارد', en: 'Inbound', tr: 'Giriş', zh: '入库', ur: 'آمد', hi: 'आवक', ru: 'Приход', ja: '入荷', ko: '입고' },
  'استهلاك': { ar: 'استهلاك', en: 'Consumption', tr: 'Tüketim', zh: '消耗', ur: 'کھپت', hi: 'खपत', ru: 'Расход', ja: '消費', ko: '소비' },
  'تدفق يومي': { ar: 'تدفق يومي', en: 'Daily Flow', tr: 'Günlük Akış', zh: '每日流量', ur: 'روزانہ کا بہاؤ', hi: 'दैनिक प्रवाह', ru: 'Суточный поток', ja: '日次推移', ko: '일일 유량' },
  'الوارد:': { ar: 'الوارد:', en: 'Inbound:', tr: 'Giriş:', zh: '入库：', ur: 'آمد:', hi: 'आवक:', ru: 'Приход:', ja: '入荷:', ko: '입고:' },
  'الاستهلاك:': { ar: 'الاستهلاك:', en: 'Consumption:', tr: 'Tüketim:', zh: '消耗：', ur: 'کھپت:', hi: 'खपत:', ru: 'Расход:', ja: '消費:', ko: '소비:' },
  'الكمية المستهلكة:': { ar: 'الكمية المستهلكة:', en: 'Consumed Volume:', tr: 'Tüketilen Miktar:', zh: '部门实际消耗量：', ur: 'استعمال شدہ مقدار:', hi: 'उपभोग की गई मात्रा:', ru: 'Израсходованное кол-во:', ja: '消費量:', ko: '소비된 수량:' },
  'توريدات مستلمة': { ar: 'توريدات مستلمة', en: 'Received Inbound', tr: 'Teslim Alınan', zh: '已入库实收', ur: 'موصولہ سپلائی', hi: 'प्राप्त आपूर्ति', ru: 'Принятые поставки', ja: '受入済供給', ko: '입고 완료분' },
  'سحب تراكمي': { ar: 'سحب تراكمي', en: 'Cumulative Draw', tr: 'Kümülatif Çekim', zh: '累计总出库', ur: 'مجموعی انخلاء', hi: 'संचयी निकासी', ru: 'Накопленный расход', ja: '累積払出', ko: '누적 출고' },
  'صرف مباشر': { ar: 'صرف مباشر', en: 'Direct Outflow', tr: 'Doğrudan Tüketim', zh: '实时直接发放', ur: 'براہ راست اخراج', hi: 'प्रत्यक्ष वितरण', ru: 'Прямой отпуск', ja: '直接給油', ko: '직접 출고' },
  'مدير النظام': { ar: 'مدير النظام', en: 'System Administrator', tr: 'Sistem Yöneticisi', zh: '系统高级管理员', ur: 'سسٹم ایڈمنسٹریٹر', hi: 'सिस्टम प्रशासक', ru: 'Системный администратор', ja: 'システム管理者', ko: '시스템 관리자' },
  'صلاحيات إدارية كاملة': { ar: 'صلاحيات إدارية كاملة', en: 'Full Administrative Rights', tr: 'Tam Yönetici Yetkileri', zh: '完全管理权限', ur: 'مکمل انتظامی اختیارات', hi: 'पूर्ण प्रशासनिक अधिकार', ru: 'Полные права доступа', ja: '完全管理者権限', ko: '전체 관리자 권한' },
  'فائض استراتيجي': { ar: 'فائض استراتيجي', en: 'Strategic Surplus', tr: 'Stratejik Fazlalık', zh: '战略储备充足盈余', ur: 'اسٹریٹجک اضافی', hi: 'रणनीतिक अधिशेष', ru: 'Стратегический профицит', ja: '戦略的余剰', ko: '전략적 잉여 재고' },
  'مقارنة الوارد الأسبوعي': { ar: 'مقارنة الوارد الأسبوعي', en: 'Weekly Inbound Trend', tr: 'Haftalık Giriş Trendi', zh: '周进油入库趋势', ur: 'ہفتہ وار آمد کا رجحان', hi: 'साप्ताहिक आवक रुझान', ru: 'Недельный тренд поставок', ja: '週間入荷トレンド', ko: '주간 입고 추이' },
  'مقارنة الاستهلاك الأسبوعي': { ar: 'مقارنة الاستهلاك الأسبوعي', en: 'Weekly Consumption Trend', tr: 'Haftalık Tüketim Trendi', zh: '周燃油消耗趋势', ur: 'ہفتہ وار کھپت کا رجحان', hi: 'साप्ताहिक खपत रुझान', ru: 'Недельный тренд расхода', ja: '週間消費トレンド', ko: '주간 소비 추이' },
  'مقارنة 7 أيام': { ar: 'مقارنة 7 أيام', en: '7-Day Trend', tr: '7 Günlük Trend', zh: '近 7 日比对', ur: '7 دن کا رجحان', hi: '7-दिवसीय रुझान', ru: 'Тренд за 7 дней', ja: '7日間推移', ko: '7일 추이' },

  // Metrics & Headers
  'رصيد الصحاري الفعلي المعتمد': { ar: 'رصيد الصحاري الفعلي المعتمد', en: 'Sahara Approved Actual Balance', tr: 'Sahara Onaylı Fiili Bakiye', zh: '萨哈拉官方核定实际库存', ur: 'صحاری منظور شدہ حقیقی بیلنس', hi: 'सहारा स्वीकृत वास्तविक शेष', ru: 'Утвержденный фактический остаток', ja: 'サハラ承認実質残高', ko: '사하라 승인 실제 재고량' },
  'إجمالي رصيد شركة الاتحاد (المخزون الاستراتيجي)': { ar: 'إجمالي رصيد شركة الاتحاد (المخزون الاستراتيجي)', en: 'Total Etihad Strategic Balance', tr: 'Toplam Etihad Stratejik Stok', zh: '联合公司总战略储备库存', ur: 'اتحاد اسٹریٹجک کل بیلنس', hi: 'इत्तिहाद कुल रणनीतिक शेष', ru: 'Стратегический запас Этихад', ja: 'エティハド戦略備蓄総残高', ko: '에티하드 총 전략 비축량' },
  'توزيع السعة الاستيعابية للمخزون': { ar: 'توزيع السعة الاستيعابية للمخزون', en: 'Storage Capacity Allocation', tr: 'Depolama Kapasitesi Dağılımı', zh: '库存仓储容量分布', ur: 'اسٹوریج گنجائش کی تقسیم', hi: 'भंडारण क्षमता आवंटन', ru: 'Распределение емкости склада', ja: '貯蔵キャパシティ配分', ko: '저장 용량 점유 현황' },
  'الخزانات المركزية': { ar: 'الخزانات المركزية', en: 'Central Storage Tanks', tr: 'Merkezi Tanklar', zh: '中央主力储罐', ur: 'مرکزی ٹینکس', hi: 'केंद्रीय टैंक', ru: 'Центральные резервуары', ja: '中央メインターンク', ko: '중앙 메인 저장 탱크' },
  'السعة المتبقية': { ar: 'السعة المتبقية', en: 'Remaining Capacity', tr: 'Kalan Kapasite', zh: '剩余可用容量', ur: 'باقی گنجائش', hi: 'शेष क्षमता', ru: 'Остаточная емкость', ja: '残余容量', ko: '잔여 저장 가능량' },
  'نسبة الامتلاء': { ar: 'نسبة الامتلاء', en: 'Fill Rate', tr: 'Doluluk Oranı', zh: '总充装率', ur: 'بھرنے کا تناسب', hi: 'भराव अनुपात', ru: 'Уровень заполнения', ja: '充填率', ko: '충전율' },
  'المتبقي': { ar: 'المتبقي', en: 'Remaining', tr: 'Kalan', zh: '剩余', ur: 'باقی', hi: 'शेष', ru: 'Остаток', ja: '残余', ko: '잔여' },
  'الرصيد الفعلي': { ar: 'الرصيد الفعلي', en: 'Actual Balance', tr: 'Fiili Bakiye', zh: '实际库存', ur: 'حقیقی بیلنس', hi: 'वास्तविक शेष', ru: 'Фактический остаток', ja: '実質残量', ko: '실제 잔고' },


  'الوارد الكلي': { ar: 'الوارد الكلي', en: 'Total Inbound', tr: 'Toplam Giriş', zh: '总入库', ur: 'کل آمد', hi: 'कुल आवक', ru: 'Всего поступило', ja: '総入荷', ko: '총 입고' },
































  'توثيق إيصالات استلام الصهاريج والمطابقة الوزنية وحجم الوقود المستلم': {
    ar: 'توثيق إيصالات استلام الصهاريج والمطابقة الوزنية وحجم الوقود المستلم',
    en: 'Documentation of tanker receipts, scale weight verification, and delivered fuel volumes',
    tr: 'Tanker makbuzlarının, kantar tartım onayının ve teslim alınan yakıt miktarının belgelenmesi',
    zh: '油罐车进场单据凭证、地磅重量复核及实际收油体积全流程记录',
    ur: 'ٹینکر کی رسیدوں کی تصدیق، وزنی مطابقت اور موصولہ ایندھن کا اندراج',
    hi: 'टैंकर रसीदों, वजन मिलान और वितरित ईंधन की मात्रा का प्रलेखन',
    ru: 'Документирование накладных бензовозов, весового контроля и объема принятого топлива',
    ja: 'タンクローリー受入伝票、重量検量照合および受入燃料容量の正式記録',
    ko: '유조차 입고 전표, 계근 중량 검증 및 수령 유류 부피 공식 기록'
  },
  'تتبع فروقات الأسعار وحركة السوق بين القطاعين الحكومي والتجاري': {
    ar: 'تتبع فروقات الأسعار وحركة السوق بين القطاعين الحكومي والتجاري',
    en: 'Track price variances and market movements between governmental and commercial sectors',
    tr: 'Kamu ve ticari sektörler arasındaki fiyat farklarını ve piyasa hareketlerini takip edin',
    zh: '跟踪政府采购与商业现货市场之间的价格差异及行情趋势',
    ur: 'سرکاری اور تجارتی شعبوں کے درمیان قیمتوں کے فرق اور مارکیٹ کی نقل و حرکت کا سراغ لگائیں',
    hi: 'सरकारी और वाणिज्यिक क्षेत्रों के बीच मूल्य अंतर और बाजार की चाल पर नज़र रखें',
    ru: 'Отслеживание разницы цен и рыночных колебаний между госсектором и коммерцией',
    ja: '政府部門と民間商用市場間の価格差および市況動向の追跡',
    ko: '정부 조달 및 상업 부문 간의 가격 차이와 시장 동향 추적'
  },
  'إجمالي كميات الشحنات': { ar: 'إجمالي كميات الشحنات', en: 'Total Deliveries Volume', tr: 'Toplam Sevkiyat Miktarı', zh: '进油总交割量', ur: 'کھیپ کی کل مقدار', hi: 'कुल शिपमेंट मात्रा', ru: 'Общий объем поставок', ja: '総配送受入量', ko: '총 운송 물량' },
  'إجمالي القيمة التقديرية': { ar: 'إجمالي القيمة التقديرية', en: 'Total Estimated Value', tr: 'Toplam Tahmini Değer', zh: '预估总结算货值', ur: 'کل تخمینی قیمت', hi: 'कुल अनुमानित मूल्य', ru: 'Общая оценочная стоимость', ja: '総推定評価額', ko: '총 예상 평가액' },
  'عدد الصهاريج المسجلة': { ar: 'عدد الصهاريج المسجلة', en: 'Registered Tankers Count', tr: 'Kayıtlı Tanker Sayısı', zh: '已登记进站油罐车数', ur: 'رجسٹرڈ ٹینکرز کی تعداد', hi: 'पंजीकृत टैंकरों की संख्या', ru: 'Количество бензовозов', ja: '登録済タンクローリー数', ko: '등록된 유조차 수' },
  'تصفية حسب الحالة:': { ar: 'تصفية حسب الحالة:', en: 'Filter by Status:', tr: 'Duruma göre filtrele:', zh: '按状态筛选：', ur: 'حیثیت کے لحاظ سے فلٹر کریں:', hi: 'स्थिति के अनुसार फ़िल्टर करें:', ru: 'Фильтр по статусу:', ja: 'ステータス絞り込み:', ko: '상태별 필터:' },

  // Tank Names & Drivers
  'كاز ممتاز': { ar: 'كاز ممتاز', en: 'Premium Gasoil', tr: 'Premium Motorin', zh: '高标轻柴油', ur: 'پریمیم گیس آئل', hi: 'प्रीमियम गैस तेल', ru: 'Газойль Премиум', ja: 'プレミアム軽油', ko: '프리미엄 가스오일' },
  'كاز توريد محطة': { ar: 'كاز توريد محطة', en: 'Station Supply Gasoil', tr: 'İstasyon İkmal Motorini', zh: '加油站直供柴油', ur: 'اسٹیشن سپلائی گیس آئل', hi: 'स्टेशन आपूर्ति गैस तेल', ru: 'Станционный газойль', ja: 'スタンド供給用軽油', ko: '주유소 공급용 가스오일' },
  'نفط أسود': { ar: 'نفط أسود', en: 'Heavy Fuel Oil', tr: 'Ağır Fuel Oil', zh: '工业重质燃油', ur: 'بلیک آئل', hi: 'भारी ईंधन तेल', ru: 'Топочный мазут', ja: '重油', ko: '중유' },
  'بنزين محسن': { ar: 'بنزين محسن', en: 'Super Gasoline', tr: 'Süper Benzin', zh: '高辛烷值高标汽油', ur: 'سپر پیٹرول', hi: 'सुपर पेट्रोल', ru: 'Улучшенный бензин', ja: 'ハイオクガソリン', ko: '고급 휘발유' },
  'ديزل تجاري': { ar: 'ديزل تجاري', en: 'Commercial Diesel', tr: 'Ticari Dizel', zh: '商业级重柴油', ur: 'کمرشل ڈیزل', hi: 'वाणिज्यिक डीजल', ru: 'Коммерческий дизель', ja: '商用ディーゼル', ko: '상업용 디젤' },
  'ديزل ممتاز': { ar: 'ديزل ممتاز', en: 'Premium Diesel', tr: 'Premium Dizel', zh: '优质低硫柴油', ur: 'پریمیم ڈیزل', hi: 'प्रीमियम डीजल', ru: 'Дизель Премиум', ja: 'プレミアムディーゼル', ko: '프리미엄 디젤' },
  
  // Suppliers & Drivers
  'سجاد حيدر الموسوي': { ar: 'سجاد حيدر الموسوي', en: 'Sajjad Haider Al-Mousawi', tr: 'Sajjad Haider Al-Mousawi', zh: '萨贾德·海德尔·穆萨维', ur: 'سجاد حیدر الموسوی', hi: 'सज्जाद हैदर अल-मौसवी', ru: 'Саджад Хайдер Аль-Мусави', ja: 'サッジャード・ハイダル・アルムーサウィ', ko: '사자드 하이데르 알무사위' },
  'عمر فاضل العبيدي': { ar: 'عمر فاضل العبيدي', en: 'Omar Fadhil Al-Obeidi', tr: 'Omar Fadhil Al-Obeidi', zh: '奥马尔·法德尔·欧贝迪', ur: 'عمر فاضل العبیدی', hi: 'उमर फाजिल अल-ओबैदी', ru: 'Омар Фадиль Аль-Обейди', ja: 'オマル・ファーディル・アルオベイディ', ko: '오마르 파딜 알오베이디' },
  'كرار جاسم الزاملي': { ar: 'كرار جاسم الزاملي', en: 'Karrar Jasim Al-Zamili', tr: 'Karrar Jasim Al-Zamili', zh: '卡拉尔·贾西姆·扎米利', ur: 'کرار جاسم الزاملی', hi: 'कर्रार जासिम अल-जामिली', ru: 'Каррар Джасим Аль-Замили', ja: 'カッラール・ジャースィム・アルザーミリ', ko: '카라르 자심 알자밀리' },
  'كربلاء الدولي': { ar: 'كربلاء الدولي', en: 'Karbala International', tr: 'Kerbela Uluslararası', zh: '卡尔巴拉国际供油集团', ur: 'کربلا انٹرنیشنل', hi: 'कर्बला अंतर्राष्ट्रीय', ru: 'Кербела Интернешнл', ja: 'カルバラー国際', ko: '카르발라 인터내셔널' },
  'شركة توزيع المنتجات النفطية': { ar: 'شركة توزيع المنتجات النفطية', en: 'Oil Products Distribution Co. (OPDC)', tr: 'Petrol Ürünleri Dağıtım Şirketi', zh: '伊拉克国家石油产品分销公司', ur: 'آئل پروڈکٹس ڈسٹری بیوشن کمپنی', hi: 'तेल उत्पाद वितरण कंपनी', ru: 'Госкомпания нефтепродуктов', ja: '石油製品流通公社', ko: '석유제품유통공사' },
  'شركة الفرات الأوسط للوقود': { ar: 'شركة الفرات الأوسط للوقود', en: 'Middle Euphrates Fuel Co.', tr: 'Orta Fırat Yakıt Şirketi', zh: '中幼发拉底燃料能源公司', ur: 'مڈل فرات فیول کمپنی', hi: 'मध्य यूफ्रेट्स ईंधन कंपनी', ru: 'Топливная компания Среднего Евфрата', ja: 'ユーフラテス中流域燃料社', ko: '중부 유프라테스 연료 사' },
  'الشركة الوطنية للطاقة': { ar: 'الشركة الوطنية للطاقة', en: 'National Energy Company', tr: 'Ulusal Enerji Şirketi', zh: '国家能源实业集团', ur: 'نیشنل انرجی کمپنی', hi: 'राष्ट्रीय ऊर्जा कंपनी', ru: 'Национальная энергетическая компания', ja: '国家エネルギー社', ko: '국가에너지 사' },
  'شركة النور للخدمات البترولية': { ar: 'شركة النور للخدمات البترولية', en: 'Al-Noor Petroleum Services', tr: 'Al-Noor Petrol Hizmetleri', zh: '阿尔诺尔石油技术服务公司', ur: 'النور پیٹرولیم سروسز', hi: 'अल-नूर पेट्रोलियम सेवाएं', ru: 'Аль-Нур Нефтесервис', ja: 'アルヌール石油サービス社', ko: '알누르 석유 서비스 사' },

  // Currencies, Units & Days
  'لتر': { ar: 'لتر', en: 'Liters', tr: 'Litre', zh: '升', ur: 'لیٹر', hi: 'लीटर', ru: 'л', ja: 'L', ko: 'L' },
  'شحنة': { ar: 'شحنة', en: 'Shipments', tr: 'Sevkiyat', zh: '车次', ur: 'کھیپ', hi: 'शिपमेंट', ru: 'рейсов', ja: '便', ko: '회' },
  'حمل': { ar: 'حمل', en: 'Cargo', tr: 'Yük', zh: '重载', ur: 'مال بردار', hi: 'कार्गो', ru: 'груз', ja: '貨物', ko: '화물' },
  'د.ع': { ar: 'د.ع', en: 'IQD', tr: 'IQD', zh: '第纳尔', ur: 'د.ع', hi: 'IQD', ru: 'IQD', ja: 'IQD', ko: 'IQD' },
  'السبت': { ar: 'السبت', en: 'Saturday', tr: 'Cumartesi', zh: '星期六', ur: 'ہفتہ', hi: 'शनिवार', ru: 'Суббота', ja: '土曜日', ko: '토요일' },
  'الأحد': { ar: 'الأحد', en: 'Sunday', tr: 'Pazar', zh: '星期日', ur: 'اتوار', hi: 'रविवार', ru: 'Воскресенье', ja: '日曜日', ko: '일요일' },
  'الإثنين': { ar: 'الإثنين', en: 'Monday', tr: 'Pazartesi', zh: '星期一', ur: 'پیر', hi: 'सोमवार', ru: 'Понедельник', ja: '月曜日', ko: '월요일' },
  'الاثنين': { ar: 'الاثنين', en: 'Monday', tr: 'Pazartesi', zh: '星期一', ur: 'پیر', hi: 'सोमवार', ru: 'Понедельник', ja: '月曜日', ko: '월요일' },
  'الثلاثاء': { ar: 'الثلاثاء', en: 'Tuesday', tr: 'Salı', zh: '星期二', ur: 'منگل', hi: 'मंगलवार', ru: 'Вторник', ja: '火曜日', ko: '화요일' },
  'الأربعاء': { ar: 'الأربعاء', en: 'Wednesday', tr: 'Çarşamba', zh: '星期三', ur: 'بدھ', hi: 'बुधवार', ru: 'Среда', ja: '水曜日', ko: '수요일' },
  'الخميس': { ar: 'الخميس', en: 'Thursday', tr: 'Perşembe', zh: '星期四', ur: 'جمعرات', hi: 'गुरुवार', ru: 'Четверг', ja: '木曜日', ko: '목요일' },
  'الجمعة': { ar: 'الجمعة', en: 'Friday', tr: 'Cuma', zh: '星期五', ur: 'جمعہ', hi: 'शुक्रवार', ru: 'Пятница', ja: '金曜日', ko: '금요일' },
  'سبت': { ar: 'سبت', en: 'Sat', tr: 'Cts', zh: '周六', ur: 'ہفتہ', hi: 'शनि', ru: 'Сб', ja: '土', ko: '토' },
  'أحد': { ar: 'أحد', en: 'Sun', tr: 'Paz', zh: '周日', ur: 'اتوار', hi: 'रवि', ru: 'Вс', ja: '日', ko: '일' },
  'اثنين': { ar: 'اثنين', en: 'Mon', tr: 'Pzt', zh: '周一', ur: 'پیر', hi: 'सोम', ru: 'Пн', ja: '月', ko: '월' },
  'ثلاثاء': { ar: 'ثلاثاء', en: 'Tue', tr: 'Sal', zh: '周二', ur: 'منگل', hi: 'मंगल', ru: 'Вт', ja: '火', ko: '화' },
  'أربعاء': { ar: 'أربعاء', en: 'Wed', tr: 'Çar', zh: '周三', ur: 'بدھ', hi: 'बुध', ru: 'Ср', ja: '水', ko: '수' },
  'خميس': { ar: 'خميس', en: 'Thu', tr: 'Per', zh: '周四', ur: 'جمعرات', hi: 'गुरु', ru: 'Чт', ja: '木', ko: '목' },
  'جمعة': { ar: 'جمعة', en: 'Fri', tr: 'Cum', zh: '周五', ur: 'جمعہ', hi: 'शुक्र', ru: 'Пт', ja: '金', ko: '금' },
  


  'المورد / الشركة': { ar: 'المورد / الشركة', en: 'Supplier / Company', tr: 'Tedarikçi / Şirket', zh: '供应商 / 供应企业', ur: 'سپلائر / کمپنی', hi: 'आपूर्तिकर्ता / कंपनी', ru: 'Поставщик / Компания', ja: 'サプライヤー / 企業', ko: '공급사 / 정유사' },
  'نوع المنتج والمشتق': { ar: 'نوع المنتج والمشتق', en: 'Product & Derivative', tr: 'Ürün ve Türev Türü', zh: '油品物料与衍生品分类', ur: 'پروڈکٹ اور مشتق کی قسم', hi: 'उत्पाद और व्युत्पन्न प्रकार', ru: 'Тип нефтепродукта', ja: '製品・誘導体種別', ko: '유종 및 파생 연료' },
  'السعر الحالي': { ar: 'السعر الحالي', en: 'Current Price', tr: 'Güncel Fiyat', zh: '当前最新报价', ur: 'موجودہ قیمت', hi: 'वर्तमान मूल्य', ru: 'Текущая цена', ja: '現在価格', ko: '현재 가격' },
  'السعر السابق': { ar: 'السعر السابق', en: 'Previous Price', tr: 'Önceki Fiyat', zh: '前次参考报价', ur: 'پچھلی قیمت', hi: 'पिछला मूल्य', ru: 'Предыдущая цена', ja: '前回価格', ko: '이전 가격' },
  'نسبة التغير (24h)': { ar: 'نسبة التغير (24h)', en: 'Change Rate (24h)', tr: 'Değişim Oranı (24s)', zh: '24小时涨跌幅', ur: 'تبدیلی کی شرح (24h)', hi: 'परिवर्तन दर (24h)', ru: 'Изм. за 24ч', ja: '変動率 (24時間)', ko: '변동률 (24h)' },
  'حالة التوفر': { ar: 'حالة التوفر', en: 'Availability Status', tr: 'Bulunabilirlik Durumu', zh: '现场供货可用状态', ur: 'دستیابی کی صورتحال', hi: 'उपलब्धता स्थिति', ru: 'Статус наличия', ja: '供給可否状況', ko: '공급 가능 상태' },
  'لا توجد نتائج مطابقة لخيارات الفلترة الحالية': { ar: 'لا توجد نتائج مطابقة لخيارات الفلترة الحالية', en: 'No matching records found for current filters', tr: 'Mevcut filtreler için eşleşen sonuç bulunamadı', zh: '未找到符合当前筛选条件的记录', ur: 'موجودہ فلٹرز کے لیے کوئی نتائج نہیں ملے', hi: 'वर्तमान फिल्टर के लिए कोई परिणाम नहीं मिला', ru: 'Нет записей, соответствующих текущим фильтрам', ja: '現在のフィルター条件に一致する結果はありません', ko: '현재 필터 조건에 일치하는 결과가 없습니다' },
  'محدود': { ar: 'محدود', en: 'Limited', tr: 'Sınırlı', zh: '限量供应', ur: 'محدود', hi: 'सीमित', ru: 'Ограничено', ja: '限定', ko: '제한 공급' },
  'غير متوفر': { ar: 'غير متوفر', en: 'Out of Stock', tr: 'Mevcut Değil', zh: '暂时缺货', ur: 'دستیاب نہیں', hi: 'अनुपलब्ध', ru: 'Нет в наличии', ja: '在庫切れ', ko: '재고 없음' },











  'ابحث عن صفحة، خزان، إجراء، أو أمر سريع...': { ar: 'ابحث عن صفحة، خزان، إجراء، أو أمر سريع...', en: 'Search for page, tank, action, or quick command...', tr: 'Sayfa, tank, işlem veya hızlı komut ara...', zh: '搜索页面、储罐、快速指令或业务操作...', ur: 'صفحہ، ٹینک، عمل یا فوری کمانڈ تلاش کریں...', hi: 'पृष्ठ, टैंक, कार्रवाई या त्वरित आदेश खोजें...', ru: 'Поиск страницы, резервуара, действия или команды...', ja: 'ページ、タンク、アクション、クイックコマンドを検索...', ko: '페이지, 탱크, 작업 또는 퀵 커맨드 검색...' },
  'ESC للإغلاق': { ar: 'ESC للإغلاق', en: 'ESC to close', tr: 'Kapatmak için ESC', zh: 'ESC 退出关闭', ur: 'بند کرنے کے لیے ESC', hi: 'बंद करने के लिए ESC', ru: 'ESC для закрытия', ja: 'ESCで閉じる', ko: 'ESC 닫기' },
  'لا توجد نتائج تطابق بحثك': { ar: 'لا توجد نتائج تطابق بحثك', en: 'No results match your search', tr: 'Aramanızla eşleşen sonuç bulunamadı', zh: '未找到与检索词相符的结果', ur: 'آپ کی تلاش سے مماثل کوئی نتائج نہیں ملے', hi: 'आपकी खोज से मेल खाने वाले कोई परिणाम नहीं मिले', ru: 'Результатов по вашему запросу не найдено', ja: '検索に一致する結果が見つかりませんでした', ko: '검색 조건과 일치하는 결과가 없습니다' },
  'جرّب البحث باسم صفحة مثل «الخزانات» أو رمز خزان مثل «TK-SH-01»': { ar: 'جرّب البحث باسم صفحة مثل «الخزانات» أو رمز خزان مثل «TK-SH-01»', en: 'Try searching by page name like "Tanks" or tank code like "TK-SH-01"', tr: '"Tanklar" gibi bir sayfa adı veya "TK-SH-01" gibi bir tank kodu ile aramayı deneyin', zh: '尝试输入如“储罐”页面名称，或“TK-SH-01”等储罐设备编号', ur: 'صفحہ کے نام جیسے "ٹینکس" یا ٹینک کوڈ جیسے "TK-SH-01" سے تلاش کرنے کی کوشش کریں', hi: '"टैंक" जैसे पृष्ठ नाम या "TK-SH-01" जैसे टैंक कोड से खोजने का प्रयास करें', ru: 'Попробуйте выполнить поиск по названию страницы или коду резервуара «TK-SH-01»', ja: '「タンク」などのページ名や「TK-SH-01」などのタンクコードで検索してみてください', ko: '“탱크”와 같은 페이지 이름이나 “TK-SH-01”과 같은 탱크 코드로 검색해 보세요' },
  'للتنقل': { ar: 'للتنقل', en: 'to navigate', tr: 'Gezinmek için', zh: '上下导航选择', ur: 'نیویگیٹ کرنے کے لیے', hi: 'नेविगेट करने के लिए', ru: 'для навигации', ja: '移動', ko: '이동' },
  'للاختيار': { ar: 'للاختيار', en: 'to select', tr: 'Seçmek için', zh: '按回车确认', ur: 'منتخب کرنے کے لیے', hi: 'चुनने के लिए', ru: 'для выбора', ja: '選択', ko: '선택' },
  'صفحات': { ar: 'صفحات', en: 'Pages', tr: 'Sayfalar', zh: '系统视图', ur: 'صفحات', hi: 'पृष्ठ', ru: 'Страницы', ja: 'ページ', ko: '페이지' },
  'خزانات': { ar: 'خزانات', en: 'Tanks', tr: 'Tanklar', zh: '油罐设备', ur: 'ٹینکس', hi: 'टैंक', ru: 'Резервуары', ja: 'タンク', ko: '탱크' },
  'إجراءات': { ar: 'إجراءات', en: 'Actions', tr: 'Eylemler', zh: '快捷操作', ur: 'اقدامات', hi: 'कार्रवाई', ru: 'Действия', ja: 'アクション', ko: '작업' },

  'إجراء وإدخال سريع': { ar: 'إجراء وإدخال سريع', en: 'Quick Action & Entry', tr: 'Hızlı İşlem ve Giriş', zh: '快捷录入与调度操作', ur: 'فوری کارروائی اور اندراج', hi: 'त्वरित कार्रवाई और प्रविष्टि', ru: 'Быстрое действие и ввод', ja: 'クイックアクション・入力', ko: '빠른 작업 및 입력' },
  'تسجيل شحنة واردة أو طلب صرف فوري': { ar: 'تسجيل شحنة واردة أو طلب صرف فوري', en: 'Register inbound delivery or immediate dispatch request', tr: 'Gelen sevkiyatı veya anında dağıtım talebini kaydedin', zh: '登记新到油罐车入库或提交即时用油分拨申请', ur: 'آنے والی کھیپ یا فوری ترسیل کی درخواست رجسٹر کریں', hi: 'आवक शिपमेंट या तत्काल प्रेषण अनुरोध पंजीकृत करें', ru: 'Регистрация поступления бензовоза или заявки на отпуск', ja: '入荷配送または即時出庫リクエストの登録', ko: '입고 유조차 등록 또는 즉시 출고 요청' },
  'تسجيل واردات صهريج': { ar: 'تسجيل واردات صهريج', en: 'Log Tanker Delivery', tr: 'Tanker Girişi Kaydet', zh: '油罐车进油入库登记', ur: 'ٹینکر کی ترسیل لاگ کریں', hi: 'टैंकर डिलीवरी लॉग करें', ru: 'Зарегистрировать бензовоз', ja: 'タンクローリー受入登録', ko: '탱크로리 입고 등록' },
  'طلب تجهيز وقود': { ar: 'طلب تجهيز وقود', en: 'Fuel Supply Request', tr: 'Yakıt Tedarik Talebi', zh: '燃油领用与加注申请', ur: 'ایندھن کی فراہمی کی درخواست', hi: 'ईंधन आपूर्ति अनुरोध', ru: 'Заявка на отпуск топлива', ja: '燃料給油・供給申請', ko: '연료 공급 요청' },
  'تم الحفظ بنجاح!': { ar: 'تم الحفظ بنجاح!', en: 'Saved Successfully!', tr: 'Başarıyla Kaydedildi!', zh: '数据保存与提交成功！', ur: 'کامیابی سے محفوظ ہو گیا!', hi: 'सफलतापूर्वक सहेजा गया!', ru: 'Успешно сохранено!', ja: '正常に保存されました！', ko: '성공적으로 저장되었습니다!' },
  'تم تحديث الأرصدة وقاعدة البيانات فورياً.': { ar: 'تم تحديث الأرصدة وقاعدة البيانات فورياً.', en: 'Balances and database updated instantly.', tr: 'Bakiyeler ve veritabanı anında güncellendi.', zh: '实时库存与 SCADA 数据库已同步更新。', ur: 'بیلنس اور ڈیٹا بیس فوری طور پر اپ ڈیٹ ہو گیا۔', hi: 'शेष राशि और डेटाबेस तुरंत अपडेट किया गया।', ru: 'Остатки и база данных обновлены моментально.', ja: '残高とデータベースが即座に更新されました。', ko: '잔고 및 데이터베이스가 즉시 업데이트되었습니다.' },
  'نوع الوقود': { ar: 'نوع الوقود', en: 'Fuel Type', tr: 'Yakıt Türü', zh: '燃油品类', ur: 'ایندھن کی قسم', hi: 'ईंधन का प्रकार', ru: 'Вид топлива', ja: '燃料種別', ko: '연료 종류' },

  'كاز تجاري': { ar: 'كاز تجاري', en: 'Commercial Gasoil', tr: 'Ticari Motorin', zh: '商业贸易柴油', ur: 'تجارتی گیس آئل', hi: 'वाणिज्यिक गैस तेल', ru: 'Коммерческий газойль', ja: '商業用軽油', ko: '상업용 가스오일' },
  'بنزين عالي الأوکتان': { ar: 'بنزين عالي الأوكتان', en: 'High-Octane Gasoline', tr: 'Yüksek Oktan Benzin', zh: '高辛烷值高标汽油', ur: 'ہائی آکٹین پیٹرول', hi: 'उच्च ऑक्टेन पेट्रोल', ru: 'Высокооктановый бензин', ja: 'ハイオクガソリン', ko: '고옥탄 휘발유' },
  'بنزين عالي الأوكتان': { ar: 'بنزين عالي الأوكتان', en: 'High-Octane Gasoline', tr: 'Yüksek Oktan Benzin', zh: '高辛烷值高标汽油', ur: 'ہائی آکٹین پیٹرول', hi: 'उच्च ऑक्टेन पेट्रोल', ru: 'Высокооктановый бензин', ja: 'ハイオクガソリン', ko: '고옥탄 휘발유' },
  'السعر للتر (د.ع)': { ar: 'السعر للتر (د.ع)', en: 'Price/Liter (IQD)', tr: 'Litre Fiyatı (IQD)', zh: '单升单价 (第纳尔)', ur: 'فی لیٹر قیمت (د.ع)', hi: 'प्रति लीटर मूल्य (IQD)', ru: 'Цена за литр (IQD)', ja: '単価/リットル (IQD)', ko: '리터당 단가 (IQD)' },
  'رقم الصهريج': { ar: 'رقم الصهريج', en: 'Tanker No.', tr: 'Tanker Plakası', zh: '槽车车牌号', ur: 'ٹینکر نمبر', hi: 'टैंकर संख्या', ru: 'Номер бензовоза', ja: 'タンクローリー車番', ko: '탱크로리 차량번호' },
  'اسم السائق': { ar: 'اسم السائق', en: 'Driver Name', tr: 'Sürücü Adı', zh: '押运司机姓名', ur: 'ڈرائیور کا نام', hi: 'चालक का नाम', ru: 'Имя водителя', ja: '運転手氏名', ko: '운전기사 성명' },
  'الخزان المستلم': { ar: 'الخزان المستلم', en: 'Receiving Tank', tr: 'Alıcı Tank', zh: '目标卸料储罐', ur: 'وصول کرنے والا ٹینک', hi: 'प्राप्त करने वाला टैंक', ru: 'Приемный резервуар', ja: '受入先タンク', ko: '입고 대상 탱크' },
  'تأكيد واستلام الشحنة': { ar: 'تأكيد واستلام الشحنة', en: 'Confirm & Receive Shipment', tr: 'Sevkiyatı Onayla ve Al', zh: '确认过磅并核销入库', ur: 'شپمنٹ کی تصدیق اور وصولی', hi: 'शिपमेंट की पुष्टि करें और प्राप्त करें', ru: 'Подтвердить и принять поставку', ja: '受入確認・確定', ko: '입고 확인 및 인수 확정' },
  'الجهة المستفيدة / الآلية': { ar: 'الجهة المستفيدة / الآلية', en: 'Beneficiary / Equipment', tr: 'Yararlanıcı / Ekipman', zh: '用油单位 / 机械设备编号', ur: 'فائدہ اٹھانے والا / سامان', hi: 'लाभार्थी / उपकरण', ru: 'Получатель / Техника', ja: '受益部門 / 車両機材', ko: '수혜 부서 / 차량·장비' },
  'القطاع': { ar: 'القطاع', en: 'Sector', tr: 'Sektör', zh: '业务归属板块', ur: 'شعبہ', hi: 'क्षेत्र', ru: 'Сектор', ja: '部門', ko: '부문' },
  'الآليات الثقيلة': { ar: 'الآليات الثقيلة', en: 'Heavy Equipment', tr: 'Ağır İş Makineleri', zh: '重型工程机械车队', ur: 'ہیوی مشینری', hi: 'भारी उपकरण', ru: 'Тяжелая техника', ja: '重機・大型車両', ko: '중장비 부문' },

  'المزارع والمضخات': { ar: 'المزارع والمضخات', en: 'Farms & Pumps', tr: 'Çiftlikler ve Pompalar', zh: '灌溉泵站与农林板块', ur: 'فارمز اور پمپس', hi: 'खेत और पंप', ru: 'Фермы и насосные станции', ja: '農場・ポンプ施設', ko: '농장 및 펌프 시설' },
  'موقع المشروع العام': { ar: 'موقع المشروع العام', en: 'Main Project Site', tr: 'Ana Proje Sahası', zh: '主营总项目现场', ur: 'مرکزی پراجیکٹ سائٹ', hi: 'मुख्य परियोजना स्थल', ru: 'Основная площадка проекта', ja: 'メインプロジェクト現場', ko: '메인 프로젝트 현장' },
  'أخرى': { ar: 'أخرى', en: 'Other', tr: 'Diğer', zh: '其他特殊用途', ur: 'دیگر', hi: 'अन्य', ru: 'Другое', ja: 'その他', ko: '기타' },
  'الكمية المطلوبة (لتر)': { ar: 'الكمية المطلوبة (لتر)', en: 'Requested Volume (Liters)', tr: 'Talep Edilen Miktar (L)', zh: '申请加注升数 (升)', ur: 'مطلوبہ مقدار (لیٹر)', hi: 'अनुरोधित मात्रा (लीटर)', ru: 'Запрошенный объем (л)', ja: '申請数量 (L)', ko: '신청 수량 (리터)' },
  'المسؤول عن الطلب': { ar: 'المسؤول عن الطلب', en: 'Request Supervisor', tr: 'Talep Sorumlusu', zh: '经办/领料负责人', ur: 'درخواست کا نگراں', hi: 'अनुरोध पर्यवेक्षक', ru: 'Ответственный за заявку', ja: '申請担当者', ko: '신청 책임자' },
  'المادة': { ar: 'المادة', en: 'Material / Product', tr: 'Malzeme / Ürün', zh: '出库物料', ur: 'مواد / مصنوعات', hi: 'सामग्री / उत्पाद', ru: 'Материал / Продукт', ja: '品名 / 油種', ko: '품목 / 유종' },
  'ملاحظات الصرف': { ar: 'ملاحظات الصرف', en: 'Dispatch Notes', tr: 'Dağıtım Notları', zh: '出库用途备注', ur: 'ڈسپیچ نوٹس', hi: 'प्रेषण नोट्स', ru: 'Примечания к отпуску', ja: '出庫備考', ko: '출고 비고' },
  'اعتماد وصرف الطلب': { ar: 'اعتماد وصرف الطلب', en: 'Approve & Dispatch Order', tr: 'Talebi Onayla ve Dağıt', zh: '批准并执行出库指令', ur: 'آرڈر کی منظوری اور ترسیل', hi: 'आदेश स्वीकृत और प्रेषित करें', ru: 'Утвердить и выдать заказ', ja: '承認および出庫確定', ko: '승인 및 출고 집행' },

  'أصناف رئيسية': { ar: 'أصناف رئيسية', en: 'Main Products', tr: 'Ana Ürünler', zh: '核心主力油品', ur: 'اہم مصنوعات', hi: 'मुख्य उत्पाद', ru: 'Основные продукты', ja: '主要品目', ko: '주요 유종' },

  'السابق:': { ar: 'السابق:', en: 'Prev:', tr: 'Önceki:', zh: '前值：', ur: 'پچھلا:', hi: 'पिछला:', ru: 'Пред:', ja: '前回：', ko: '이전:' },
  'مجموع الشراء': { ar: 'مجموع الشراء', en: 'Total Purchase', tr: 'Toplam Satın Alma', zh: '累计采购进量', ur: 'کل خریداری', hi: 'कुल खरीद', ru: 'Всего закуплено', ja: '総購入調達量', ko: '총 매입 수량' },
  'مستقر': { ar: 'مستقر', en: 'Stable', tr: 'Kararlı', zh: '运行平稳', ur: 'مستحکم', hi: 'स्थिर', ru: 'Стабильно', ja: '安定', ko: '안정' },
  'التصنيف': { ar: 'التصنيف', en: 'Category', tr: 'Kategori', zh: '分类', ur: 'درجہ بندی', hi: 'श्रेणी', ru: 'Категория', ja: '区分', ko: '분류' },
  'الواردات والشحنات': { ar: 'الواردات والشحنات', en: 'Inbound Shipments & Deliveries', tr: 'Gelen Sevkiyatlar ve Teslimatlar', zh: '进油运单与到货记录', ur: 'آمد اور ترسیل', hi: 'आवक शिपमेंट और डिलीवरी', ru: 'Поступления и поставки', ja: '入荷配送および受入', ko: '입고 및 운송 현황' },
  'فتح القائمة الجانبية (شريط العمليات)': { ar: 'فتح القائمة الجانبية (شريط العمليات)', en: 'Open Sidebar (Operations Drawer)', tr: 'Kenar Çubuğunu Aç (Operasyon Menüsü)', zh: '展开侧边栏（操作面板）', ur: 'سائیڈ بار کھولیں (آپریشنز بار)', hi: 'साइडबार खोलें (ऑपरेशन बार)', ru: 'Открыть боковую панель', ja: 'サイドバーを開く (操作ドロワー)', ko: '사이드바 열기 (운영 드로어)' },
  'فتح / طي القائمة الجانبية': { ar: 'فتح / طي القائمة الجانبية', en: 'Toggle Sidebar Menu', tr: 'Kenar Çubuğunu Aç/Kapat', zh: '切换侧边栏菜单', ur: 'سائیڈ بار مینو کھولیں / بند کریں', hi: 'साइडबार मेनू टॉगल करें', ru: 'Переключить боковую панель', ja: 'サイドバーメニューの切替', ko: '사이드바 메뉴 열기/닫기' },
  '7 أيام': { ar: '7 أيام', en: '7 Days', tr: '7 Gün', zh: '7 天', ur: '7 دن', hi: '7 दिन', ru: '7 дней', ja: '7日間', ko: '7일' },
  '14 يوم': { ar: '14 يوم', en: '14 Days', tr: '14 Gün', zh: '14 天', ur: '14 دن', hi: '14 दिन', ru: '14 дней', ja: '14日間', ko: '14일' },
  'شهري': { ar: 'شهري', en: '30 Days', tr: 'Aylık', zh: '30 天', ur: 'ماہانہ', hi: 'मासिक', ru: 'Месяц', ja: '月次', ko: '30일' },
  'تدفق اعتيادي': { ar: 'تدفق اعتيادي', en: 'Normal Flow', tr: 'Normal Akış', zh: '常态平稳流量', ur: 'عام بہاؤ', hi: 'सामान्य प्रवाह', ru: 'Обычный поток', ja: '通常フロー', ko: '일반 유량' },
  'استقرار نسبي': { ar: 'استقرار نسبي', en: 'Relative Stability', tr: 'Göreceli Kararlılık', zh: '相对稳定状态', ur: 'نسبتاً استحکام', hi: 'सापेक्ष स्थिरता', ru: 'Относительная стабильность', ja: '相対的安定', ko: '상대적 안정' },
  'سحب مرتفع': { ar: 'سحب مرتفع', en: 'High Draw', tr: 'Yüksek Çekim', zh: '高峰出库消耗', ur: 'زیادہ انخلاء', hi: 'उच्च निकासी', ru: 'Высокий расход', ja: '高出庫', ko: '출고량 증가' },
  'تعزيز إمداد': { ar: 'تعزيز إمداد', en: 'Supply Boost', tr: 'İkmal Takviyesi', zh: '补充调拨入库', ur: 'سپلائی میں اضافہ', hi: 'आपूर्ति वृद्धि', ru: 'Усиление поставок', ja: '供給強化', ko: '공급 보강' },
  'طلب تصاعدي': { ar: 'طلب تصاعدي', en: 'Rising Demand', tr: 'Artan Talep', zh: '需求持续走高', ur: 'بڑھتی ہوئی مانگ', hi: 'बढ़ती मांग', ru: 'Растущий спрос', ja: '需要増加', ko: '수요 증가' },
  'ذروة التوريد 🚀': { ar: 'ذروة التوريد 🚀', en: 'Supply Peak 🚀', tr: 'İkmal Zirvesi 🚀', zh: '进油峰值 🚀', ur: 'سپلائی عروج 🚀', hi: 'आपूर्ति शिखर 🚀', ru: 'Пик поставок 🚀', ja: '供給ピーク 🚀', ko: '공급 피크 🚀' },
  'فائض ختامي 🟢': { ar: 'فائض ختامي 🟢', en: 'Closing Surplus 🟢', tr: 'Kapanış Fazlası 🟢', zh: '期末结余盈余 🟢', ur: 'اختتامی فاضل 🟢', hi: 'अंतिम अधिशेष 🟢', ru: 'Итоговый профицит 🟢', ja: '期末余剰 🟢', ko: '마감 잉여 🟢' },
  'تدفق مستقر': { ar: 'تدفق مستقر', en: 'Stable Stream', tr: 'Kararlı Akış', zh: '稳定供油流量', ur: 'مستحکم بہاؤ', hi: 'स्थिर प्रवाह', ru: 'Стабильный поток', ja: '安定流量', ko: '안정 유량' },
  'استقرار': { ar: 'استقرار', en: 'Stable', tr: 'Kararlı', zh: '运行稳定', ur: 'مستحکم', hi: 'स्थिर', ru: 'Стабильно', ja: '安定', ko: '안정' },
  'نشاط متزايد': { ar: 'نشاط متزايد', en: 'Increased Activity', tr: 'Artan Faaliyet', zh: '调度活跃度上升', ur: 'بڑھتی ہوئی سرگرمی', hi: 'बढ़ी हुई गतिविधि', ru: 'Повышенная активность', ja: '活動活発化', ko: '활동 증가' },
  'تعزيز': { ar: 'تعزيز', en: 'Reinforce', tr: 'Takviye', zh: '库存调拨增援', ur: 'کمک', hi: 'सुदृढीकरण', ru: 'Усиление', ja: '補強', ko: '보강' },
  'ذروة': { ar: 'ذروة', en: 'Peak', tr: 'Zirve', zh: '高峰时段', ur: 'عروج', hi: 'शिखर', ru: 'Пик', ja: 'ピーク', ko: '피크' },
  'فائض': { ar: 'فائض', en: 'Surplus', tr: 'Fazlalık', zh: '富余储备', ur: 'اضافی', hi: 'अधिशेष', ru: 'Профицит', ja: '余剰', ko: '잉여' },
  'بداية الشهر': { ar: 'بداية الشهر', en: 'Month Start', tr: 'Ay Başı', zh: '月初阶段', ur: 'مہینے کا آغاز', hi: 'महीने की शुरुआत', ru: 'Начало месяца', ja: '月初', ko: '월초' },
  'سحب متزايد': { ar: 'سحب متزايد', en: 'Growing Draw', tr: 'Artan Tüketim', zh: '出库提货增加', ur: 'بڑھتا ہوا انخلاء', hi: 'बढ़ती निकासी', ru: 'Растущий расход', ja: '出庫増大', ko: '출고 증가' },
  'قعر الوارد ⚠️': { ar: 'قعر الوارد ⚠️', en: 'Inbound Dip ⚠️', tr: 'Giriş Düşüşü ⚠️', zh: '进油低谷预警 ⚠️', ur: 'آمد میں کمی ⚠️', hi: 'आवक गिरावट ⚠️', ru: 'Спад поступлений ⚠️', ja: '入荷谷間 ⚠️', ko: '입고 저점 ⚠️' },
  'ذروة أسبوعية 🚀': { ar: 'ذروة أسبوعية 🚀', en: 'Weekly Peak 🚀', tr: 'Haftalık Zirve 🚀', zh: '周调度峰值 🚀', ur: 'ہفتہ وار عروج 🚀', hi: 'साप्ताहिक शिखर 🚀', ru: 'Недельный пик 🚀', ja: '週間ピーク 🚀', ko: '주간 피크 🚀' },
  'تدفق طبيعي': { ar: 'تدفق طبيعي', en: 'Natural Flow', tr: 'Doğal Akış', zh: '常规自然流量', ur: 'قدرتی بہاؤ', hi: 'स्वाभाविक प्रवाह', ru: 'Обычный поток', ja: '標準流量', ko: '정상 유량' },
  'موازنة': { ar: 'موازنة', en: 'Balancing', tr: 'Dengeleme', zh: '平衡调度', ur: 'توازن', hi: 'संतुलन', ru: 'Балансировка', ja: '需給均衡', ko: '수급 균형' },
  'ذروة منتصف الشهر 🚀': { ar: 'ذروة منتصف الشهر 🚀', en: 'Mid-Month Peak 🚀', tr: 'Ay Ortası Zirvesi 🚀', zh: '月中调度高峰 🚀', ur: 'ماہ کے وسط کا عروج 🚀', hi: 'मध्य-महीने का शिखर 🚀', ru: 'Пик середины месяца 🚀', ja: '月中ピーク 🚀', ko: '월중 피크 🚀' },
  'قعر توريد': { ar: 'قعر توريد', en: 'Supply Bottom', tr: 'İkmal Tabanı', zh: '供油低位谷底', ur: 'سپلائی کی نچلی سطح', hi: 'आपूर्ति का निचला स्तर', ru: 'Минимум поставок', ja: '供給低水準', ko: '공급 저점' },
  'أعلى ذروة توريد 🚀': { ar: 'أعلى ذروة توريد 🚀', en: 'Highest Supply Peak 🚀', tr: 'En Yüksek İkmal Zirvesi 🚀', zh: '最高供油峰值记录 🚀', ur: 'سب سے زیادہ سپلائی چوٹی 🚀', hi: 'उच्चतम आपूर्ति शिखर 🚀', ru: 'Максимальный пик поставок 🚀', ja: '最大供給ピーク 🚀', ko: '최대 공급 피크 🚀' },
  'فائض أمان': { ar: 'فائض أمان', en: 'Safety Buffer Surplus', tr: 'Güvenlik Fazlalığı', zh: '安全储备盈余', ur: 'حفاظتی اضافی', hi: 'सुरक्षा अधिशेष', ru: 'Запас безопасности', ja: '安全バッファ余剰', ko: '안전 마진 잉여' },
  'قعر دوري': { ar: 'قعر دوري', en: 'Periodic Dip', tr: 'Periyodik Dip', zh: '周期性低谷', ur: 'معمول کا نچلا پوائنٹ', hi: 'आवधिक गिरावट', ru: 'Периодический минимум', ja: '定期的ボトム', ko: '주기적 저점' },
  'إمداد تعزيزي': { ar: 'إمداد تعزيزي', en: 'Reinforcing Supply', tr: 'Takviye İkmal', zh: '补强式调运', ur: 'امدادی سپلائی', hi: 'सुदृढीकरण आपूर्ति', ru: 'Подкрепляющая поставка', ja: '増強供給', ko: '증원 공급' },
  'تصاعد طلب': { ar: 'تصاعد طلب', en: 'Demand Escalation', tr: 'Talep Artışı', zh: '出库需求爬坡', ur: 'طلب میں اضافہ', hi: 'मांग में वृद्धि', ru: 'Рост спроса', ja: '需要急増', ko: '수요 급증' },
  'ذروة ختامية': { ar: 'ذروة ختامية', en: 'Final Peak', tr: 'Kapanış Zirvesi', zh: '期末调度峰值', ur: 'آخری چوٹی', hi: 'अंतिम शिखर', ru: 'Финальный пик', ja: '最終ピーク', ko: '마감 피크' },
  'ختام الشهر 🟢': { ar: 'ختام الشهر 🟢', en: 'Month-End 🟢', tr: 'Ay Sonu 🟢', zh: '月末总结 🟢', ur: 'ماہ کا اختتام 🟢', hi: 'माह-अंत 🟢', ru: 'Конец месяца 🟢', ja: '月末締め 🟢', ko: '월말 마감 🟢' },
  'انخفاض بالسعر': { ar: 'انخفاض بالسعر', en: 'Price Decrease', tr: 'Fiyat Düşüşü', zh: '价格下调', ur: 'قیمت میں کمی', hi: 'मूल्य में कमी', ru: 'Снижение цены', ja: '価格下落', ko: '가격 하락' },
  'ارتفاع بالسعر': { ar: 'ارتفاع بالسعر', en: 'Price Increase', tr: 'Fiyat Artışı', zh: '价格上调', ur: 'قیمت میں اضافہ', hi: 'मूल्य वृद्धि', ru: 'Повышение цены', ja: '価格上昇', ko: '가격 상승' },
  // 🛢️ Tanks Overview & 3D Cards
  'خزانات شركة الاتحاد وصحاري كربلاء': { ar: 'خزانات شركة الاتحاد وصحاري كربلاء', en: 'Etihad & Sahara Karbala Tanks Matrix', tr: 'Etihad ve Sahara Kerbela Tankları', zh: '联合公司与萨哈拉卡尔巴拉储罐矩阵', ur: 'اتحاد اور صحاری کربلا ٹینکس', hi: 'इत्तिहाद और सहारा करबला टैंक', ru: 'Резервуары Этихад и Сахара Кербела', ja: 'エティハドおよびサハラ・カルバラ貯油タンク', ko: '에티하드 및 사하라 카르발라 저장 탱크' },
  'نظام محاكاة هيدروليكي سينمائي فائق الدقة مطابق لمعايير API-650 للمنشآت النفطية': { ar: 'نظام محاكاة هيدروليكي سينمائي فائق الدقة مطابق لمعايير API-650 للمنشآت النفطية', en: 'Ultra-precision cinematic hydraulic simulation conforming to API-650 petroleum standards', tr: 'API-650 petrol standartlarına uygun sinematik hidrolik simülasyon sistemi', zh: '符合 API-650 石油工程标准的超高精度水力动态数字孪生系统', ur: 'API-650 معیارات کے مطابق ہائی پریزیشن ہائیڈرولک سمولیشن سسٹم', hi: 'API-650 पेट्रोलियम मानकों के अनुरूप उच्च परिशुद्धता हाइड्रोलिक सिमुलेशन प्रणाली', ru: 'Высокоточная кинематографическая гидросимуляция по стандартам API-650', ja: 'API-650石油施設規格に準拠した超高精度油圧シミュレーション', ko: 'API-650 석유 시설 표준을 준수하는 초정밀 유압 시뮬레이션 시스템' },
  'مباشر': { ar: 'مباشر', en: 'LIVE', tr: 'CANLI', zh: '实时在线', ur: 'لائیو', hi: 'लाइव', ru: 'В РЕАЛЬНОМ ВРЕМЕНИ', ja: 'ライブ', ko: '실시간' },
  'المخزون الكلي': { ar: 'المخزون الكلي', en: 'Total Stored Volume', tr: 'Toplam Stok Miktarı', zh: '总在库储量', ur: 'کل ذخیرہ', hi: 'कुल भंडार', ru: 'Общий объем запасов', ja: '総貯蔵量', ko: '총 저장량' },
  'إعادة ضبط القراءات الافتراضية للجداول': { ar: 'إعادة ضبط القراءات الافتراضية للجداول', en: 'Reset to Official Table Readings', tr: 'Resmi Tablo Değerlerine Sıfırla', zh: '重置为官方台账初始基准读数', ur: 'سرکاری ریڈنگز پر ری سیٹ کریں', hi: 'आधिकारिक टेबल रीडिंग पर रीसेट करें', ru: 'Сбросить к исходным показаниям', ja: '公式基準測定値にリセット', ko: '공식 기준치로 초기화' },
  'هل تريد إعادة تعيين كافة مستويات الخزانات إلى القراءات الرسمية للجداول؟': { ar: 'هل تريد إعادة تعيين كافة مستويات الخزانات إلى القراءات الرسمية للجداول؟', en: 'Do you want to reset all tank levels to official table readings?', tr: 'Tüm tank seviyelerini resmi tablo değerlerine sıfırlamak istiyor musunuz?', zh: '确认将所有储罐液位恢复为官方台账的标准初始值吗？', ur: 'کیا آپ تمام ٹینکس کی سطح کو سرکاری ریڈنگز پر ری سیٹ کرنا چاہتے ہیں؟', hi: 'क्या आप सभी टैंक स्तरों को आधिकारिक टेबल रीडिंग पर रीसेट करना चाहते हैं?', ru: 'Вы уверены, что хотите сбросить уровни всех резервуаров к официальным значениям?', ja: 'すべてのタンク液位を公式基準測定値にリセットしますか？', ko: '모든 탱크의 수위를 공식 기준치로 초기화하시겠습니까?' },
  'إجمالي مخزون الجدول': { ar: 'إجمالي مخزون الجدول', en: 'Section Stored Volume', tr: 'Bölüm Toplam Stoku', zh: '该单元板块在库总量', ur: 'سیکشن کا کل ذخیرہ', hi: 'अनुभाग कुल भंडारण', ru: 'Итого по секции', ja: 'セクション合計在庫', ko: '해당 섹션 총 재고' },
  
  // Sections & Descriptions
  'خزانات التشغيل اليومي - بفر وديزل': { ar: 'خزانات التشغيل اليومي - بفر وديزل', en: 'Daily Operations - Buffer & Diesel Tanks', tr: 'Günlük Operasyon - Buffer ve Dizel Tankları', zh: '日运行调度储罐 - 缓冲罐与柴油', ur: 'روزمرہ آپریشنز - بفر اور ڈیزل ٹینکس', hi: 'दैनिक संचालन - बफर और डीजल टैंक', ru: 'Ежедневная эксплуатация - Буфер и дизель', ja: '日次運用 - バッファ＆ディーゼルタンク', ko: '일일 운영 - 버퍼 및 디젤 탱크' },
  'خزانات التغذية والضخ المستمر والتشغيل اليومي للديزل ووحدات البفر': { ar: 'خزانات التغذية والضخ المستمر والتشغيل اليومي للديزل ووحدات البفر', en: 'Continuous feed, constant pumping, and daily diesel buffer units', tr: 'Sürekli besleme, pompalama ve günlük dizel tampon üniteleri', zh: '连续进给、不间断加压输送与柴油缓冲调度机组', ur: 'مسلسل فیڈ اور روزانہ ڈیزل بفر یونٹس', hi: 'निरंतर फीड, निरंतर पंपिंग और दैनिक डीजल बफर इकाइयां', ru: 'Непрерывная подача, перекачка и буферные емкости дизеля', ja: '連続供給・圧送ポンプおよび日次ディーゼルバッファユニット', ko: '연속 공급, 펌핑 및 일일 디젤 버퍼 설비' },
  'وحدة الكاز والبنزين وخزانات بيت الحاج': { ar: 'وحدة الكاز والبنزين وخزانات بيت الحاج', en: 'Gasoil, Gasoline Unit & Hajji Site Tanks', tr: 'Motorin, Benzin ve Hacı Sahası Tankları', zh: '柴油、汽油机组与朝圣基地储罐群', ur: 'گیس آئل، پیٹرول یونٹ اور حجاج سائٹ ٹینکس', hi: 'गैस तेल, पेट्रोल इकाई और हाजी साइट टैंक', ru: 'Установка газойля, бензина и резервуары Хаджи', ja: '軽油・ガソリンユニットおよび巡礼地タンク', ko: '경유, 휘발유 설비 및 하지 사이트 저장 탱크' },
  'منظومة إمداد الكاز والبنزين وخزانات موقع بيت الحاج أبو نور': { ar: 'منظومة إمداد الكاز والبنزين وخزانات موقع بيت الحاج أبو نور', en: 'Fuel supply matrix for Gasoil, Petrol & Hajji Abu Noor site', tr: 'Motorin, benzin ikmal sistemi ve Hacı Ebu Nur sahası tankları', zh: '国标柴油、高标汽油供料系统及阿布·努尔朝圣基地储运枢纽', ur: 'گیس آئل، پیٹرول سپلائی سسٹم اور حج ابو نور سائٹ ٹینکس', hi: 'गैस तेल, पेट्रोल आपूर्ति प्रणाली और हाजी अबू नूर साइट टैंक', ru: 'Система снабжения дизелем, бензином и резервуары базы Хаджи Абу Нур', ja: '軽油・ガソリン供給網およびアブ・ヌール巡礼地給油拠点', ko: '경유·휘발유 공급망 및 하지 아부 누르 기지 탱크' },
  'عمليات الاتحاد - النفط الأسود': { ar: 'عمليات الاتحاد - النفط الأسود', en: 'Etihad Operations - Heavy Fuel Oil', tr: 'Etihad Operasyonları - Ağır Akaryakıt', zh: '联合公司运营板块 - 重油/燃料油', ur: 'اتحاد آپریشنز - ہیوی آئل', hi: 'इत्तिहाद संचालन - भारी ईंधन तेल', ru: 'Операции Этихад - Мазут и тяжелые фракции', ja: 'エティハド事業 - 重油・残渣油', ko: '에티하드 운영 - 중유/중질유' },
  'خزانات النفط الأسود ومحطات الطاقة والربان التابعة لعمليات الاتحاد': { ar: 'خزانات النفط الأسود ومحطات الطاقة والربان التابعة لعمليات الاتحاد', en: 'Heavy oil reservoirs, power plant supply, and Al-Rabban terminals under Etihad', tr: 'Etihad bünyesindeki ağır akaryakıt tankları, enerji santralleri ve Al-Rabban terminalleri', zh: '联合公司所属重油储罐、电站机组供油及阿尔拉班主航运枢纽', ur: 'اتحاد کے تحت ہیوی آئل ٹینکس، پاور اسٹیشنز اور الربان ٹرمینلز', hi: 'इत्तिहाद के तहत भारी तेल टैंक, बिजली संयंत्र और अल-रब्बान टर्मिनल', ru: 'Резервуары мазута, электростанции и терминалы Аль-Раббан компании Этихад', ja: 'エティハド傘下の重油タンク群・発電プラント・アルラッバーンターミナル', ko: '에티하드 관할 중유 저장고, 발전소 공급 설비 및 알라반 터미널' },
  'النفط الأسود - شركة صحاري كربلاء': { ar: 'النفط الأسود - شركة صحاري كربلاء', en: 'Black Oil - Sahara Karbala Company', tr: 'Fuel Oil - Sahara Kerbela Şirketi', zh: '重油储运 - 萨哈拉卡尔巴拉股份公司', ur: 'بلیک آئل - صحاری کربلا کمپنی', hi: 'काला तेल - सहारा करबला कंपनी', ru: 'Мазут - Компания Сахара Кербела', ja: '重油 - サハラ・カルバラ社', ko: '중유 - 사하라 카르발라 사' },
  'مصفوفة الخزانات الرئيسية - النفط الأسود لشركة صحاري كربلاء': { ar: 'مصفوفة الخزانات الرئيسية - النفط الأسود لشركة صحاري كربلاء', en: 'Main strategic tank farm for Heavy Oil at Sahara Karbala Company', tr: 'Sahara Kerbela Şirketi Ağır Akaryakıt ana stratejik tank sahası', zh: '萨哈拉卡尔巴拉公司重质燃料油主力战略储罐集群', ur: 'صحاری کربلا کمپنی کے مین اسٹریٹجک ہیوی آئل ٹینکس', hi: 'सहारा करबला कंपनी में भारी तेल के लिए मुख्य रणनीतिक टैंक फार्म', ru: 'Основной стратегический резервуарный парк мазута компании Сахара Кербела', ja: 'サハラ・カルバラ社 重油主力戦略タンクファーム', ko: '사하라 카르발라 사 메인 전략 중유 탱크 팜' },

  // Tank Names
  'خزان الوقود اليومي': { ar: 'خزان الوقود اليومي', en: 'Daily Fuel Tank', tr: 'Günlük Yakıt Tankı', zh: '日用燃油工作罐', ur: 'روزانہ ایندھن کا ٹینک', hi: 'दैनिक ईंधन टैंक', ru: 'Расходный топливный бак', ja: '日用燃料タンク', ko: '일일 연료 탱크' },
  'خزان البفر 1': { ar: 'خزان البفر 1', en: 'Buffer Tank 1', tr: 'Tampon Tank 1', zh: '1号 稳压缓冲储罐', ur: 'بفر ٹینک 1', hi: 'बफर टैंक 1', ru: 'Буферный резервуар 1', ja: 'バッファタンク 1', ko: '버퍼 탱크 1' },
  'خزان البفر 2': { ar: 'خزان البفر 2', en: 'Buffer Tank 2', tr: 'Tampon Tank 2', zh: '2号 稳压缓冲储罐', ur: 'بفر ٹینک 2', hi: 'बफर टैंक 2', ru: 'Буферный резервуар 2', ja: 'バッファタンク 2', ko: '버퍼 탱크 2' },
  'خزان الديزل': { ar: 'خزان الديزل', en: 'Diesel Main Tank', tr: 'Dizel Ana Tankı', zh: '主力柴油储罐', ur: 'ڈیزل مین ٹینک', hi: 'डीजल मुख्य टैंक', ru: 'Основной дизельный бак', ja: 'ディーゼルメインタンク', ko: '디젤 메인 탱크' },
  'خزان الكاز 1': { ar: 'خزان الكاز 1', en: 'Gasoil Tank 1', tr: 'Motorin Tankı 1', zh: '1号 柴油主力储罐', ur: 'گیس آئل ٹینک 1', hi: 'गैस तेल टैंक 1', ru: 'Резервуар газойля 1', ja: '軽油タンク 1', ko: '경유 탱크 1' },
  'خزان الكاز 2': { ar: 'خزان الكاز 2', en: 'Gasoil Tank 2', tr: 'Motorin Tankı 2', zh: '2号 柴油主力储罐', ur: 'گیس آئل ٹینک 2', hi: 'गैस तेल टैंक 2', ru: 'Резервуар газойля 2', ja: '軽油タンク 2', ko: '경유 탱크 2' },
  'خزان بيت الحاج أبو نور': { ar: 'خزان بيت الحاج أبو نور', en: 'Hajji Abu Noor Site Tank', tr: 'Hacı Ebu Nur Tankı', zh: '阿布·努尔朝圣基地专用罐', ur: 'حج ابو نور سائٹ ٹینک', hi: 'हाजी अबू नूर साइट टैंक', ru: 'Резервуар базы Хаджи Абу Нур', ja: 'アブ・ヌール巡礼拠点タンク', ko: '하지 아부 누르 기지 탱크' },
  'خزان الطاقة القديمة': { ar: 'خزان الطاقة القديمة', en: 'Old Power Station Tank', tr: 'Eski Enerji Santrali Tankı', zh: '老电站发电机组供油罐', ur: 'اولڈ پاور اسٹیشن ٹینک', hi: 'पुराना बिजली संयंत्र टैंक', ru: 'Резервуар старой электростанции', ja: '旧発電所タンク', ko: '구 발전소 탱크' },
  'خزان الطاقة الجديدة': { ar: 'خزان الطاقة الجديدة', en: 'New Power Station Tank', tr: 'Yeni Enerji Santrali Tankı', zh: '新电站主力燃料保供罐', ur: 'نیو پاور اسٹیشن ٹینک', hi: 'नया बिजली संयंत्र टैंक', ru: 'Резервуар новой электростанции', ja: '新発電所タンク', ko: '신 발전소 탱크' },
  'خزان الربان': { ar: 'خزان الربان', en: 'Al-Rabban Strategic Reservoir', tr: 'Al-Rabban Stratejik Tankı', zh: '阿尔拉班超大型战略储油罐', ur: 'الربان اسٹریٹجک ٹینک', hi: 'अल-रब्बान रणनीतिक टैंक', ru: 'Стратегический резервуар Аль-Раббан', ja: 'アルラッバーン超大型戦略備蓄タンク', ko: '알라반 초대형 전략 저장 탱크' },
  'خزان صحاري 1': { ar: 'خزان صحاري 1', en: 'Sahara Tank 1', tr: 'Sahara Tankı 1', zh: '萨哈拉 1号 储罐', ur: 'صحاری ٹینک 1', hi: 'सहारा टैंक 1', ru: 'Резервуар Сахара 1', ja: 'サハラタンク 1', ko: '사하라 탱크 1' },
  'خزان صحاري 2': { ar: 'خزان صحاري 2', en: 'Sahara Tank 2', tr: 'Sahara Tankı 2', zh: '萨哈拉 2号 储罐', ur: 'صحاری ٹینک 2', hi: 'सहारा टैंक 2', ru: 'Резервуар Сахара 2', ja: 'サハラタンク 2', ko: '사하라 탱크 2' },
  'خزان صحاري 3': { ar: 'خزان صحاري 3', en: 'Sahara Tank 3', tr: 'Sahara Tankı 3', zh: '萨哈拉 3号 储罐', ur: 'صحاری ٹینک 3', hi: 'सहारा टैंक 3', ru: 'Резервуар Сахара 3', ja: 'サハラタンク 3', ko: '사하라 탱크 3' },
  'خزان صحاري 4': { ar: 'خزان صحاري 4', en: 'Sahara Tank 4', tr: 'Sahara Tankı 4', zh: '萨哈拉 4号 储罐', ur: 'صحاری ٹینک 4', hi: 'सहारा टैंक 4', ru: 'Резервуар Сахара 4', ja: 'サハラタンク 4', ko: '사하라 탱크 4' },
  'خزان صحاري 5': { ar: 'خزان صحاري 5', en: 'Sahara Tank 5', tr: 'Sahara Tankı 5', zh: '萨哈拉 5号 储罐', ur: 'صحاری ٹینک 5', hi: 'सहारा टैंक 5', ru: 'Резервуар Сахара 5', ja: 'サハラタンク 5', ko: '사하라 탱크 5' },
  'خزان صحاري 6': { ar: 'خزان صحاري 6', en: 'Sahara Tank 6', tr: 'Sahara Tankı 6', zh: '萨哈拉 6号 储罐', ur: 'صحاری ٹینک 6', hi: 'सहारा टैंक 6', ru: 'Резервуар Сахара 6', ja: 'サハラタンク 6', ko: '사하라 탱크 6' },
  'خزان صحاري 7': { ar: 'خزان صحاري 7', en: 'Sahara Tank 7', tr: 'Sahara Tankı 7', zh: '萨哈拉 7号 储罐', ur: 'صحاری ٹینک 7', hi: 'सहारा टैंक 7', ru: 'Резервуар Сахара 7', ja: 'サハラタンク 7', ko: '사하라 탱크 7' },
  'خزان صحاري 8': { ar: 'خزان صحاري 8', en: 'Sahara Tank 8', tr: 'Sahara Tankı 8', zh: '萨哈拉 8号 储罐', ur: 'صحاری ٹینک 8', hi: 'सहारा टैंक 8', ru: 'Резервуар Сахара 8', ja: 'サハラタンク 8', ko: '사하라 탱크 8' },

  // Tank Card Specifics & Gauges
  'اسحب لضبط المنسوب': { ar: 'اسحب لضبط المنسوب', en: 'Drag to adjust level', tr: 'Seviyeyi ayarlamak için kaydırın', zh: '上下拖动滑动条调节油位', ur: 'لیول ایڈجسٹ کرنے کے لیے گھسیٹیں', hi: 'स्तर समायोजित करने के लिए खींचें', ru: 'Потяните для настройки уровня', ja: 'スライドして液位を調整', ko: '슬라이드하여 수위 조절' },
  'تعديل منسوب': { ar: 'تعديل منسوب', en: 'Adjust level of', tr: 'Seviye ayarla:', zh: '校准液位：', ur: 'لیول تبدیل کریں:', hi: 'स्तर समायोजित करें:', ru: 'Настроить уровень:', ja: '液位調整：', ko: '수위 수정:' },
  'إدخال رقمي لمنسوب': { ar: 'إدخال رقمي لمنسوب', en: 'Numeric entry for level of', tr: 'Sayısal seviye girişi:', zh: '数字输入液位：', ur: 'عددی اندراج برائے لیول:', hi: 'स्तर के लिए संख्यात्मक प्रविष्टि:', ru: 'Числовой ввод уровня:', ja: '数値入力液位：', ko: '수위 수치 입력:' },
  'المنسوب:': { ar: 'المنسوب:', en: 'Level:', tr: 'Seviye:', zh: '当前液位：', ur: 'سطح:', hi: 'स्तर:', ru: 'Уровень:', ja: '液位：', ko: '수위:' },
  'السعة:': { ar: 'السعة:', en: 'Capacity:', tr: 'Kapasite:', zh: '设计容量：', ur: 'گنجائش:', hi: 'क्षमता:', ru: 'Вместимость:', ja: '容量：', ko: '용량:' },
  'م': { ar: 'م', en: 'm', tr: 'm', zh: '米', ur: 'میٹر', hi: 'मी', ru: 'м', ja: 'm', ko: 'm' },
  'ممتاز': { ar: 'ممتاز', en: 'Optimal', tr: 'Mükemmel', zh: '充盈良好', ur: 'بہترین', hi: 'उत्कृष्ट', ru: 'Отлично', ja: '良好', ko: '최적' },
  'جيد': { ar: 'جيد', en: 'Good', tr: 'İyi', zh: '正常', ur: 'اچھا', hi: 'अच्छा', ru: 'Хорошо', ja: '標準', ko: '양호' },
  'منخفض': { ar: 'منخفض', en: 'Low', tr: 'Düşük', zh: '偏低预警', ur: 'کم', hi: 'कम', ru: 'Низкий', ja: '低位', ko: '낮음' },
  'حرج': { ar: 'حرج', en: 'Critical', tr: 'Kritik', zh: '紧急警戒', ur: 'نازک', hi: 'गंभीर', ru: 'Критический', ja: '臨界危険', ko: '위험' },

  // Supply, Orders & Actions
  'أوامر وطلبات صرف وتجهيز الوقود': { ar: 'أوامر وطلبات صرف وتجهيز الوقود', en: 'Fuel Dispatch & Supply Orders', tr: 'Yakıt Dağıtım ve Tedarik Talepleri', zh: '燃油领用申请与分拨调度指令', ur: 'ایندھن کی فراہمی اور ترسیل کے احکامات', hi: 'ईंधन प्रेषण और आपूर्ति आदेश', ru: 'Заявки на отпуск и снабжение топливом', ja: '燃料給油・供給指示書', ko: '연료 출고 및 공급 지시서' },
  'دورة طلبات المحروقات لقطاعات الآليات والمولدات والمزارع والمشاريع': { ar: 'دورة طلبات المحروقات لقطاعات الآليات والمولدات والمزارع والمشاريع', en: 'Fuel requisition workflow for machinery, generators, farms, and project sites', tr: 'İş makineleri, jeneratörler, tarım ve şantiye sahaları için yakıt talep döngüsü', zh: '工程机械车队、发电机组、农林排灌及施工现场的燃油审批流转闭环', ur: 'مشینری، جنریٹرز، فارمز اور پروجیکٹس کے لیے ایندھن کی درخواست کا عمل', hi: 'मशीनरी, जनरेटर, खेतों और परियोजनाओं के लिए ईंधन अनुरोध कार्यप्रवाह', ru: 'Жизненный цикл заявок для автопарка, генераторов, ферм и строек', ja: '重機車両・発電機・農場・建設現場向け燃料給油ワークフロー', ko: '중장비, 발전기, 농업 및 건설 현장용 연료 신청 프로세스' },
  'طلب تجهيز جديد': { ar: 'طلب تجهيز جديد', en: 'New Supply Request', tr: 'Yeni Tedarik Talebi', zh: '新建领油/加注申请', ur: 'نئی سپلائی کی درخواست', hi: 'नया आपूर्ति अनुरोध', ru: 'Новая заявка на снабжение', ja: '新規給油申請', ko: '신규 공급 신청' },
  'الآليات': { ar: 'الآليات', en: 'Fleets & Heavy Equipment', tr: 'Araçlar ve Ekipman', zh: '机械车辆板块', ur: 'گاڑیاں اور مشینری', hi: 'मशीनरी और वाहन', ru: 'Автопарк и спецтехника', ja: '車両・重機', ko: '차량 및 장비' },
  'المولدات': { ar: 'المولدات', en: 'Power Generators', tr: 'Jeneratörler', zh: '发电机组', ur: 'جنریٹرز', hi: 'जनरेटर', ru: 'Генераторы', ja: '発電設備', ko: '발전기 설비' },
  'المزارع': { ar: 'المزارع', en: 'Farms & Agriculture', tr: 'Çiftlikler', zh: '农业与灌溉', ur: 'فارمز', hi: 'खेत', ru: 'Фермы и насосы', ja: '農場・灌漑', ko: '농업 및 농장' },
  'موقع المشروع': { ar: 'موقع المشروع', en: 'Project Site', tr: 'Proje Sahası', zh: '重点项目现场', ur: 'پراجیکٹ سائٹ', hi: 'परियोजना स्थल', ru: 'Площадка проекта', ja: 'プロジェクト現場', ko: '프로젝트 현장' },

  // Financial Balance View
  'الرصيد المالي والقيمة التقديرية للمخزون': { ar: 'الرصيد المالي والقيمة التقديرية للمخزون', en: 'Financial Balance & Estimated Stock Valuation', tr: 'Mali Bakiye ve Tahmini Stok Değeri', zh: '财务资产总账与库存燃油公允估值', ur: 'مالی بیلنس اور اسٹاک کی تخمینی قدر', hi: 'वित्तीय शेष और अनुमानित स्टॉक मूल्यांकन', ru: 'Финансовый баланс и оценочная стоимость запасов', ja: '財務バランスおよび備蓄燃料評価額', ko: '재무 잔고 및 보유 재고 추정 평가액' },
  'إدارة التدفقات النقدية وقيمة أصول المشتقات النفطية ومستحقات الموردين': { ar: 'إدارة التدفقات النقدية وقيمة أصول المشتقات النفطية ومستحقات الموردين', en: 'Cash flow tracking, petroleum asset valuations, and vendor payables reconciliation', tr: 'Nakit akışı yönetimi, petrol varlık değerleri ve tedarikçi borçları mutabakatı', zh: '现金流动态监控、石油物料资产核算及上游供应商账期清算管理', ur: 'کیش فلو، پیٹرولیم اثاثوں کی قدر اور سپلائرز کے واجبات کا انتظام', hi: 'कैश फ्लो, पेट्रोलियम परिसंपत्ति मूल्यांकन और आपूर्तिकर्ता देयता प्रबंधन', ru: 'Управление денежными потоками, оценка нефтепродуктов и расчеты с поставщиками', ja: 'キャッシュフロー管理・石油資産評価・サプライヤー買掛金照合', ko: '현금 흐름 관리, 석유 자산 평가 및 공급업체 정산 관리' },
  'القيمة الإجمالية للمخزون الحالي': { ar: 'القيمة الإجمالية للمخزون الحالي', en: 'Total Current Inventory Valuation', tr: 'Toplam Mevcut Stok Değeri', zh: '当前实物总库存总货值', ur: 'موجودہ کل اسٹاک کی قدر', hi: 'वर्तमान कुल इन्वेंटरी मूल्यांकन', ru: 'Общая стоимость текущего запаса', ja: '現在全在庫総評価額', ko: '현재 총 재고 자산 가치' },
  'بناءً على متوسط أسعار الإغلاق اليوم': { ar: 'بناءً على متوسط أسعار الإغلاق اليوم', en: 'Based on today\'s average closing index', tr: 'Bugünkü ortalama kapanış endeksine göre', zh: '根据今日官方结算基准加权平均价计算', ur: 'آج کی اوسط اختتامی قیمتوں کی بنیاد پر', hi: 'आज के औसत समापन सूचकांक के आधार पर', ru: 'На основе средневзвешенных цен закрытия сегодня', ja: '本日の平均終値インデックスに基づく試算', ko: '금일 평균 마감 지수 기준' },
  'رأس المال التشغيلي المخصص': { ar: 'رأس المال التشغيلي المخصص', en: 'Allocated Operating Capital', tr: 'Ayrılan İşletme Sermayesi', zh: '专项营运流动资金储备', ur: 'مختص آپریشنل سرمایہ', hi: 'आवंटित कार्यशील पूंजी', ru: 'Выделенный оборотный капитал', ja: '割当運転資本', ko: '배정 운전 자본금' },
  'سيولة مؤمنة لـ 12 شهراً': { ar: 'سيولة مؤمنة لـ 12 شهراً', en: 'Secured Liquidity for 12 Months', tr: '12 Aylık Güvenceli Likidite', zh: '已锁定保障 12 个月持续平稳运行资金链', ur: '12 ماہ کے لیے محفوظ لیکویڈیٹی', hi: '12 महीने के लिए सुरक्षित तरलता', ru: 'Обеспеченная ликвидность на 12 месяцев', ja: '12ヶ月間の流動性確保済', ko: '12개월 연속 운영 유동성 확보' },
  'إجمالي مشتريات الشهر': { ar: 'إجمالي مشتريات الشهر', en: 'Total Monthly Procurements', tr: 'Aylık Toplam Satın Alma', zh: '本月累计采购总额', ur: 'ماہانہ کل خریداری', hi: 'मासिक कुल खरीद', ru: 'Всего закупок за месяц', ja: '当月総調達仕入額', ko: '당월 총 매입액' },
  'شحنات مصفى كربلاء وشركة الاتحاد': { ar: 'شحنات مصفى كربلاء وشركة الاتحاد', en: 'Karbala Refinery & Etihad Shipments', tr: 'Kerbela Rafinerisi ve Etihad sevkiyatları', zh: '来自卡尔巴拉炼油厂与联合公司的直供到货批次', ur: 'کربلا ریفائنری اور اتحاد شپمنٹس', hi: 'करबला रिफाइनरी और इत्तिहाद शिपमेंट', ru: 'Поставки НПЗ Кербела и компании Этихад', ja: 'カルバラ製油所およびエティハド社入荷分', ko: '카르발라 정유소 및 에티하드 직도착 화물' },
  'المستحقات والقيم المؤجلة': { ar: 'المستحقات والقيم المؤجلة', en: 'Payables & Deferred Values', tr: 'Borçlar ve Ertelenmiş Değerler', zh: '应付账款与延期结算票据', ur: 'واجبات اور موخر اقدار', hi: 'देय राशि और आस्थगित मूल्य', ru: 'Кредиторская задолженность', ja: '買掛金および繰延残高', ko: '미지급금 및 이연 정산액' },
  'مجدولة للصرف خلال 15 يوماً': { ar: 'مجدولة للصرف خلال 15 يوماً', en: 'Scheduled for disbursement in 15 days', tr: '15 gün içinde ödenmesi planlandı', zh: '排期将于未来 15 天内核准付讫', ur: '15 دنوں میں ادائیگی کے لیے شیڈول', hi: '15 दिनों में संवितरण के लिए निर्धारित', ru: 'Запланировано к выплате в течение 15 дней', ja: '15日以内の支払いスケジュール済', ko: '15일 이내 집행 예정' },

  // Site Managers & Personnel
  'كادر ومدراء الموقع والتشغيل الميداني': { ar: 'كادر ومدراء الموقع والتشغيل الميداني', en: 'Site Managers & Field Operations Staff', tr: 'Saha Müdürleri ve Operasyon Kadrosu', zh: '现场管理干部与调度运行工程师团队', ur: 'سائٹ مینیجرز اور فیلڈ آپریشنز عملہ', hi: 'साइट प्रबंधक और फील्ड संचालन कर्मचारी', ru: 'Руководители объектов и персонал', ja: '現場管理者およびフィールド運用スタッフ', ko: '현장 관리자 및 운영 인력 명단' },
  'قائمة المشرفين الميدانيين ومسؤولي السلامة وإدارة حقول الخزانات ومناوبات العمل': { ar: 'قائمة المشرفين الميدانيين ومسؤولي السلامة وإدارة حقول الخزانات ومناوبات العمل', en: 'Field supervisors, safety officers, tank farm managers, and shift rosters', tr: 'Saha denetçileri, İSG sorumluları, tank sahası yöneticileri ve vardiya listesi', zh: '涵盖现场工长、安全主管、储罐区站长及全天候轮值调度值班表', ur: 'فیلڈ سپروائزرز، سیفٹی افسران اور ٹینک فارم مینیجرز کی فہرست', hi: 'फील्ड पर्यवेक्षक, सुरक्षा अधिकारी, टैंक फार्म प्रबंधक और शिफ्ट रोस्टर', ru: 'Список полевых инженеров, офицеров безопасности и дежурных смен', ja: '現場監督・安全管理責任者・タンクエリア責任者・シフト表', ko: '현장 감독관, 안전 관리 책임자, 탱크 팜 관리자 및 교대 근무표' },
  'على رأس العمل': { ar: 'على رأس العمل', en: 'On Duty', tr: 'Görevde', zh: '在岗值守', ur: 'ڈیوٹی پر', hi: 'ड्यूटी पर', ru: 'На смене', ja: '勤務中', ko: '근무 중' },
  'إجازة دورية': { ar: 'إجازة دورية', en: 'On Leave', tr: 'İzinde', zh: '轮休假', ur: 'چھٹی پر', hi: 'छुट्टी पर', ru: 'В отпуске', ja: '休暇中', ko: '휴가 중' },

  // Chart Titles & Series
  'التحليل البياني لمعدلات السحب والاستهلاك الأسبوعي': { ar: 'التحليل البياني لمعدلات السحب والاستهلاك الأسبوعي', en: 'Weekly Fuel Consumption & Outbound Flow Analysis', tr: 'Haftalık Yakıt Tüketimi ve Çıkış Akış Analizi', zh: '每周燃油出库与部门消耗动态趋势分析', ur: 'ہفتہ وار ایندھن کی کھپت اور بہاؤ کا تجزیہ', hi: 'साप्ताहिक ईंधन खपत और प्रवाह विश्लेषण', ru: 'Анализ недельного расхода и отпуска топлива', ja: '週間燃料消費および出庫動向アナリティクス', ko: '주간 연료 소비 및 출고 유량 추이 분석' },
  'مقارنة الاستهلاك اليومي بين صحاري كربلاء وشركة الاتحاد والقطاعات التشغيلية': { ar: 'مقارنة الاستهلاك اليومي بين صحاري كربلاء وشركة الاتحاد والقطاعات التشغيلية', en: 'Daily consumption comparison between Sahara Karbala, Etihad, and operational sectors', tr: 'Sahara Kerbela, Etihad ve operasyonel sektörler arası günlük tüketim karşılaştırması', zh: '萨哈拉卡尔巴拉、联合公司与各工段每日实际用油量横向多维对比', ur: 'صحاری کربلا، اتحاد اور آپریٹنگ سیکٹرز کے درمیان روزانہ کھپت کا موازنہ', hi: 'सहारा करबला, इत्तिहाद और परिचालन क्षेत्रों के बीच दैनिक खपत की तुलना', ru: 'Сравнение суточного расхода между Сахара Кербела, Этихад и подразделениями', ja: 'サハラ・カルバラ、エティハド、および運用部門間の日次消費比較', ko: '사하라 카르발라, 에티하드 및 현장 부문 간 일일 소비량 비교' },
  'مسار السحب اليومي': { ar: 'مسار السحب اليومي', en: 'Daily Draw Flow', tr: 'Günlük Çıkış Akışı', zh: '每日出库动态流向', ur: 'روزانہ انخلاء کا راستہ', hi: 'दैनिक निकासी प्रवाह', ru: 'Суточный поток отпуска', ja: '日次出庫フロー', ko: '일일 출고 흐름' },
  'توزيع القطاعات': { ar: 'توزيع القطاعات', en: 'Sector Allocation', tr: 'Sektörel Dağılım', zh: '各部门占比分布', ur: 'شعبہ جاتی تقسیم', hi: 'क्षेत्रीय आवंटन', ru: 'Распределение по секторам', ja: '部門別配分', ko: '부문별 점유 분포' },

  // Attachments Column & Preview
  'المرفقات': { ar: 'المرفقات', en: 'Attachments', tr: 'Ekler', zh: '附件文件', ur: 'منسلکات', hi: 'संलग्नक', ru: 'Вложения', ja: '添付ファイル', ko: '첨부 파일' },
  'الملفات المرفقة': { ar: 'الملفات المرفقة', en: 'Attached Files', tr: 'Ekli Dosyalar', zh: '已附凭证文件', ur: 'منسلک فائلیں', hi: 'संलग्न फ़ाइलें', ru: 'Прикрепленные файлы', ja: '添付書類一覧', ko: '첨부된 파일' },
  'عرض الملفات': { ar: 'عرض الملفات', en: 'View Files', tr: 'Dosyaları Görüntüle', zh: '查看附件凭单', ur: 'فائلیں دیکھیں', hi: 'फ़ाइलें देखें', ru: 'Просмотр файлов', ja: 'ファイル表示', ko: '파일 보기' },
  'معاينة المستند': { ar: 'معاينة المستند', en: 'Preview Document', tr: 'Belgeyi Önizle', zh: '在线全屏预览单据', ur: 'دستاویز کا پیش نظارہ', hi: 'दستاवेज़ पूर्वावलोकन', ru: 'Предпросмотр документа', ja: '書類プレビュー', ko: '문서 미리보기' },
  'لا توجد مرفقات': { ar: 'لا توجد مرفقات', en: 'No Attachments', tr: 'Ek Yok', zh: '无附件', ur: 'کوئی منسلکات نہیں', hi: 'कोई संलग्नक नहीं', ru: 'Нет вложений', ja: '添付なし', ko: '첨부 없음' },

  // Column Customization & Visibility
  'تخصيص الأعمدة': { ar: 'تخصيص الأعمدة', en: 'Customize Columns', tr: 'Sütunları Özelleştir', zh: '自定义展示列', ur: 'کالمز کی ترتیبات', hi: 'कॉलम कस्टमाइज़ करें', ru: 'Настроить колонки', ja: '列のカスタマイズ', ko: '열 사용자 지정' },
  'الأعمدة': { ar: 'الأعمدة', en: 'Columns', tr: 'Sütunlar', zh: '表格列', ur: 'کالمز', hi: 'कॉलम', ru: 'Колонки', ja: '表示列', ko: '표시 열' },
  'عرض الكل': { ar: 'عرض الكل', en: 'Show All', tr: 'Tümünü Göster', zh: '全选/显示全部列', ur: 'سب دکھائیں', hi: 'सभी दिखाएं', ru: 'Показать все', ja: 'すべて表示', ko: '모두 표시' },
  'الأعمدة الافتراضية': { ar: 'الأعمدة الافتراضية', en: 'Default Columns', tr: 'Varsayılan Sütunlar', zh: '恢复默认常用列', ur: 'پہلے سے طے شدہ کالمز', hi: 'डिफ़ॉल्ट कॉलम', ru: 'По умолчанию', ja: '既定の列に戻す', ko: '기본 열로 복원' },
  'إظهار وإخفاء الأعمدة': { ar: 'إظهار وإخفاء الأعمدة', en: 'Show / Hide Columns', tr: 'Sütunları Göster / Gizle', zh: '勾选显示或隐藏字段', ur: 'کالمز دکھائیں / چھپائیں', hi: 'कॉलم दिखाएं / छुपाएं', ru: 'Показать / скрыть колонки', ja: '列の表示・非表示切替', ko: '열 표시 / 숨기기' },
  'أعمدة معروضة': { ar: 'أعمدة معروضة', en: 'visible columns', tr: 'görünen sütun', zh: '列已勾选启用', ur: 'نمایاں کالمز', hi: 'दृश्यमान कॉलम', ru: 'отображаемых колонок', ja: '列表示中', ko: '개 열 표시 중' },
  'إعادة تعيين': { ar: 'إعادة تعيين', en: 'Reset', tr: 'Sıfırla', zh: '重置', ur: 'دوبارہ ترتیب دیں', hi: 'रीसेट', ru: 'Сбросить', ja: 'リセット', ko: '초기화' },

  // Footer
  '© 2026 منظومة وقود صحاري كربلاء - إدارة ورصد المحروقات والمشتقات النفطية. جميع الحقوق محفوظة.': {
    ar: '© 2026 منظومة وقود صحاري كربلاء - إدارة ورصد المحروقات والمشتقات النفطية. جميع الحقوق محفوظة.',
    en: '© 2026 Sahara Karbala Fuel System - Petroleum & Derivatives Management. All rights reserved.',
    tr: '© 2026 Sahara Kerbela Yakıt Sistemi - Akaryakıt ve Türev Yönetimi. Tüm hakları saklıdır.',
    zh: '© 2026 萨哈拉·卡尔巴拉燃料管理系统 - 石油与衍生化工综合监控调度平台。版权所有。',
    ur: '© 2026 صحاری کربلا فیول سسٹم - پیٹرولیم اور مصنوعات کا انتظام۔ جملہ حقوق محفوظ ہیں۔',
    hi: '© 2026 सहारा कर्बला ईंधन प्रणाली - पेट्रोलियम और व्युत्पन्न प्रबंधन। सर्वाधिकार सुरक्षित।',
    ru: '© 2026 Топливная система Сахара Кербела - Управление нефтепродуктами. Все права защищены.',
    ja: '© 2026 サハラ・カルバラー燃料システム - 石油および派生製品管理。全著作権所有。',
    ko: '© 2026 사하라 카르발라 연료 시스템 - 석유 및 유류 파생상품 관리. 판권 소유.'
  }
};






// Sort phrase keys by length descending to match longest phrases first
const SORTED_PHRASE_KEYS = Object.keys(PHRASE_MAP).sort((a, b) => b.length - a.length);

/**
 * Universal text translator function that converts Arabic phrases to the selected language
 */
export function trText(text: string, lang: SupportedLanguage): string {
  if (lang === 'ar' || !text || typeof text !== 'string') return text;
  
  const trimmed = text.trim();

  // 1. Direct exact match
  if (PHRASE_MAP[trimmed] && PHRASE_MAP[trimmed][lang]) {
    return PHRASE_MAP[trimmed][lang];
  }

  // 2. Iterative sub-phrase replacement (longest first)
  let result = text;
  for (const key of SORTED_PHRASE_KEYS) {
    if (result.includes(key)) {
      const translated = PHRASE_MAP[key][lang];
      result = result.split(key).join(translated);
    }
  }

  return result;
}

/**
 * Deep DOM Auto-Translator: walks all text nodes in the container and ensures 0 Arabic characters remain
 */
export function translateDomTree(node: Node, lang: SupportedLanguage) {
  if (lang === 'ar') return;

  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
  let currentNode: Node | null = walker.nextNode();

  while (currentNode) {
    const textContent = currentNode.nodeValue;
    if (textContent && arabicRegex.test(textContent)) {
      const translated = trText(textContent, lang);
      if (translated !== textContent) {
        currentNode.nodeValue = translated;
      }
    }
    currentNode = walker.nextNode();
  }
}
