/**
 * Code generation utilities and device prefixes for «محلي»
 */

const DEVICE_PREFIX_KEY = 'mahally_device_prefix';

/**
 * الحصول على بادئة الجهاز الحالية أو توليد حرف عشوائي A-Z وتخزينه في localStorage
 */
export function getDevicePrefix(): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'A';
  }

  const existing = localStorage.getItem(DEVICE_PREFIX_KEY);
  if (existing && existing.length === 1 && /^[A-Z]$/.test(existing)) {
    return existing;
  }

  // توليد حرف عشوائي بين A و Z
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomChar = letters.charAt(Math.floor(Math.random() * letters.length));
  localStorage.setItem(DEVICE_PREFIX_KEY, randomChar);
  return randomChar;
}

export interface CodeOptions {
  modelNumber?: number | string;
  color?: string;
  colorLetter?: string; // حرف/حروف لاتينية للون (من الإعدادات)
  size?: number | string;
  seq?: number;
}

/** خريطة الألوان العربية الشائعة إلى رموز لاتينية معيارية متطابقة مع إعدادات النظام */
const KNOWN_ARABIC_COLORS: Record<string, string> = {
  'اسود': 'B',
  'ابيض': 'W',
  'بني': 'BR',
  'بيج': 'BE',
  'كحلي': 'N',
  'رمادي': 'G',
  'رصاصي': 'G',
  'احمر': 'R',
  'كافيه': 'C',
  'ذهبي': 'GL',
  'فضي': 'S',
  'هافان': 'H',
  'زيتي': 'OL',
  'ازرق': 'BL',
  'اخضر': 'GN',
  'اصفر': 'YL',
  'وردي': 'PK',
  'روز': 'PK',
  'بينك': 'PK',
  'نبيتي': 'WN',
  'بورجوندي': 'WN',
  'جملي': 'TN',
  'بترولي': 'PET',
  'سماوي': 'SKY',
  'فيروزي': 'TQ',
  'تيركواز': 'TQ',
  'فوشيا': 'FS',
  'موف': 'MV',
  'بنفسجي': 'MV',
  'عنابي': 'MR',
  'سكري': 'OW',
  'اوف وايت': 'OW',
};

function normalizeArabicColor(str: string): string {
  return str
    .trim()
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[أإآء]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase();
}

/** توليد رمز لاتيني حتمي لأي لون عربي غير مسجل لمنع تكرار الأكواد */
function deterministicColorFallback(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  const abs = Math.abs(hash);
  const c1 = String.fromCharCode(65 + (abs % 26));
  const c2 = String.fromCharCode(65 + (Math.floor(abs / 26) % 26));
  return `X${c1}${c2}`;
}

/**
 * حرف/رمز اللون في الكود:
 * 1. يُفضَّل الحرف اللاتيني الصريح من options.colorLetter إن وُجد وكان صحيحاً.
 * 2. إذا لم يتوفر، يُفحص اسم اللون العربي في options.color ويُحوّل إلى رمزه اللاتيني المعياري.
 * 3. للألوان العربية غير المسجلة، يُولّد رمز لاتيني حتمي فريد (X..) لضمان عدم تكرار الأكواد لنفس الموديل.
 * 4. إذا لم يُحدد لون إطلاقاً، يعود إلى 'X'.
 */
function colorPart(options: CodeOptions): string {
  const explicit = (options.colorLetter || '').trim().toUpperCase();
  if (/^[A-Z0-9]+$/.test(explicit)) {
    return explicit;
  }

  const colorStr = (options.color || '').trim();
  if (!colorStr) {
    return 'X';
  }

  // إذا كان اللون مدخلاً بحروف إنجليزية/أرقام أصلاً
  const latinClean = colorStr.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (latinClean && /^[A-Z0-9]+$/.test(latinClean) && !/[\u0600-\u06FF]/.test(colorStr)) {
    return latinClean.slice(0, 4);
  }

  const normalized = normalizeArabicColor(colorStr);
  if (KNOWN_ARABIC_COLORS[normalized]) {
    return KNOWN_ARABIC_COLORS[normalized];
  }

  return deterministicColorFallback(normalized);
}

/**
 * توليد كود الصنف. هذه هي الدالة الوحيدة لتوليد الأكواد في النظام:
 * - حذاء:   S{موديل}-{لون}{مقاس}   مثال S12-B37
 * - شنطة:   B{موديل}-{لون}         مثال B5-BR
 * - إكسسوار: ACC{موديل}-{لون}      مثال ACC7-BK
 */
export function makeCode(
  category: 'shoes' | 'bags' | 'accessories' | 'general' | string,
  options: CodeOptions = {}
): string {
  const cat = (category || 'general').toLowerCase();
  const model = options.modelNumber ?? 1;

  if (cat === 'shoes' || cat.includes('حذاء') || cat.includes('احذية')) {
    return `S${model}-${colorPart(options)}${options.size ? options.size : ''}`;
  }

  if (cat === 'bags' || cat.includes('شنط') || cat.includes('حقائب')) {
    return `B${model}-${colorPart(options)}`;
  }

  if (cat === 'accessories' || cat.includes('اكسسوار') || cat.includes('إكسسوار')) {
    return `ACC${model}-${colorPart(options)}`;
  }

  const prefix = cat.charAt(0).toUpperCase() || 'ITEM';
  const suffix = options.seq ? options.seq : model;
  return `${prefix}${model}-${suffix}`;
}
