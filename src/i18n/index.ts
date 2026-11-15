import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export interface LanguageOption {
  code: string;
  label: string;
  nativeLabel: string;
  locale: string;
  rtl?: boolean;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', locale: 'en-IN' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', locale: 'hi-IN' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी', locale: 'mr-IN' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી', locale: 'gu-IN' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা', locale: 'bn-IN' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', locale: 'ta-IN' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు', locale: 'te-IN' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', locale: 'kn-IN' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം', locale: 'ml-IN' },
  { code: 'pa', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ', locale: 'pa-IN' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', locale: 'es-ES' },
  { code: 'fr', label: 'French', nativeLabel: 'Français', locale: 'fr-FR' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', locale: 'ar-AE', rtl: true },
];

const resources = {
  en: {
    translation: {
      brand: 'MediLink Vault',
      tagline: 'One QR Code. Zero Lost Files. Instant AI Clinical Clarity.',
      nav: {
        dashboard: 'Overview',
        vault: 'Medical Vault',
        compare: 'Report Comparison',
        companion: 'AI Companion',
        family: 'Family Vault',
        consent: 'Consent & Access',
        services: 'Services & Support',
        billing: 'Plans & Billing',
        doctorDesk: 'Clinical Desk',
        hospitalConsole: 'Hospital Admin',
        labPortal: 'Diagnostic Lab',
        superAdmin: 'Platform Admin',
      },
      common: {
        signOut: 'Sign Out',
        loading: 'Loading clinical data…',
        healthId: 'Health ID',
        dynamicQr: 'Dynamic QR',
        printCard: 'Print Health ID Card',
        sendSmsId: 'Send ID via SMS',
        uploadRecord: 'Upload Record',
        verified: 'Verified',
        demoBadge: 'Synthetic Demo Record',
        noRecords: 'No medical records match your current filter.',
        searchPlaceholder: 'Search reports, hospitals, labs, or medications…',
        language: 'Language',
      },
      patient: {
        welcome: 'Patient Health Workspace',
        recordsStored: 'Verified Records',
        activeConsents: 'Active Authorizations',
        upcomingVisits: 'Upcoming Visits',
        quickActions: 'Quick Clinical Actions',
        showQr: 'Show Sharing QR',
        compareTests: 'Compare Lab Trends',
        askCompanion: 'Explain My Reports',
      },
    },
  },
  hi: {
    translation: {
      brand: 'मेडिलिंक वॉल्ट',
      tagline: 'एक क्यूआर कोड। कोई खोई हुई फ़ाइल नहीं। त्वरित एआई क्लिनिकल स्पष्टता।',
      nav: {
        dashboard: 'सारांश',
        vault: 'मेडिकल वॉल्ट',
        compare: 'रिपोर्ट तुलना',
        companion: 'एआई साथी',
        family: 'परिवार वॉल्ट',
        consent: 'सहमति और लॉग',
        services: 'सेवाएं और सहायता',
        billing: 'प्लान और बिलिंग',
        doctorDesk: 'डॉक्टर डेस्क',
        hospitalConsole: 'अस्पताल प्रशासन',
        labPortal: 'डायग्नोस्टिक लैब',
        superAdmin: 'प्लेटफ़ॉर्म एडमिन',
      },
      common: {
        signOut: 'साइन आउट',
        loading: 'डेटा लोड हो रहा है…',
        healthId: 'हेल्थ आईडी',
        dynamicQr: 'डायनामिक क्यूआर',
        printCard: 'हेल्थ आईडी कार्ड प्रिंट करें',
        sendSmsId: 'SMS द्वारा आईडी भेजें',
        uploadRecord: 'रिकॉर्ड अपलोड करें',
        verified: 'सत्यापित',
        demoBadge: 'सिंथेटिक डेमो रिकॉर्ड',
        noRecords: 'वर्तमान फ़िल्टर से कोई मेडिकल रिकॉर्ड मेल नहीं खाता।',
        searchPlaceholder: 'रिपोर्ट, अस्पताल, लैब या दवाएं खोजें…',
        language: 'भाषा',
      },
      patient: {
        welcome: 'रोगी स्वास्थ्य कार्यक्षेत्र',
        recordsStored: 'सत्यापित रिकॉर्ड',
        activeConsents: 'सक्रिय अनुमतियाँ',
        upcomingVisits: 'आगामी अपॉइंटमेंट',
        quickActions: 'त्वरित कार्य',
        showQr: 'शेयरिंग क्यूआर दिखाएं',
        compareTests: 'लैब ट्रेंड तुलना करें',
        askCompanion: 'मेरी रिपोर्ट समझें',
      },
    },
  },
  mr: {
    translation: {
      brand: 'मेडिलिंक वॉल्ट',
      tagline: 'एक क्यूआर कोड. कोणतीही हरवलेली फाईल नाही. त्वरित AI वैद्यकीय स्पष्टता.',
      nav: {
        dashboard: 'सारांश',
        vault: 'मेडिकल वॉल्ट',
        compare: 'अहवाल तुलना',
        companion: 'AI साथी',
        family: 'कुटुंब वॉल्ट',
        consent: 'संमती आणि नोंदी',
        services: 'सेवा आणि मदत',
        billing: 'प्लॅन आणि बिलिंग',
        doctorDesk: 'डॉक्टर डेस्क',
        hospitalConsole: 'रुग्णालय प्रशासन',
        labPortal: 'निदान प्रयोगशाळा',
        superAdmin: 'प्लॅटफॉर्म प्रशासक',
      },
      common: {
        signOut: 'साइन आउट',
        loading: 'माहिती लोड होत आहे…',
        healthId: 'हेल्थ आयडी',
        dynamicQr: 'डायनॅमिक QR',
        printCard: 'हेल्थ आयडी कार्ड प्रिंट करा',
        sendSmsId: 'SMS द्वारे आयडी पाठवा',
        uploadRecord: 'अहवाल अपलोड करा',
        verified: 'सत्यापित',
        demoBadge: 'डेमो नमुना नोंद',
        noRecords: 'कोणतेही वैद्यकीय अहवाल सापडले नाहीत.',
        searchPlaceholder: 'अहवाल, रुग्णालय किंवा औषधे शोधा…',
        language: 'भाषा',
      },
      patient: {
        welcome: 'रुग्ण आरोग्य कार्यक्षेत्र',
        recordsStored: 'सत्यापित अहवाल',
        activeConsents: 'सक्रिय संमती',
        upcomingVisits: 'आगामी भेटी',
        quickActions: 'त्वरित कृती',
        showQr: 'शेअरिंग QR दाखवा',
        compareTests: 'चाचणी तुलना पहा',
        askCompanion: 'अहवाल सोप्या भाषेत पहा',
      },
    },
  },
  gu: {
    translation: {
      brand: 'મેડિલિંક વૉલ્ટ',
      nav: { dashboard: 'સારાંશ', vault: 'મેડિકલ વૉલ્ટ', compare: 'રિપોર્ટ સરખામણી', companion: 'AI સાથી', family: 'કુટુંબ વૉલ્ટ', consent: 'સંમતિ', services: 'સેવાઓ અને મદદ', billing: 'બિલિંગ' },
      common: { signOut: 'સાઇન આઉટ', healthId: 'હેલ્થ ID', uploadRecord: 'રિપોર્ટ અપલોડ કરો', language: 'ભાષા' },
      patient: { welcome: 'દર્દી આરોગ્ય કાર્યક્ષેત્ર', recordsStored: 'ચકાસાયેલ રેકોર્ડ્સ', activeConsents: 'સક્રિય મંજૂરીઓ', upcomingVisits: 'આગામી મુલાકાતો' },
    },
  },
  bn: {
    translation: {
      brand: 'মেডিলিংক ভল্ট',
      nav: { dashboard: 'সারাংশ', vault: 'মেডিকেল ভল্ট', compare: 'রিপোর্ট তুলনা', companion: 'AI সহায়ক', family: 'পরিবার ভল্ট', consent: 'সম্মতি ও লগ', services: 'সেবা ও সহায়তা', billing: 'বিলিং' },
      common: { signOut: 'সাইন আউট', healthId: 'হেলথ আইডি', uploadRecord: 'রেকর্ড আপলোড করুন', language: 'ভাষা' },
      patient: { welcome: 'রোগীর স্বাস্থ্য কর্মক্ষেত্র', recordsStored: 'যাচাইকৃত রেকর্ড', activeConsents: 'সক্রিয় অনুমতি', upcomingVisits: 'আসন্ন অ্যাপয়েন্টমেন্ট' },
    },
  },
  ta: {
    translation: {
      brand: 'மெடிலிங்க் வால்ட்',
      nav: { dashboard: 'சுருக்கம்', vault: 'மருத்துவ பெட்டகம்', compare: 'அறிக்கை ஒப்பீடு', companion: 'AI துணை', family: 'குடும்ப பெட்டகம்', consent: 'ஒப்புதல்', services: 'சேவைகள் & உதவி', billing: 'கட்டணம்' },
      common: { signOut: 'வெளியேறு', healthId: 'ஹெல்த் ஐடி', uploadRecord: 'பதிவேற்று', language: 'மொழி' },
      patient: { welcome: 'நோயாளர் நல பணியிடம்', recordsStored: 'சரிபார்க்கப்பட்ட பதிவுகள்', activeConsents: 'செயலில் உள்ள அனுமதிகள்', upcomingVisits: 'வரவிருக்கும் சந்திப்புகள்' },
    },
  },
  te: {
    translation: {
      brand: 'మెడిలింక్ వాల్ట్',
      nav: { dashboard: 'సారాంశం', vault: 'మెడికల్ వాల్ట్', compare: 'నివేదిక పోలిక', companion: 'AI సహాయకుడు', family: 'కుటుంబ వాల్ట్', consent: 'సమ్మతి', services: 'సేవలు & మద్దతు', billing: 'బిల్లింగ్' },
      common: { signOut: 'సైన్ అవుట్', healthId: 'హెల్త్ ID', uploadRecord: 'రికార్డ్ అప్‌లోడ్', language: 'భాష' },
      patient: { welcome: 'రోగి ఆరోగ్య కార్యక్షేత్రం', recordsStored: 'ధృవీకరించిన రికార్డులు', activeConsents: 'సక్రియ అనుమతులు', upcomingVisits: 'రాబోయే అపాయింట్‌మెంట్లు' },
    },
  },
  kn: {
    translation: {
      brand: 'ಮೆಡಿಲಿಂಕ್ ವಾಲ್ಟ್',
      nav: { dashboard: 'ಸಾರಾಂಶ', vault: 'ವೈದ್ಯಕೀಯ ವಾಲ್ಟ್', compare: 'ವರದಿ ಹೋಲಿಕೆ', companion: 'AI ಸಂಗಾತಿ', family: 'ಕುಟುಂಬ ವಾಲ್ಟ್', consent: 'ಸಮ್ಮತಿ', services: 'ಸೇವೆಗಳು ಮತ್ತು ಸಹಾಯ', billing: 'ಬಿಲ್ಲಿಂಗ್' },
      common: { signOut: 'ಸೈನ್ ಔಟ್', healthId: 'ಹೆಲ್ತ್ ಐಡಿ', uploadRecord: 'ವರದಿ ಅಪ್‌ಲೋಡ್', language: 'ಭಾಷೆ' },
      patient: { welcome: 'ರೋಗಿಯ ಆರೋಗ್ಯ ಕಾರ್ಯಕ್ಷೇತ್ರ', recordsStored: 'ಪರಿಶೀಲಿಸಿದ ದಾಖಲೆಗಳು', activeConsents: 'ಸಕ್ರಿಯ ಅನುಮತಿಗಳು', upcomingVisits: 'ಮುಂಬರುವ ಭೇಟಿಗಳು' },
    },
  },
  ml: {
    translation: {
      brand: 'മെഡിലിങ്ക് വോൾട്ട്',
      nav: { dashboard: 'സംഗ്രഹം', vault: 'മെഡിക്കൽ വോൾട്ട്', compare: 'റിപ്പോർട്ട് താരതമ്യം', companion: 'AI സഹായി', family: 'കുടുംബ വോൾട്ട്', consent: 'സമ്മതം', services: 'സേവനങ്ങളും സഹായവും', billing: 'ബില്ലിംഗ്' },
      common: { signOut: 'സൈൻ ഔട്ട്', healthId: 'ഹെൽത്ത് ഐഡി', uploadRecord: 'അപ്‌ലോഡ് ചെയ്യുക', language: 'ഭാഷ' },
      patient: { welcome: 'രോഗി ആരോഗ്യ വർക്ക്‌സ്‌പെയ്‌സ്', recordsStored: 'പരിശോധിച്ച രേഖകൾ', activeConsents: 'സജീവ അനുമതികൾ', upcomingVisits: 'വരാനിരിക്കുന്ന സന്ദർശനങ്ങൾ' },
    },
  },
  pa: {
    translation: {
      brand: 'ਮੈਡੀਲਿੰਕ ਵਾਲਟ',
      nav: { dashboard: 'ਸੰਖੇਪ', vault: 'ਮੈਡੀਕਲ ਵਾਲਟ', compare: 'ਰਿਪੋਰਟ ਤੁਲਨਾ', companion: 'AI ਸਾਥੀ', family: 'ਪਰਿਵਾਰ ਵਾਲਟ', consent: 'ਸਹਿਮਤੀ', services: 'ਸੇਵਾਵਾਂ ਅਤੇ ਮਦਦ', billing: 'ਬਿਲਿੰਗ' },
      common: { signOut: 'ਸਾਈਨ ਆਉਟ', healthId: 'ਹੈਲਥ ਆਈਡੀ', uploadRecord: 'ਰਿਕਾਰਡ ਅੱਪਲੋਡ ਕਰੋ', language: 'ਭਾਸ਼ਾ' },
      patient: { welcome: 'ਮਰੀਜ਼ ਸਿਹਤ ਵਰਕਸਪੇਸ', recordsStored: 'ਪ੍ਰਮਾਣਿਤ ਰਿਕਾਰਡ', activeConsents: 'ਸਰਗਰਮ ਮਨਜ਼ੂਰੀਆਂ', upcomingVisits: 'ਆਉਣ ਵਾਲੀਆਂ ਮੁਲਾਕਾਤਾਂ' },
    },
  },
  es: {
    translation: {
      brand: 'MediLink Vault',
      nav: { dashboard: 'Resumen', vault: 'Bóveda Médica', compare: 'Comparar Informes', companion: 'Asistente IA', family: 'Bóveda Familiar', consent: 'Consentimiento', services: 'Servicios y Soporte', billing: 'Planes y Pagos' },
      common: { signOut: 'Cerrar sesión', healthId: 'ID de Salud', uploadRecord: 'Subir Documento', language: 'Idioma' },
      patient: { welcome: 'Espacio de Salud del Paciente', recordsStored: 'Registros Verificados', activeConsents: 'Autorizaciones Activas', upcomingVisits: 'Próximas Citas' },
    },
  },
  fr: {
    translation: {
      brand: 'MediLink Vault',
      nav: { dashboard: 'Aperçu', vault: 'Coffre Médical', compare: 'Comparaison', companion: 'Compagnon IA', family: 'Coffre Familial', consent: 'Consentement', services: 'Services & Support', billing: 'Abonnements' },
      common: { signOut: 'Déconnexion', healthId: 'ID Santé', uploadRecord: 'Téléverser', language: 'Langue' },
      patient: { welcome: 'Espace Santé Patient', recordsStored: 'Dossiers Vérifiés', activeConsents: 'Autorisations Actives', upcomingVisits: 'Rendez-vous à Venir' },
    },
  },
  ar: {
    translation: {
      brand: 'ميدي لينك فولت',
      tagline: 'رمز استجابة سريعة واحد. لا ملفات مفقودة. وضوح سريري فوري بالذكاء الاصطناعي.',
      nav: {
        dashboard: 'نظرة عامة',
        vault: 'الخزينة الطبية',
        compare: 'مقارنة التقارير',
        companion: 'المرافق الذكي',
        family: 'خزينة العائلة',
        consent: 'الموافقة والسجل',
        services: 'الخدمات والدعم',
        billing: 'الخطط والفواتير',
        doctorDesk: 'مكتب الطبيب',
        hospitalConsole: 'إدارة المستشفى',
        labPortal: 'المختبر التشخيصي',
        superAdmin: 'إدارة المنصة',
      },
      common: {
        signOut: 'تسجيل الخروج',
        loading: 'جاري تحميل البيانات…',
        healthId: 'الهوية الصحية',
        dynamicQr: 'رمز QR ديناميكي',
        printCard: 'طباعة بطاقة الهوية الصحية',
        sendSmsId: 'إرسال الهوية عبر SMS',
        uploadRecord: 'رفع سجل طبي',
        verified: 'موثق',
        demoBadge: 'سجل تجريبي',
        noRecords: 'لا توجد سجلات طبية مطابقة.',
        searchPlaceholder: 'ابحث في التقارير أو المستشفيات أو الأدوية…',
        language: 'اللغة',
      },
      patient: {
        welcome: 'مساحة صحة المريض',
        recordsStored: 'السجلات الموثقة',
        activeConsents: 'التصاريح النشطة',
        upcomingVisits: 'المواعيد القادمة',
        quickActions: 'إجراءات سريعة',
        showQr: 'عرض رمز QR للمشاركة',
        compareTests: 'مقارنة نتائج المختبر',
        askCompanion: 'شرح تقاريري',
      },
    },
  },
};

const savedLang = typeof window !== 'undefined' ? localStorage.getItem('medilink_lang') || 'en' : 'en';

export function applyDocumentDirection(langCode: string) {
  if (typeof document === 'undefined') return;
  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
  document.documentElement.dir = lang?.rtl ? 'rtl' : 'ltr';
  document.documentElement.lang = langCode;
}

applyDocumentDirection(savedLang);

i18n.use(initReactI18next).init({
  resources,
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function formatRegionalDate(dateStr: string, langCode: string): string {
  try {
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat(lang?.locale || 'en-IN', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function formatRegionalCurrency(amountCents: number, currency: string, langCode: string): string {
  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
  return new Intl.NumberFormat(lang?.locale || 'en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

export default i18n;
