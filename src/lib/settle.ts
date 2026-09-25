/** ينتظر تأكيد السيرفر لمدة محددة. عند البطء لا نلغي العملية (Firestore يكملها تلقائيًا عند تحسن الاتصال) */
export async function settle(p: Promise<unknown>, ms = 9000): Promise<'ok' | 'slow'> {
  let timer = 0;
  const slow = new Promise<'slow'>((r) => (timer = window.setTimeout(() => r('slow'), ms)));
  try {
    return await Promise.race([p.then(() => 'ok' as const), slow]);
  } finally {
    window.clearTimeout(timer);
  }
}

export function errorText(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'permission-denied') return 'ليس لديك صلاحية لهذه العملية';
  if (code === 'unavailable') return 'تعذر الاتصال بالخادم';
  if (code === 'resource-exhausted') return 'تم تجاوز الحد المسموح مؤقتًا — حاول لاحقًا';
  if (code === 'invalid-argument') return 'البيانات غير صالحة (قد تكون الصورة كبيرة جدًا)';
  return 'حدث خطأ غير متوقع';
}
