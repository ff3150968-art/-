/**
 * Date and Time utilities for «محلي» configured for Cairo timezone (Africa/Cairo)
 */

const CAIRO_TIMEZONE = 'Africa/Cairo';

/**
 * يرجع تاريخ بصيغة UTC ISO الحقيقية باستخدام new Date().toISOString()
 */
export function getCairoDate(dateInput?: Date | number | string): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  return d.toISOString();
}

/**
 * يحصل على مفتاح اليوم بصيغة YYYY-MM-DD وفقاً لتوقيت القاهرة وبأرقام لاتينية
 */
export function getDayKey(dateInput?: Date | number | string): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  const formatter = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
    timeZone: CAIRO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(d);
  const year = parts.find((p) => p.type === 'year')?.value || '1970';
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';

  return `${year}-${month}-${day}`;
}

/**
 * يحصل على مفتاح الشهر بصيغة YYYY-MM وفقاً لتوقيت القاهرة وبأرقام لاتينية
 */
export function getMonthKey(dateInput?: Date | number | string): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  const formatter = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
    timeZone: CAIRO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  });

  const parts = formatter.formatToParts(d);
  const year = parts.find((p) => p.type === 'year')?.value || '1970';
  const month = parts.find((p) => p.type === 'month')?.value || '01';

  return `${year}-${month}`;
}

/**
 * تنسيق التاريخ للعرض باللغة العربية (توقيت القاهرة) بأرقام لاتينية
 */
export function formatDate(
  dateInput?: Date | number | string,
  includeTime: boolean = false
): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: CAIRO_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(includeTime
      ? {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }
      : {}),
  };

  return new Intl.DateTimeFormat('ar-EG-u-nu-latn', options).format(d);
}

/**
 * تنسيق الشهر والسنة للعرض باللغة العربية (توقيت القاهرة) بأرقام لاتينية
 */
export function formatMonth(dateInput?: Date | number | string): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: CAIRO_TIMEZONE,
    year: 'numeric',
    month: 'long',
  };

  return new Intl.DateTimeFormat('ar-EG-u-nu-latn', options).format(d);
}
