export type InlineEntry = { en: string; zh: string };

export const INLINE_TRANSLATIONS: Record<string, InlineEntry> = {
  "اضبط ملف .env.local أولا بقيم Supabase.": {
    "en": "Configure .env.local with Supabase values first.",
    "zh": "请先配置 .env.local 中的 Supabase 值。"
  },
  "تعذر تحميل البيانات الأساسية.": {
    "en": "Failed to load lookup data.",
    "zh": "无法加载基础数据。"
  },
  "ارفع ملف INV بصيغة PDF قبل حفظ الشحنة.": {
    "en": "Upload an INV PDF file before saving the shipment.",
    "zh": "保存货运前请先上传 PDF 格式的 INV 文件。"
  },
  "ملف INV يجب أن يكون PDF.": {
    "en": "INV file must be a PDF.",
    "zh": "INV 文件必须是 PDF。"
  },
  "أضف حاوية واحدة على الأقل.": {
    "en": "Add at least one container.",
    "zh": "请至少添加一个集装箱。"
  },
  "أضف منتجا واحدا على الأقل مع كرتين ووحدة صحيحة.": {
    "en": "Add at least one product with valid cartons and unit quantity.",
    "zh": "请至少添加一个产品，并填写有效的箱数和单位数量。"
  },
  "رقم الحاوية مكرر داخل نفس الشحنة.": {
    "en": "Duplicate container number within this shipment.",
    "zh": "同一货运中存在重复的集装箱号。"
  },
  "رقم ACID مستخدم في شحنة أخرى ولا يمكن تكراره.": {
    "en": "ACID number is already used by another shipment and cannot be duplicated.",
    "zh": "ACID 编号已被其他货运使用，不能重复。"
  },
  "تعذر تحديث تفاصيل الشحنة.": {
    "en": "Failed to update shipment details.",
    "zh": "无法更新货运详情。"
  },
  "تعذر رفع ملف INV.": {
    "en": "Failed to upload INV file.",
    "zh": "无法上传 INV 文件。"
  },
  "وضع العرض فقط — اضغط «تعديل» أعلاه لتغيير البيانات.": {
    "en": "View-only mode — click Edit above to change data.",
    "zh": "仅查看模式 — 点击上方「编辑」以修改数据。"
  },
  "البيانات الأساسية": {
    "en": "Basic information",
    "zh": "基本信息"
  },
  "رقم ACID": {
    "en": "ACID number",
    "zh": "ACID 编号"
  },
  "الشركة": {
    "en": "Company",
    "zh": "公司"
  },
  "ابحث عن الشركة...": {
    "en": "Search for company...",
    "zh": "搜索公司..."
  },
  "المورد": {
    "en": "Supplier",
    "zh": "供应商"
  },
  "ابحث عن المورد...": {
    "en": "Search for supplier...",
    "zh": "搜索供应商..."
  },
  "نوع / وصف البضاعة": {
    "en": "Cargo type / description",
    "zh": "货物类型 / 描述"
  },
  "مثال: خردوات — كشاف": {
    "en": "Example: hardware — flashlight",
    "zh": "示例：五金 — 手电筒"
  },
  "ميناء الشحن": {
    "en": "Shipping port",
    "zh": "装运港"
  },
  "اختر ميناء الشحن": {
    "en": "Select shipping port",
    "zh": "选择装运港"
  },
  "ميناء الوصول": {
    "en": "Arrival port",
    "zh": "到达港"
  },
  "اختر ميناء الوصول": {
    "en": "Select arrival port",
    "zh": "选择到达港"
  },
  "تاريخ الشحن": {
    "en": "Ship date",
    "zh": "装运日期"
  },
  "تاريخ الوصول المتوقع": {
    "en": "Expected arrival date",
    "zh": "预计到达日期"
  },
  "خروج جمرك (بعد 15 يوم)": {
    "en": "Customs clearance (15 days after)",
    "zh": "清关放行（15 天后）"
  },
  "مدة الشحن بالأيام": {
    "en": "Shipping duration (days)",
    "zh": "运输天数"
  },
  "وزن الشحنة الكلي (كجم)": {
    "en": "Total shipment weight (kg)",
    "zh": "货运总重量（公斤）"
  },
  "إجمالي الكراتين": {
    "en": "Total cartons",
    "zh": "总箱数"
  },
  "قيمة الشحنة (USD)": {
    "en": "Shipment value (USD)",
    "zh": "货运价值（美元）"
  },
  "عدد الحاويات": {
    "en": "Number of containers",
    "zh": "集装箱数量"
  },
  "يفتح صفوف الحاويات تلقائيا": {
    "en": "Opens container rows automatically",
    "zh": "自动展开集装箱行"
  },
  "خط السير": {
    "en": "Route",
    "zh": "航线"
  },
  "ملف INV (PDF) — إلزامي": {
    "en": "INV file (PDF) — required",
    "zh": "INV 文件（PDF）— 必填"
  },
  "ملاحظات": {
    "en": "Notes",
    "zh": "备注"
  },
  "الحاويات": {
    "en": "Containers",
    "zh": "集装箱"
  },
  "أدخل اسم أو رقم كل حاوية فقط.": {
    "en": "Enter only the name or number of each container.",
    "zh": "仅输入每个集装箱的名称或编号。"
  },
  "حاوية": {
    "en": "Container",
    "zh": "集装箱"
  },
  "اسم / رقم الحاوية": {
    "en": "Container name / number",
    "zh": "集装箱名称 / 编号"
  },
  "منتجات الشحنة": {
    "en": "Shipment products",
    "zh": "货运产品"
  },
  "الكراتين:": {
    "en": "Cartons:",
    "zh": "箱数："
  },
  "الكراتين المدخلة:": {
    "en": "Cartons entered:",
    "zh": "已输入箱数："
  },
  "حدّد إجمالي الكراتين في بيانات الشحنة": {
    "en": "Set total cartons in shipment details",
    "zh": "请在货运信息中设置总箱数"
  },
  "منتج جديد": {
    "en": "New product",
    "zh": "新产品"
  },
  "سطر منتج": {
    "en": "Product row",
    "zh": "产品行"
  },
  "ابحث عن المنتج (SKU أو الاسم)": {
    "en": "Search product (SKU or name)",
    "zh": "搜索产品（SKU 或名称）"
  },
  "الكرتين": {
    "en": "Cartons",
    "zh": "箱数"
  },
  "الوحدة": {
    "en": "Unit",
    "zh": "单位数量"
  },
  "إجمالي القطع": {
    "en": "Total pieces",
    "zh": "总件数"
  },
  "منتج وارد جديد": {
    "en": "New incoming product",
    "zh": "新到产品"
  },
  "مفكك": {
    "en": "Disassembled",
    "zh": "拆散件"
  },
  "ملاحظات المنتج": {
    "en": "Product notes",
    "zh": "产品备注"
  },
  "جاري الحفظ...": {
    "en": "Saving...",
    "zh": "保存中..."
  },
  "حفظ الشحنة": {
    "en": "Save shipment",
    "zh": "保存货运"
  },
  "الباركود مستخدم لمنتج آخر.": {
    "en": "Barcode is already used by another product.",
    "zh": "条形码已被其他产品使用。"
  },
  "سيتم توليد SKU تلقائيا من كود الفئة.": {
    "en": "SKU will be generated automatically from the category code.",
    "zh": "SKU 将根据类别代码自动生成。"
  },
  "اسم المنتج": {
    "en": "Product name",
    "zh": "产品名称"
  },
  "الفئة": {
    "en": "Category",
    "zh": "类别"
  },
  "ابحث عن الفئة...": {
    "en": "Search for category...",
    "zh": "搜索类别..."
  },
  "الباركود (اختياري)": {
    "en": "Barcode (optional)",
    "zh": "条形码（可选）"
  },
  "حفظ المنتج": {
    "en": "Save product",
    "zh": "保存产品"
  },
  "لا يمكن تحويل الشحنة إلى «في الجمرك» قبل تاريخ الوصول المتوقع (ETA).": {
    "en": "Cannot move shipment to In Customs before the expected arrival date (ETA).",
    "zh": "不能在预计到达日期（ETA）之前将货运转为「清关中」。"
  },
  "إرجاع الشحنة إلى «في البحر»؟": {
    "en": "Revert shipment to At Sea?",
    "zh": "将货运退回「在途」？"
  },
  "جاري تحميل الشحنة...": {
    "en": "Loading shipment...",
    "zh": "正在加载货运..."
  },
  "الشحنة غير موجودة.": {
    "en": "Shipment not found.",
    "zh": "货运不存在。"
  },
  "ملخص": {
    "en": "Summary",
    "zh": "摘要"
  },
  "المنتجات": {
    "en": "Products",
    "zh": "产品"
  },
  "الملفات": {
    "en": "Files",
    "zh": "文件"
  },
  "السجل": {
    "en": "Timeline",
    "zh": "记录"
  },
  "المصاريف": {
    "en": "Costs",
    "zh": "费用"
  },
  "شحنة": {
    "en": "Shipment",
    "zh": "货运"
  },
  "شركة غير محددة": {
    "en": "Unspecified company",
    "zh": "未指定公司"
  },
  "مورد غير محدد": {
    "en": "Unspecified supplier",
    "zh": "未指定供应商"
  },
  "رجوع": {
    "en": "Back",
    "zh": "返回"
  },
  "تقرير / PDF": {
    "en": "Report / PDF",
    "zh": "报告 / PDF"
  },
  "تعديل": {
    "en": "Edit",
    "zh": "编辑"
  },
  "إلغاء التعديل": {
    "en": "Cancel edit",
    "zh": "取消编辑"
  },
  "تحديث": {
    "en": "Refresh",
    "zh": "刷新"
  },
  "الحالة": {
    "en": "Status",
    "zh": "状态"
  },
  "الوصول المتوقع": {
    "en": "Expected arrival",
    "zh": "预计到达"
  },
  "خروج جمرك (+15 يوم)": {
    "en": "Customs clearance (+15 days)",
    "zh": "清关放行（+15 天）"
  },
  "تنبيه": {
    "en": "Warning",
    "zh": "警告"
  },
  "الشحنة في «الجمرك» قبل الـ ETA. يمكنك إرجاعها إلى «في البحر».": {
    "en": "Shipment is In Customs before ETA. You can revert it to At Sea.",
    "zh": "货运在 ETA 之前处于「清关中」。可将其退回「在途」。"
  },
  "إرجاع لفي البحر": {
    "en": "Revert to At Sea",
    "zh": "退回在途"
  },
  "ملف INV": {
    "en": "INV file",
    "zh": "INV 文件"
  },
  "تحميل INV": {
    "en": "Download INV",
    "zh": "下载 INV"
  },
  "رقم الحاوية": {
    "en": "Container number",
    "zh": "集装箱号"
  },
  "الوزن": {
    "en": "Weight",
    "zh": "重量"
  },
  "لا توجد حاويات.": {
    "en": "No containers.",
    "zh": "暂无集装箱。"
  },
  "المنتج": {
    "en": "Product",
    "zh": "产品"
  },
  "جديد": {
    "en": "New",
    "zh": "新到"
  },
  "نعم": {
    "en": "Yes",
    "zh": "是"
  },
  "لا": {
    "en": "No",
    "zh": "否"
  },
  "لا توجد منتجات.": {
    "en": "No products.",
    "zh": "暂无产品。"
  },
  "لا توجد أحداث بعد.": {
    "en": "No events yet.",
    "zh": "暂无事件。"
  },
  "جمارك": {
    "en": "Customs duty",
    "zh": "关税"
  },
  "شحن": {
    "en": "Shipping",
    "zh": "运费"
  },
  "تخليص": {
    "en": "Clearance",
    "zh": "清关费"
  },
  "نقل داخلي": {
    "en": "Local transport",
    "zh": "国内运输"
  },
  "مصروفات أخرى": {
    "en": "Other expenses",
    "zh": "其他费用"
  },
  "الإجمالي": {
    "en": "Total",
    "zh": "合计"
  },
  "لم يتم تسجيل مصاريف لهذه الشحنة بعد.": {
    "en": "No costs recorded for this shipment yet.",
    "zh": "此货运尚未记录费用。"
  },
  "إدخال المصاريف": {
    "en": "Enter costs",
    "zh": "录入费用"
  },
  "تعديل المصاريف": {
    "en": "Edit costs",
    "zh": "编辑费用"
  },
  "مصاريف الإغلاق": {
    "en": "Closing costs",
    "zh": "结案费用"
  },
  "الجمارك": {
    "en": "Customs",
    "zh": "关税"
  },
  "الشحن": {
    "en": "Shipping",
    "zh": "运费"
  },
  "التخليص": {
    "en": "Clearance",
    "zh": "清关费"
  },
  "النقل الداخلي": {
    "en": "Local transport",
    "zh": "国内运输"
  },
  "ملاحظات الإغلاق": {
    "en": "Closing notes",
    "zh": "结案备注"
  },
  "حفظ المصاريف": {
    "en": "Save costs",
    "zh": "保存费用"
  },
  "حفظ وإغلاق": {
    "en": "Save and close",
    "zh": "保存并结案"
  },
  "الكل": {
    "en": "All",
    "zh": "全部"
  },
  "كامل": {
    "en": "Complete",
    "zh": "完整件"
  },
  "التقرير غير موجود.": {
    "en": "Report not found.",
    "zh": "报告不存在。"
  },
  "رجوع للتقارير": {
    "en": "Back to reports",
    "zh": "返回报告列表"
  },
  "طباعة PDF": {
    "en": "Print PDF",
    "zh": "打印 PDF"
  },
  "بالصور": {
    "en": "With images",
    "zh": "含图片"
  },
  "فلترة حسب تاريخ الإغلاق": {
    "en": "Filter by closing date",
    "zh": "按结案日期筛选"
  },
  "فلترة حسب تاريخ رفع الملف": {
    "en": "Filter by file upload date",
    "zh": "按文件上传日期筛选"
  },
  "فتح الملف": {
    "en": "Open file",
    "zh": "打开文件"
  },
  "السابق": {
    "en": "Previous",
    "zh": "上一页"
  },
  "التالي": {
    "en": "Next",
    "zh": "下一页"
  },
  "فلترة حسب ETA": {
    "en": "Filter by ETA",
    "zh": "按 ETA 筛选"
  },
  "كل الفئات": {
    "en": "All categories",
    "zh": "全部类别"
  },
  "فلتر حسب الفئة...": {
    "en": "Filter by category...",
    "zh": "按类别筛选..."
  },
  "بحث داخل التقرير": {
    "en": "Search within report",
    "zh": "在报告中搜索"
  },
  "تطبيق": {
    "en": "Apply",
    "zh": "应用"
  },
  "صورة": {
    "en": "Image",
    "zh": "图片"
  },
  "تحميل": {
    "en": "Download",
    "zh": "下载"
  },
  "فتح الشحنة": {
    "en": "Open shipment",
    "zh": "打开货运"
  },
  "جاري التحميل...": {
    "en": "Loading...",
    "zh": "加载中..."
  },
  "عرض الشحنة": {
    "en": "View shipment",
    "zh": "查看货运"
  },
  "لا توجد بيانات.": {
    "en": "No data.",
    "zh": "暂无数据。"
  },
  "ملخص حسب الحالة": {
    "en": "Summary by status",
    "zh": "按状态汇总"
  },
  "عدد الشحنات": {
    "en": "Number of shipments",
    "zh": "货运数量"
  },
  "جاري تحميل التقرير...": {
    "en": "Loading report...",
    "zh": "正在加载报告..."
  },
  "تقرير الشحنة": {
    "en": "Shipment report",
    "zh": "货运报告"
  },
  "رجوع للشحنات": {
    "en": "Back to shipments",
    "zh": "返回货运列表"
  },
  "تفاصيل الشحنة": {
    "en": "Shipment details",
    "zh": "货运详情"
  },
  "Excel المنتجات": {
    "en": "Products Excel",
    "zh": "产品 Excel"
  },
  "طباعة / PDF": {
    "en": "Print / PDF",
    "zh": "打印 / PDF"
  },
  "رقم الشحنة": {
    "en": "Invoice no.",
    "zh": "发票号"
  },
  "نوع البضاعة": {
    "en": "Cargo type",
    "zh": "货物类型"
  },
  "الوزن الكلي (كجم)": {
    "en": "Total weight (kg)",
    "zh": "总重量（公斤）"
  },
  "تاريخ الإغلاق": {
    "en": "Closing date",
    "zh": "结案日期"
  },
  "ملاحظات:": {
    "en": "Notes:",
    "zh": "备注："
  },
  "لا يوجد ملف INV مرفوع لهذه الشحنة.": {
    "en": "No INV file uploaded for this shipment.",
    "zh": "此货运尚未上传 INV 文件。"
  },
  "تاريخ الطباعة:": {
    "en": "Print date:",
    "zh": "打印日期："
  },
  "فاتورة": {
    "en": "Invoice",
    "zh": "发票"
  },
  "أخرى": {
    "en": "Other",
    "zh": "其他"
  },
  "تعذر تحميل الملفات.": {
    "en": "Failed to load files.",
    "zh": "无法加载文件。"
  },
  "ملفات الحاويات Excel/CSV": {
    "en": "Container Excel/CSV files",
    "zh": "集装箱 Excel/CSV 文件"
  },
  "ابحث عن الحاوية...": {
    "en": "Search for container...",
    "zh": "搜索集装箱..."
  },
  "جاري الرفع...": {
    "en": "Uploading...",
    "zh": "上传中..."
  },
  "رفع ملف": {
    "en": "Upload file",
    "zh": "上传文件"
  },
  "مستندات الشحنة": {
    "en": "Shipment documents",
    "zh": "货运单据"
  },
  "نوع المستند": {
    "en": "Document type",
    "zh": "单据类型"
  },
  "رفع مستند": {
    "en": "Upload document",
    "zh": "上传单据"
  },
  "ملفات الحاويات": {
    "en": "Container files",
    "zh": "集装箱文件"
  },
  "الملف": {
    "en": "File",
    "zh": "文件"
  },
  "النوع/الحاوية": {
    "en": "Type / container",
    "zh": "类型 / 集装箱"
  },
  "تاريخ الرفع": {
    "en": "Upload date",
    "zh": "上传日期"
  },
  "لا توجد ملفات.": {
    "en": "No files.",
    "zh": "暂无文件。"
  },
  "الإعدادات": {
    "en": "Settings",
    "zh": "设置"
  },
  "إدارة الملف الشخصي وإعدادات التشغيل العامة.": {
    "en": "Manage your profile and system settings.",
    "zh": "管理个人资料和系统设置。"
  },
  "تعذر التحقق من الجلسة.": {
    "en": "Failed to verify session.",
    "zh": "无法验证会话。"
  },
  "سجل الدخول أولا.": {
    "en": "Please sign in first.",
    "zh": "请先登录。"
  },
  "تعذر تحميل إعدادات النظام.": {
    "en": "Failed to load system settings.",
    "zh": "无法加载系统设置。"
  },
  "تم حفظ الملف الشخصي.": {
    "en": "Profile saved.",
    "zh": "个人资料已保存。"
  },
  "تعذر حفظ إعدادات النظام.": {
    "en": "Failed to save system settings.",
    "zh": "无法保存系统设置。"
  },
  "تم حفظ إعدادات النظام.": {
    "en": "System settings saved.",
    "zh": "系统设置已保存。"
  },
  "المظهر والثيم": {
    "en": "Appearance & theme",
    "zh": "外观与主题"
  },
  "الوضع الداكن": {
    "en": "Dark mode",
    "zh": "深色模式"
  },
  "اللون الأساسي": {
    "en": "Primary color",
    "zh": "主色"
  },
  "لون الشريط الجانبي": {
    "en": "Sidebar color",
    "zh": "侧边栏颜色"
  },
  "لون الخلفية": {
    "en": "Background color",
    "zh": "背景颜色"
  },
  "لون الخط": {
    "en": "Font color",
    "zh": "字体颜色"
  },
  "استعادة الألوان الافتراضية": {
    "en": "Restore default colors",
    "zh": "恢复默认颜色"
  },
  "الملف الشخصي": {
    "en": "Profile",
    "zh": "个人资料"
  },
  "الاسم": {
    "en": "Name",
    "zh": "姓名"
  },
  "البريد الإلكتروني": {
    "en": "Email",
    "zh": "电子邮箱"
  },
  "الدور الحالي:": {
    "en": "Current role:",
    "zh": "当前角色："
  },
  "حفظ الملف": {
    "en": "Save profile",
    "zh": "保存资料"
  },
  "إعدادات النظام": {
    "en": "System settings",
    "zh": "系统设置"
  },
  "قراءة فقط": {
    "en": "Read only",
    "zh": "只读"
  },
  "إلزام تسجيل المصاريف قبل الإغلاق": {
    "en": "Require costs before closing",
    "zh": "结案前必须录入费用"
  },
  "إلزام مستند جمركي قبل الإغلاق": {
    "en": "Require customs document before closing",
    "zh": "结案前必须上传海关单据"
  },
  "اعتبار الشحنة متأخرة بعد ETA بعدد أيام": {
    "en": "Mark shipment delayed N days after ETA",
    "zh": "ETA 后多少天视为延误"
  },
  "حفظ إعدادات النظام": {
    "en": "Save system settings",
    "zh": "保存系统设置"
  },
  "حول النظام": {
    "en": "About",
    "zh": "关于系统"
  },
  "التقارير": {
    "en": "Reports",
    "zh": "报告"
  },
  "تقارير تشغيلية قابلة للتصدير Excel والطباعة.": {
    "en": "Operational reports with Excel export and printing.",
    "zh": "可导出 Excel 和打印的运营报告。"
  },
  "فتح التقرير": {
    "en": "Open report",
    "zh": "打开报告"
  },
  "الموردين": {
    "en": "Suppliers",
    "zh": "供应商"
  },
  "المورد يتم ربطه بالشحنة فقط وليس بالمنتج.": {
    "en": "Suppliers are linked to shipments (not products).",
    "zh": "供应商仅关联货运，不关联产品。"
  },
  "شركات الاستيراد": {
    "en": "Import companies",
    "zh": "进口公司"
  },
  "الشركات المرجعية المستخدمة داخل الشحنات.": {
    "en": "Reference companies used in shipments.",
    "zh": "货运中使用的参考公司。"
  },
  "نظام تتبع الشحنات والاستيراد": {
    "en": "Shipment & import tracking",
    "zh": "货运与进口跟踪系统"
  },
  "تسجيل الدخول": {
    "en": "Sign in",
    "zh": "登录"
  },
  "كلمة المرور": {
    "en": "Password",
    "zh": "密码"
  },
  "جاري التحقق...": {
    "en": "Checking...",
    "zh": "验证中..."
  },
  "جاري الدخول...": {
    "en": "Signing in...",
    "zh": "登录中..."
  },
  "دخول": {
    "en": "Sign in",
    "zh": "登录"
  },
  "شحنة جديدة": {
    "en": "New shipment",
    "zh": "新建货运"
  },
  "SKU (اختياري)": {
    "en": "SKU (optional)",
    "zh": "SKU（可选）"
  },
  "اتركه فارغا لتوليد SKU تلقائيا": {
    "en": "Leave empty to auto-generate SKU",
    "zh": "留空则自动生成 SKU"
  },
  "اختر ملف": {
    "en": "Choose file",
    "zh": "选择文件"
  },
  "اضغط هنا ثم Ctrl+V للصق صورة من Excel أو أي برنامج": {
    "en": "Click here then Ctrl+V to paste an image from Excel or another app",
    "zh": "点击此处后按 Ctrl+V 粘贴来自 Excel 或其他应用的图片"
  },
  "تم حفظ المنتج لكن فشل رفع الصورة.": {
    "en": "Product saved but image upload failed.",
    "zh": "产品已保存，但图片上传失败。"
  },
  "الوحدة الافتراضية": {
    "en": "Default unit",
    "zh": "默认单位"
  },
  "صورة (اختياري)": {
    "en": "Image (optional)",
    "zh": "图片（可选）"
  },
  "جاري البحث...": {
    "en": "Searching...",
    "zh": "搜索中..."
  },
  "لا توجد نتائج.": {
    "en": "No results.",
    "zh": "无结果。"
  },
  "مسارات الشحن": {
    "en": "Shipping routes",
    "zh": "航运路线"
  },
  "بحث المنتجات الذكي": {
    "en": "Smart product search",
    "zh": "智能产品搜索"
  },
  "ابحث عن أي منتج — داخل شحنة أو غير مرتبط بشحنة.": {
    "en": "Search any product (in shipments or standalone).",
    "zh": "搜索任意产品（在货运中或独立）。"
  },
  "المستخدمون": {
    "en": "Users",
    "zh": "用户"
  },
  "مستخدم جديد": {
    "en": "New user",
    "zh": "新建用户"
  },
  "رئيسية": {
    "en": "Root",
    "zh": "根类别"
  },
  "كل الفئات في النظام": {
    "en": "All categories",
    "zh": "系统中的全部类别"
  },
  "الفئات": {
    "en": "Categories",
    "zh": "类别"
  },
  "الفئات الرئيسية": {
    "en": "Main categories",
    "zh": "主类别"
  },
  "بحث بالاسم أو الكود": {
    "en": "Search by name or code",
    "zh": "按名称或代码搜索"
  },
  "منتجات مشحونة": {
    "en": "Shipped products",
    "zh": "已发运产品"
  },
  "لا توجد منتجات مشحونة في هذه الفئة.": {
    "en": "No shipped products in this category.",
    "zh": "此类别中无已发运产品。"
  },
  "عرض الفروع": {
    "en": "Subcategories",
    "zh": "子类别"
  },
  "لا توجد فئات فرعية هنا.": {
    "en": "No subcategories here.",
    "zh": "此处无子类别。"
  },
  "لا توجد فئات.": {
    "en": "No categories.",
    "zh": "无类别。"
  },
  "إنشاء مستخدم": {
    "en": "Create user",
    "zh": "创建用户"
  },
  "حساب جديد بصلاحيات واضحة داخل النظام.": {
    "en": "Create a new user with clear permissions.",
    "zh": "在系统中创建具有明确权限的新用户。"
  },
  "الشحنات": {
    "en": "Shipments",
    "zh": "货运"
  },
  "طباعة": {
    "en": "Print",
    "zh": "打印"
  },
  "عدد الكراتين": {
    "en": "Cartons",
    "zh": "箱数"
  },
  "القيمة ($)": {
    "en": "Value (USD)",
    "zh": "价值（美元）"
  },
  "تاريخ الوصول": {
    "en": "ETA",
    "zh": "预计到达"
  },
  "بحث برقم الشحنة أو ACID...": {
    "en": "Search by invoice no. or ACID...",
    "zh": "按发票号或 ACID 搜索..."
  },
  "تصدير Excel": {
    "en": "Export Excel",
    "zh": "导出 Excel"
  },
  "نشط": {
    "en": "Active",
    "zh": "启用"
  },
  "متوقف": {
    "en": "Inactive",
    "zh": "停用"
  },
  "فتح القائمة": {
    "en": "Open menu",
    "zh": "打开菜单"
  },
  "إغلاق القائمة": {
    "en": "Close menu",
    "zh": "关闭菜单"
  },
  "تغيير اللغة": {
    "en": "Change language",
    "zh": "切换语言"
  },
  "الدور:": {
    "en": "Role:",
    "zh": "角色："
  },
  "كرتونة": {
    "en": "carton",
    "zh": "箱"
  },
  "قطعة": {
    "en": "piece",
    "zh": "件"
  },
  "الشحنات المتأخرة": {
    "en": "Overdue shipments",
    "zh": "延误货运"
  },
  "ETA خلال 7 أيام": {
    "en": "ETA within 7 days",
    "zh": "7 天内到达"
  },
  "حاويات واردة": {
    "en": "Incoming containers",
    "zh": "在途集装箱"
  },
  "منتجات جديدة": {
    "en": "New products",
    "zh": "新产品"
  },
  "منتجات مفككة": {
    "en": "Disassembled products",
    "zh": "拆散件产品"
  },
  "توزيع الحالات": {
    "en": "Status breakdown",
    "zh": "状态分布"
  },
  "لا توجد بيانات لعرضها.": {
    "en": "No data to show.",
    "zh": "暂无数据。"
  },
  "عرض الكل": {
    "en": "View all",
    "zh": "查看全部"
  },
  "إجراءات سريعة": {
    "en": "Quick actions",
    "zh": "快捷操作"
  },
  "آخر الشحنات": {
    "en": "Latest shipments",
    "zh": "最新货运"
  },
  "تنبيهات مهمة": {
    "en": "Important alerts",
    "zh": "重要提醒"
  },
  "نظرة تشغيلية على الشحنات والحاويات والمنتجات الواردة.": {
    "en": "Operational overview of shipments, containers, and incoming products.",
    "zh": "货运、集装箱和在途产品的运营概览。"
  },
  "لوحة التحكم": {
    "en": "Dashboard",
    "zh": "控制台"
  },
  "عرض": {
    "en": "View",
    "zh": "查看"
  },
  "فتح": {
    "en": "Open",
    "zh": "打开"
  },
  "English UI (LTR)": {
    "en": "Arabic UI (RTL)",
    "zh": "阿拉伯语界面（RTL）"
  },
  "نظام عربي RTL": {
    "en": "English UI (LTR)",
    "zh": "英语界面（LTR）"
  },
  "الافراج الجمركي": {
    "en": "Customs release",
    "zh": "海关放行"
  },
  "ارفع ملف PDF للإفراج الجمركي قبل الإغلاق.": {
    "en": "Upload a customs release PDF before closing.",
    "zh": "结案前请上传海关放行 PDF。"
  },
  "يجب أن يكون ملف PDF.": {
    "en": "File must be a PDF.",
    "zh": "文件必须是 PDF。"
  },
  "مرفوع:": {
    "en": "Uploaded:",
    "zh": "已上传："
  }
};
