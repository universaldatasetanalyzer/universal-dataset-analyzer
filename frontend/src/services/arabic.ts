const translations: Record<string, string> = {
  'Dashboard': 'لوحة التحكم', 'Upload Dataset': 'رفع البيانات', 'Dataset Summary': 'ملخص البيانات',
  'Data Quality': 'جودة البيانات', 'Cleaning Wizard': 'معالج تنظيف البيانات', 'Data Cleaning': 'تنظيف البيانات',
  'Visualizations': 'الرسوم البيانية', 'AI Insights': 'رؤى الذكاء الاصطناعي', 'Chat with Data': 'محادثة مع البيانات',
  'Reports': 'التقارير', 'Billing': 'الفوترة', 'Team': 'الفريق', 'Settings': 'الإعدادات',
  'Main': 'الرئيسية', 'Analysis': 'التحليل', 'Workspace': 'مساحة العمل', 'Home': 'الرئيسية',
  'No dataset selected': 'لم يتم اختيار مجموعة بيانات', 'Select a dataset': 'اختر مجموعة بيانات',
  'Upload a dataset first to see quality metrics.': 'ارفع مجموعة بيانات أولًا لعرض مؤشرات الجودة.',
  'Upload a dataset to visualize its data.': 'ارفع مجموعة بيانات لعرض رسومها البيانية.',
  'Go to the Upload page to upload a dataset first.': 'انتقل إلى صفحة رفع البيانات لرفع مجموعة بيانات أولًا.',
  'Analyzing dataset...': 'جارٍ تحليل مجموعة البيانات...', 'Analyzing data quality...': 'جارٍ تحليل جودة البيانات...',
  'Generating visualizations...': 'جارٍ إنشاء الرسوم البيانية...', 'Generating AI insights...': 'جارٍ إنشاء الرؤى...',
  'This may take a moment for large files.': 'قد يستغرق ذلك لحظات مع الملفات الكبيرة.',
  'Analyzing your dataset, this may take a moment.': 'جارٍ تحليل مجموعة البيانات، قد يستغرق ذلك لحظات.',
  'Analyzing patterns, trends, and anomalies': 'نحلل الأنماط والاتجاهات والقيم الشاذة',
  'Retry': 'إعادة المحاولة', 'Regenerate': 'إعادة الإنشاء', 'Download': 'تنزيل', 'Upload': 'رفع',
  'Upload History': 'سجل الرفع', 'Upload Queue': 'قائمة الرفع',
  'Upload Activity': 'نشاط الرفع', 'Recent Uploads': 'آخر عمليات الرفع', 'My Datasets': 'مجموعات بياناتي',
  'Good morning, ': 'صباح الخير، ', "Here's what's happening with your datasets today.": 'إليك ما يحدث مع مجموعات بياناتك اليوم.',
  'Total Datasets': 'إجمالي مجموعات البيانات', 'Avg Health Score': 'متوسط درجة الصحة',
  'Reports Generated': 'التقارير المنشأة', 'Chat Sessions': 'جلسات المحادثة',
  'from your account': 'من حسابك', 'across all datasets': 'عبر جميع مجموعات البيانات',
  'Datasets uploaded per month': 'مجموعات البيانات المرفوعة شهريًا', 'Datasets': 'مجموعات البيانات',
  'Upload CSV, Excel, JSON, or TSV files for analysis.': 'ارفع ملفات CSV أو Excel أو JSON أو TSV لتحليلها.',
  'or ': 'أو ', ' complete': ' مكتمل', 'Demo': 'تجريبي', 'Shared': 'مشترك',
  'Shared with Me': 'تمت مشاركتها معي', 'View all': 'عرض الكل', 'View analysis': 'عرض التحليل',
  'No datasets yet': 'لا توجد مجموعات بيانات بعد', 'No datasets uploaded yet': 'لم يتم رفع مجموعات بيانات بعد',
  'Drop your files here': 'أفلت الملفات هنا', 'Drag & drop your files': 'اسحب الملفات وأفلتها هنا',
  'browse from your computer': 'تصفح من جهازك', 'Max file size: 500 MB': 'الحد الأقصى لحجم الملف: 500 ميجابايت',
  'Upgrade to Pro': 'الترقية إلى Pro', 'Uploading your own data needs Pro': 'رفع بياناتك الخاصة يتطلب Pro',
  'General Operations': 'العمليات العامة', 'Remove Duplicate Rows': 'إزالة الصفوف المكررة',
  'Delete exact duplicate records': 'حذف السجلات المكررة تمامًا', 'Drop Empty Columns': 'حذف الأعمدة الفارغة',
  'Remove columns with all null values': 'إزالة الأعمدة التي تحتوي على قيم فارغة بالكامل',
  'Column Type Distribution': 'توزيع أنواع الأعمدة', 'Health Score': 'درجة الصحة', 'Rows': 'الصفوف',
  'Columns': 'الأعمدة', 'Name': 'الاسم', 'Format': 'التنسيق', 'Size': 'الحجم', 'Status': 'الحالة',
  'Uploaded': 'تاريخ الرفع', 'Ready': 'جاهز', 'Processing': 'قيد المعالجة', 'Error': 'خطأ',
  'Summary': 'الملخص', 'Key Findings': 'أهم النتائج', 'Trends': 'الاتجاهات', 'Anomalies': 'القيم الشاذة',
  'Scatter Plot': 'مخطط التبعثر', 'Bivariate Analysis': 'تحليل ثنائي المتغيرات',
  'Box Plot': 'مخطط الصندوق', 'Statistical Distribution': 'التوزيع الإحصائي',
  'Monthly Trend': 'الاتجاه الشهري', 'Outliers': 'القيم الشاذة',
  'Correlations': 'الارتباطات', 'Recommendations': 'التوصيات', 'Executive Summary': 'الملخص التنفيذي',
  'Recommended Decisions': 'القرارات المقترحة', 'Action:': 'الإجراء:', 'Evidence:': 'الدليل:',
  'Validate:': 'التحقق:', 'Confidence:': 'درجة الثقة:', 'r-value': 'قيمة الارتباط',
  'High': 'مرتفع', 'Medium': 'متوسط', 'Low': 'منخفض', 'high impact': 'تأثير مرتفع',
  'medium impact': 'تأثير متوسط', 'low impact': 'تأثير منخفض', 'New Chat': 'محادثة جديدة',
  'Select a dataset…': 'اختر مجموعة بيانات...', 'Dataset': 'مجموعة البيانات', 'Send': 'إرسال',
  'Plans': 'الخطط', 'Choose the pace of your analysis.': 'اختر الوتيرة المناسبة لتحليلك.',
  'Prices update for your location automatically.': 'تُحدّث الأسعار تلقائيًا حسب موقعك.',
  'Payment completed': 'اكتملت عملية الدفع', 'Complete your purchase': 'أكمل عملية الشراء',
  'Secure development checkout': 'عملية دفع تجريبية آمنة', 'Cardholder name': 'اسم حامل البطاقة',
  'Card number': 'رقم البطاقة', 'Profile Information': 'معلومات الملف الشخصي', 'Full Name': 'الاسم الكامل',
  'Email Address': 'البريد الإلكتروني', 'Change Password': 'تغيير كلمة المرور', 'Current Password': 'كلمة المرور الحالية',
  'Manage billing': 'إدارة الفوترة', 'Save Changes': 'حفظ التغييرات', 'Cancel': 'إلغاء', 'Delete': 'حذف',
  'Sign in': 'تسجيل الدخول', 'Sign up': 'إنشاء حساب', 'Forgot password?': 'هل نسيت كلمة المرور؟',
  'Password': 'كلمة المرور', 'Email': 'البريد الإلكتروني', 'Welcome aboard': 'مرحبًا بك',
  'Admin Access': 'دخول المسؤول', 'Restricted area': 'منطقة مقيّدة', 'Admin username': 'اسم مستخدم المسؤول',
  'Admin password': 'كلمة مرور المسؤول', 'Active': 'نشط', 'Invited': 'مدعو', 'Owner': 'المالك',
  'Admin': 'مسؤول', 'Analyst': 'محلل', 'Viewer': 'مشاهد', 'Generate Report': 'إنشاء تقرير',
  'Generate and download dataset reports': 'إنشاء وتنزيل تقارير مجموعات البيانات', 'Profile': 'الملف الشخصي',
  'Log out': 'تسجيل الخروج', 'Notifications': 'الإشعارات', 'No notifications yet.': 'لا توجد إشعارات بعد.',
};

const reverseTranslations = Object.fromEntries(Object.entries(translations).map(([english, arabic]) => [arabic, english]));

export function translateText(text: string, language: 'en' | 'ar'): string {
  if (language === 'en') return reverseTranslations[text] || text;
  return translations[text] || text;
}

export function translatePage(root: ParentNode, language: 'en' | 'ar') {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);
  nodes.forEach(textNode => {
    const parent = textNode.parentElement;
    if (!parent || ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(parent.tagName)) return;
    const value = textNode.nodeValue || '';
    const trimmed = value.trim();
    if (!trimmed) return;
    const translated = translateText(trimmed, language);
    if (translated !== trimmed) textNode.nodeValue = value.replace(trimmed, translated);
  });
}
