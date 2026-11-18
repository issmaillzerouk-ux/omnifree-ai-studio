// ============================================================================
// i18n — Bilingual EN/AR translations
// ============================================================================

import type { Language } from '@/types';

export interface Translation {
  appTitle: string;
  appSubtitle: string;
  chat: string;
  knowledge: string;
  providers: string;
  personas: string;
  promptLibrary: string;
  settings: string;
  sendMessage: string;
  typeMessage: string;
  stop: string;
  clearChat: string;
  uploadFile: string;
  dragDropHere: string;
  dragDropOr: string;
  browse: string;
  supportedFormats: string;
  processing: string;
  ready: string;
  error: string;
  chunks: string;
  enabled: string;
  disabled: string;
  enable: string;
  disable: string;
  remove: string;
  documentName: string;
  status: string;
  actions: string;
  noDocuments: string;
  noDocumentsDesc: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  priority: string;
  addProvider: string;
  providerName: string;
  noProviders: string;
  noProvidersDesc: string;
  activePersona: string;
  selectPersona: string;
  systemPrompt: string;
  personaName: string;
  personaDesc: string;
  addPersona: string;
  promptTitle: string;
  promptBody: string;
  promptCategory: string;
  addPrompt: string;
  noPrompts: string;
  language: string;
  theme: string;
  light: string;
  dark: string;
  ragActive: string;
  ragInactive: string;
  ragUsedBadge: string;
  providerLabel: string;
  thinking: string;
  uploadError: string;
  fileTooLarge: string;
  passwordProtected: string;
  unknownFormat: string;
  totalDocuments: string;
  activeDocuments: string;
  totalChunks: string;
  contextPreview: string;
  closePanel: string;
  searchPlaceholder: string;
  searchPrompt: string;
  dataBackup: string;
  backupDesc: string;
  exportBackup: string;
  importBackup: string;
  includeApiKeys: string;
  includeApiKeysDesc: string;
  encryptBackup: string;
  backupPassword: string;
  backupPasswordDesc: string;
  restoreMode: string;
  mergeMode: string;
  mergeModeDesc: string;
  overwriteMode: string;
  overwriteModeDesc: string;
  dropBackupHere: string;
  importing: string;
  importSuccess: string;
  importFailed: string;
  invalidBackup: string;
  wrongPassword: string;
  storageUsed: string;
  storageOf: string;
  factoryReset: string;
  factoryResetDesc: string;
  factoryResetConfirm: string;
  confirm: string;
  cancel: string;
  backupExported: string;
  newerVersion: string;
  addedItem: string;
  updatedItem: string;
  autoRotate: string;
  manual: string;
  attachedFile: string;
  uploadPptx: string;
  uploadPdf: string;
  uploadDocText: string;
  uploadImage: string;
  insertPrompt: string;
  parsingFile: string;
  noActiveProvider: string;
  imageAttached: string;
  getKey: string;
  testSaveKey: string;
  keyValid: string;
  keyInvalid: string;
  syncModelsNow: string;
  lastSync: string;
  neverSynced: string;
  healthyProviders: string;
  openRouterGateway: string;
  oneKeyAllModels: string;
  or_all: string;
  or_claude: string;
  or_chatgpt: string;
  or_gemini: string;
  or_deepseek: string;
  connectedApps: string;
  connectedAppsDesc: string;
  connect: string;
  connected: string;
  disconnect: string;
  getKey: string;
  connectorKeyPlaceholder: string;
  saveKey: string;
  modeChat: string;
  modeImage: string;
  modeVideo: string;
  aspectRatio: string;
  videoMode: string;
  aiVideo: string;
  motionStoryboard: string;
  generatingImage: string;
  generatingStoryboard: string;
  webContextJina: string;
  webContextKnowledge: string;
  webContextTavily: string;
  downloadPng: string;
  play: string;
  pause: string;
  narrationOn: string;
  narrationOff: string;
  downloadHtml: string;
  sceneOf: string;
  sendToAutomation: string;
  sentToAutomation: string;
  automationSent: string;
  automationFailed: string;
  exportGist: string;
  gistCreated: string;
  exportNotion: string;
  notionCreated: string;
  zeroKey: string;
  portalKey: string;
}

const en: Translation = {
  appTitle: 'OmniFree AI Studio',
  appSubtitle: 'Phase 8 — Local File & Document Analyzer',
  chat: 'Chat',
  knowledge: 'Knowledge',
  providers: 'Providers',
  personas: 'Personas',
  promptLibrary: 'Prompt Library',
  settings: 'Settings',
  sendMessage: 'Send',
  typeMessage: 'Type your message…',
  stop: 'Stop',
  clearChat: 'Clear chat',
  uploadFile: 'Upload File',
  dragDropHere: 'Drag & drop files here',
  dragDropOr: 'or',
  browse: 'Browse files',
  supportedFormats: 'Supported: PDF, DOCX, TXT, MD (max 20MB)',
  processing: 'Processing…',
  ready: 'Ready',
  error: 'Error',
  chunks: 'chunks',
  enabled: 'Enabled',
  disabled: 'Disabled',
  enable: 'Enable',
  disable: 'Disable',
  remove: 'Remove',
  documentName: 'Document',
  status: 'Status',
  actions: 'Actions',
  noDocuments: 'No documents uploaded',
  noDocumentsDesc: 'Upload files to build your local knowledge base. Documents are processed entirely in your browser.',
  apiKey: 'API Key',
  baseUrl: 'Base URL',
  model: 'Model',
  priority: 'Priority',
  addProvider: 'Add Provider',
  providerName: 'Provider Name',
  noProviders: 'No providers configured',
  noProvidersDesc: 'Add an API key to at least one provider to start chatting.',
  activePersona: 'Active Persona',
  selectPersona: 'Select a persona',
  systemPrompt: 'System Prompt',
  personaName: 'Persona Name',
  personaDesc: 'Description',
  addPersona: 'Add Persona',
  promptTitle: 'Title',
  promptBody: 'Body',
  promptCategory: 'Category',
  addPrompt: 'Add Prompt',
  noPrompts: 'No saved prompts',
  language: 'Language',
  theme: 'Theme',
  light: 'Light',
  dark: 'Dark',
  ragActive: 'RAG: Active',
  ragInactive: 'RAG: Off',
  ragUsedBadge: 'RAG',
  providerLabel: 'Provider',
  thinking: 'Thinking…',
  uploadError: 'Upload error',
  fileTooLarge: 'File is too large (max 20MB)',
  passwordProtected: 'Password-protected file',
  unknownFormat: 'Unsupported format',
  totalDocuments: 'Total Documents',
  activeDocuments: 'Active Documents',
  totalChunks: 'Total Chunks',
  contextPreview: 'Context Preview',
  closePanel: 'Close',
  searchPlaceholder: 'Search prompts…',
  searchPrompt: 'Search prompt',
  dataBackup: 'Data & Backup',
  backupDesc: 'Export or restore your entire workspace: chats, documents, personas, prompts and providers.',
  exportBackup: 'Export Backup',
  importBackup: 'Import Backup',
  includeApiKeys: 'Include API keys in backup',
  includeApiKeysDesc: 'Warning: your provider API keys will be written into the backup file in plain text. Only enable this if you store the file securely.',
  encryptBackup: 'Encrypt backup with a password',
  backupPassword: 'Backup password',
  backupPasswordDesc: 'Uses AES-256 encryption. You will need this password to restore the backup.',
  restoreMode: 'Restore mode',
  mergeMode: 'Merge',
  mergeModeDesc: 'Keep existing data and add new items from the backup.',
  overwriteMode: 'Overwrite',
  overwriteModeDesc: 'Erase all current data and replace it with the backup.',
  dropBackupHere: 'Drop your .json backup here',
  importing: 'Restoring…',
  importSuccess: 'Backup restored successfully',
  importFailed: 'Import failed',
  invalidBackup: 'Invalid backup file',
  wrongPassword: 'Wrong password or corrupted backup',
  storageUsed: 'Storage used',
  storageOf: 'of',
  factoryReset: 'Factory Reset',
  factoryResetDesc: 'Permanently delete all chats, documents, personas, prompts and provider keys from this browser.',
  factoryResetConfirm: 'This will permanently delete ALL local data. This cannot be undone. Continue?',
  confirm: 'Confirm',
  cancel: 'Cancel',
  backupExported: 'Backup file downloaded',
  newerVersion: 'This backup was created by a newer app version',
  addedItem: 'added',
  updatedItem: 'updated',
  autoRotate: 'Auto',
  manual: 'Manual',
  attachedFile: 'Attached file',
  uploadPptx: 'Upload Presentation (.pptx)',
  uploadPdf: 'Upload PDF Document',
  uploadDocText: 'Upload Word / Text / Data',
  uploadImage: 'Upload Image (Vision / OCR)',
  insertPrompt: 'Insert Prompt Template',
  parsingFile: 'Parsing file…',
  noActiveProvider: 'No active provider',
  imageAttached: 'Image attached',
  getKey: 'Get API Key',
  testSaveKey: 'Test & Save Key',
  keyValid: 'Key valid',
  keyInvalid: 'Key invalid',
  syncModelsNow: 'Sync Models Now',
  lastSync: 'Last sync',
  neverSynced: 'never',
  healthyProviders: 'healthy providers',
  openRouterGateway: 'OpenRouter Unified Gateway',
  oneKeyAllModels: 'one key, all Claude / GPT / Gemini / DeepSeek free models',
  or_all: 'All Free',
  or_claude: 'Claude',
  or_chatgpt: 'ChatGPT',
  or_gemini: 'Gemini',
  or_deepseek: 'DeepSeek',
  connectedApps: 'Connected Apps',
  connectedAppsDesc: 'One-click web services, media engines and automations. Zero-key services are pre-connected.',
  connect: 'Connect',
  connected: 'Connected ✓',
  disconnect: 'Disconnect',
  connectorKeyPlaceholder: 'Paste key or URL…',
  saveKey: 'Connect',
  modeChat: 'Chat / Web',
  modeImage: 'Generate Image',
  modeVideo: 'Generate Video',
  aspectRatio: 'Aspect ratio',
  videoMode: 'Video mode',
  aiVideo: 'AI Video',
  motionStoryboard: 'Narrated Motion Storyboard',
  generatingImage: 'Generating image…',
  generatingStoryboard: 'Directing storyboard…',
  webContextJina: 'Web read',
  webContextKnowledge: 'Knowledge',
  webContextTavily: 'Web search',
  downloadPng: 'Download PNG',
  play: 'Play',
  pause: 'Pause',
  narrationOn: 'Voice on',
  narrationOff: 'Voice off',
  downloadHtml: 'Download Motion HTML',
  sceneOf: 'Scene',
  sendToAutomation: 'Send to Automation',
  sentToAutomation: 'Send to Automation',
  automationSent: 'Sent to automation ✓',
  automationFailed: 'Automation failed',
  exportGist: 'Export to GitHub',
  gistCreated: 'Gist created — check your GitHub',
  exportNotion: 'Send to Notion',
  notionCreated: 'Page created in Notion',
  zeroKey: 'Zero-key',
  portalKey: 'Key required',
};

const ar: Translation = {
  appTitle: 'أومني فري AI استوديو',
  appSubtitle: 'المرحلة 8 — محلل الملفات والمستندات المحلي',
  chat: 'المحادثة',
  knowledge: 'المعرفة',
  providers: 'المزودون',
  personas: 'الشخصيات',
  promptLibrary: 'مكتبة الأوامر',
  settings: 'الإعدادات',
  sendMessage: 'إرسال',
  typeMessage: 'اكتب رسالتك…',
  stop: 'إيقاف',
  clearChat: 'مسح المحادثة',
  uploadFile: 'رفع ملف',
  dragDropHere: 'اسحب وأفلت الملفات هنا',
  dragDropOr: 'أو',
  browse: 'تصفح الملفات',
  supportedFormats: 'المدعوم: PDF, DOCX, TXT, MD (بحد أقصى 20 ميجابايت)',
  processing: 'جارٍ المعالجة…',
  ready: 'جاهز',
  error: 'خطأ',
  chunks: 'أجزاء',
  enabled: 'مفعّل',
  disabled: 'معطّل',
  enable: 'تفعيل',
  disable: 'تعطيل',
  remove: 'إزالة',
  documentName: 'المستند',
  status: 'الحالة',
  actions: 'إجراءات',
  noDocuments: 'لا توجد مستندات مرفوعة',
  noDocumentsDesc: 'ارفع ملفات لبناء قاعدة معرفتك المحلية. تتم المعالجة بالكامل في متصفحك.',
  apiKey: 'مفتاح API',
  baseUrl: 'عنوان URL الأساسي',
  model: 'النموذج',
  priority: 'الأولوية',
  addProvider: 'إضافة مزود',
  providerName: 'اسم المزود',
  noProviders: 'لا يوجد مزودون مكونون',
  noProvidersDesc: 'أضف مفتاح API لمزود واحد على الأقل لبدء المحادثة.',
  activePersona: 'الشخصية النشطة',
  selectPersona: 'اختر شخصية',
  systemPrompt: 'أمر النظام',
  personaName: 'اسم الشخصية',
  personaDesc: 'الوصف',
  addPersona: 'إضافة شخصية',
  promptTitle: 'العنوان',
  promptBody: 'المحتوى',
  promptCategory: 'الفئة',
  addPrompt: 'إضافة أمر',
  noPrompts: 'لا توجد أوامر محفوظة',
  language: 'اللغة',
  theme: 'السمة',
  light: 'فاتح',
  dark: 'داكن',
  ragActive: 'RAG: نشط',
  ragInactive: 'RAG: متوقف',
  ragUsedBadge: 'RAG',
  providerLabel: 'المزود',
  thinking: 'جارٍ التفكير…',
  uploadError: 'خطأ في الرفع',
  fileTooLarge: 'الملف كبير جدًا (الحد الأقصى 20 ميجابايت)',
  passwordProtected: 'ملف محمي بكلمة مرور',
  unknownFormat: 'صيغة غير مدعومة',
  totalDocuments: 'إجمالي المستندات',
  activeDocuments: 'المستندات النشطة',
  totalChunks: 'إجمالي الأجزاء',
  contextPreview: 'معاينة السياق',
  closePanel: 'إغلاق',
  searchPlaceholder: 'ابحث في الأوامر…',
  searchPrompt: 'البحث في الأوامر',
  dataBackup: 'البيانات والنسخ الاحتياطي',
  backupDesc: 'صدّر أو استعد مساحة عملك بالكامل: المحادثات، المستندات، الشخصيات، الأوامر والمزودين.',
  exportBackup: 'تصدير نسخة احتياطية',
  importBackup: 'استيراد نسخة احتياطية',
  includeApiKeys: 'تضمين مفاتيح API في النسخة الاحتياطية',
  includeApiKeysDesc: 'تحذير: ستُكتب مفاتيح API الخاصة بك في ملف النسخة الاحتياطية كنص صريح. فعّل هذا الخيار فقط إذا كنت تحفظ الملف في مكان آمن.',
  encryptBackup: 'تشفير النسخة الاحتياطية بكلمة مرور',
  backupPassword: 'كلمة مرور النسخة الاحتياطية',
  backupPasswordDesc: 'يستخدم تشفير AES-256. ستحتاج إلى هذه الكلمة لاستعادة النسخة الاحتياطية.',
  restoreMode: 'وضع الاستعادة',
  mergeMode: 'دمج',
  mergeModeDesc: 'الاحتفاظ بالبيانات الحالية وإضافة العناصر الجديدة من النسخة الاحتياطية.',
  overwriteMode: 'استبدال',
  overwriteModeDesc: 'حذف جميع البيانات الحالية واستبدالها بالنسخة الاحتياطية.',
  dropBackupHere: 'أفلت ملف النسخة الاحتياطية .json هنا',
  importing: 'جارٍ الاستعادة…',
  importSuccess: 'تمت استعادة النسخة الاحتياطية بنجاح',
  importFailed: 'فشل الاستيراد',
  invalidBackup: 'ملف نسخة احتياطية غير صالح',
  wrongPassword: 'كلمة مرور خاطئة أو نسخة احتياطية تالفة',
  storageUsed: 'المساحة المستخدمة',
  storageOf: 'من',
  factoryReset: 'إعادة ضبط المصنع',
  factoryResetDesc: 'حذف جميع المحادثات والمستندات والشخصيات والأوامر ومفاتيح المزودين من هذا المتصفح نهائيًا.',
  factoryResetConfirm: 'سيتم حذف جميع البيانات المحلية نهائيًا. لا يمكن التراجع عن هذا الإجراء. هل تريد المتابعة؟',
  confirm: 'تأكيد',
  cancel: 'إلغاء',
  backupExported: 'تم تنزيل ملف النسخة الاحتياطية',
  newerVersion: 'تم إنشاء هذه النسخة الاحتياطية بإصدار أحدث من التطبيق',
  addedItem: 'مضاف',
  updatedItem: 'محدّث',
  autoRotate: 'تلقائي',
  manual: 'يدوي',
  attachedFile: 'ملف مرفق',
  uploadPptx: 'رفع عرض تقديمي (PowerPoint)',
  uploadPdf: 'رفع مستند PDF',
  uploadDocText: 'رفع Word / نص / بيانات',
  uploadImage: 'رفع صورة (رؤية / OCR)',
  insertPrompt: 'إدراج قالب أمر',
  parsingFile: 'جارٍ تحليل الملف…',
  noActiveProvider: 'لا يوجد مزود نشط',
  imageAttached: 'صورة مرفقة',
  getKey: 'احصل على مفتاح API',
  testSaveKey: 'اختبار وحفظ المفتاح',
  keyValid: 'المفتاح صالح',
  keyInvalid: 'المفتاح غير صالح',
  syncModelsNow: 'مزامنة النماذج الآن',
  lastSync: 'آخر مزامنة',
  neverSynced: 'أبدًا',
  healthyProviders: 'مزودون سليمون',
  openRouterGateway: 'بوابة OpenRouter الموحدة',
  oneKeyAllModels: 'مفتاح واحد، كل نماذج Claude / GPT / Gemini / DeepSeek المجانية',
  or_all: 'كل المجانية',
  or_claude: 'Claude',
  or_chatgpt: 'ChatGPT',
  or_gemini: 'Gemini',
  or_deepseek: 'DeepSeek',
  connectedApps: 'التطبيقات المتصلة',
  connectedAppsDesc: 'خدمات ويب ومحركات وسائط وأتمتة بنقرة واحدة. الخدمات بدون مفتاح متصلة مسبقًا.',
  connect: 'اتصال',
  connected: 'متصل ✓',
  disconnect: 'قطع الاتصال',
  connectorKeyPlaceholder: 'الصق المفتاح أو الرابط…',
  saveKey: 'اتصال',
  modeChat: 'محادثة / ويب',
  modeImage: 'توليد صورة',
  modeVideo: 'توليد فيديو',
  aspectRatio: 'نسبة العرض',
  videoMode: 'وضع الفيديو',
  aiVideo: 'فيديو ذكاء اصطناعي',
  motionStoryboard: 'لوحة حركة سرديّة',
  generatingImage: 'جارٍ توليد الصورة…',
  generatingStoryboard: 'جارٍ إخراج اللوحة…',
  webContextJina: 'قراءة ويب',
  webContextKnowledge: 'معرفة',
  webContextTavily: 'بحث ويب',
  downloadPng: 'تنزيل PNG',
  play: 'تشغيل',
  pause: 'إيقاف مؤقت',
  narrationOn: 'الصوت مفعّل',
  narrationOff: 'الصوت متوقف',
  downloadHtml: 'تنزيل HTML متحرك',
  sceneOf: 'مشهد',
  sendToAutomation: 'إرسال إلى الأتمتة',
  sentToAutomation: 'إرسال إلى الأتمتة',
  automationSent: 'تم الإرسال إلى الأتمتة ✓',
  automationFailed: 'فشلت الأتمتة',
  exportGist: 'تصدير إلى GitHub',
  gistCreated: 'تم إنشاء Gist — تحقق من GitHub',
  exportNotion: 'إرسال إلى Notion',
  notionCreated: 'تم إنشاء الصفحة في Notion',
  zeroKey: 'بدون مفتاح',
  portalKey: 'يتطلب مفتاحًا',
};

const translations: Record<Language, Translation> = { en, ar };

export function getTranslation(lang: Language): Translation {
  return translations[lang];
}
