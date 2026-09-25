import { expect, test, type Page } from '@playwright/test';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { E2E_SLUG } from '../../playwright.config';

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
const admin = getApps()[0] ?? initializeApp({ projectId: 'demo-section3' });
const db = getFirestore(admin);
const S = db.doc(`sections/${E2E_SLUG}`);
const ADMIN_CODE = 'e2e-admin-code-2026';

/** تاريخ/وقت بتوقيت الرياض لحقول الإدخال */
function riyadh(ms: number) {
  const d = new Date(ms + 3 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`,
    time: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`,
  };
}

/** صورة كبيرة (4000x3000) تُولَّد داخل المتصفح لاختبار الضغط */
/** يفتح البطاقة إن كانت مطوية (بعد النشر تُفتح تلقائيًا) */
async function expand(head: import('@playwright/test').Locator) {
  const before = await head.getAttribute('aria-expanded');
  if (before !== 'true') await head.click();
  await expect(head).toHaveAttribute('aria-expanded', 'true');
}

async function bigImage(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 4000;
    c.height = 3000;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(4000, 3000);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = (i * 7) % 255;
      img.data[i + 1] = (i * 13) % 255;
      img.data[i + 2] = Math.random() * 255;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  });
  return Buffer.from(b64, 'base64');
}

test.beforeAll(async () => {
  await db.recursiveDelete(S);
  await S.collection('adminConfig').doc('main').set({ code: ADMIN_CODE });
});

test('رحلة كاملة: نشر → ظهور لجهاز آخر → رد → تعديل الموعد → أرشفة تلقائية → الإدمن', async ({ browser }) => {
  const ctxA = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  const errors: string[] = [];
  for (const p of [a, b]) p.on('pageerror', (e) => errors.push(e.message));

  // ١) دخول بالرابط العشوائي — حالة فارغة
  await a.goto('./');
  await b.goto('./');
  await expect(a.getByText('لا توجد تنبيهات نشطة حاليًا')).toBeVisible();
  await expect(b.getByText('لا توجد تنبيهات نشطة حاليًا')).toBeVisible();

  // ٢) إضافة واجب مع صورة كبيرة
  await a.getByRole('button', { name: 'إضافة تنبيه' }).last().click();
  await a.getByRole('button', { name: 'نشر التنبيه' }).click();
  await expect(a.getByText('اختر المادة', { exact: true }).last()).toBeVisible(); // رسائل التحقق
  await expect(a.getByText('اكتب عنوانًا مختصرًا')).toBeVisible();
  await a.locator('select').first().selectOption('finance');
  const longTitle = 'تسليم دراسة حالة الفصل الثالث مع تحليل SWOT كامل وجدول مالي مفصل ومراجعة المراجع والملاحق';
  await a.getByPlaceholder('مثال: تسليم دراسة حالة الفصل الثالث').fill(longTitle);
  await a.getByPlaceholder('أي تفاصيل أو ملاحظات تفيد الشعبة…').fill('يا شباب ترى في تعديل بسيط:\nأضيفوا صفحة SWOT.');
  const due1 = riyadh(Date.now() + 2 * 86_400_000);
  await a.getByLabel('تاريخ الانتهاء').fill(due1.date);
  await a.getByLabel('وقت الانتهاء').fill('23:59');
  await a
    .getByTestId('image-input')
    .setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: await bigImage(a) });
  await expect(a.getByAltText('معاينة الصورة')).toBeVisible({ timeout: 30_000 });
  await a.getByPlaceholder(/مثال: سالم/).fill('سالم');
  await a.getByRole('button', { name: 'نشر التنبيه' }).click();
  await expect(a.getByText('نُشر التنبيه لكل الشعبة')).toBeVisible();

  // الصورة المخزنة مضغوطة
  const imgs = await S.collection('images').get();
  expect(imgs.size).toBe(1);
  const img = imgs.docs[0].data();
  expect(Math.max(img.width, img.height)).toBeLessThanOrEqual(1280);
  expect(img.dataUrl.length).toBeLessThan(900_000);

  // العنوان الطويل مقصوص بصريًا بالبطاقة (سطرين كحد أقصى)
  const title = a.locator('.card-title').first();
  const box = await title.boundingBox();
  expect(box!.height).toBeLessThan(60);

  // ٣) يظهر فورًا على الجهاز الآخر (كمبيوتر: جدول)
  const row = b.locator('tr.row', { hasText: 'تسليم دراسة حالة' });
  await expect(row).toBeVisible();
  await expect(row).toContainText('تمويل المشاريع');
  await expect(row).toContainText(/باقي (يومين|3 أيام)/);
  await expect(b.locator('.summary')).toHaveText('واجب واحد');

  // العداد الحي يتغير كل ثانية
  const clock = row.locator('.cd-clock');
  const t1 = await clock.textContent();
  await b.waitForTimeout(1500);
  expect(await clock.textContent()).not.toBe(t1);

  // ٤) الجهاز الآخر يفتح التنبيه (Accordion) ويرد
  await expand(row);
  await expect(b.getByText('أضيفوا صفحة SWOT.')).toBeVisible();
  await expect(b.getByAltText(/صورة مرفقة/)).toBeVisible();
  await b.getByPlaceholder('اكتب ردك…').fill('تمام، تم التعديل عندي');
  await b.getByRole('button', { name: 'إرسال الرد' }).click();
  await expect(b.locator('.reply')).toHaveCount(1);
  await expect(b.locator('.reply')).toContainText('مجهول');

  // الرد يظهر على الجهاز الأول
  await expand(a.locator('.card-head').first());
  await expect(a.getByText('تمام، تم التعديل عندي')).toBeVisible();
  await expect(a.locator('.card').first()).toContainText('رد واحد');

  // ٥) صاحب التنبيه يعدّل الموعد إلى بعد دقيقتين تقريبًا
  await a.getByRole('button', { name: 'تعديل' }).click();
  const soon = Date.now() + 120_000;
  const due2 = riyadh(soon + 60_000 - (soon % 60_000)); // أول دقيقة كاملة بعد دقيقتين
  await a.getByLabel('تاريخ الانتهاء').fill(due2.date);
  await a.getByLabel('وقت الانتهاء').fill(due2.time);
  await a.getByRole('button', { name: 'حفظ التعديلات' }).click();
  await expect(a.getByText('حُفظت التعديلات')).toBeVisible();
  await expect(row).toContainText(/باقي \d+ دقائق|باقي دقيقتين|باقي 3 دقائق/);
  await expect(row.locator('.cd')).toHaveClass(/u-urgent/);

  // الجهاز الآخر لا يستطيع التعديل (لا يظهر زر تعديل لغير صاحبه)
  await expect(b.getByRole('button', { name: 'تعديل' })).toHaveCount(0);

  // ٦) انتهاء الموعد والانتقال للأرشيف تلقائيًا بدون إعادة تحميل
  await expect(b.getByText('لا توجد تنبيهات نشطة حاليًا')).toBeVisible({ timeout: 200_000 });
  await expect(a.getByText('لا توجد تنبيهات نشطة حاليًا')).toBeVisible();
  await b.getByRole('button', { name: /المنتهية والأرشيف \(1\)/ }).click();
  await expect(b.locator('tr.row', { hasText: 'تسليم دراسة حالة' })).toContainText('انتهى');

  // ٧) الإدمن: كود خاطئ ثم صحيح
  await b.getByRole('button', { name: 'الإدمن' }).click();
  await b.getByLabel('كود الإدمن').fill('wrong-code');
  await b.getByRole('button', { name: 'تفعيل' }).click();
  await expect(b.getByText('الكود غير صحيح')).toBeVisible();
  await b.getByLabel('كود الإدمن').fill(ADMIN_CODE);
  await b.getByRole('button', { name: 'تفعيل' }).click();
  await expect(b.getByRole('button', { name: 'الإدمن مفعّل' })).toBeVisible();

  // الإدمن يحذف (ناعم) تنبيه غيره، ثم يراه في المحذوفة ويستعيده
  await expand(b.locator('tr.row', { hasText: 'تسليم دراسة حالة' }));
  b.once('dialog', (d) => d.accept());
  await b.locator('.details-actions').getByRole('button', { name: 'حذف', exact: true }).click();
  await expect(b.getByText('حُذف التنبيه')).toBeVisible();
  await b.getByRole('button', { name: /المحذوفة — للإدمن فقط \(1\)/ }).click();
  await b.getByRole('button', { name: 'استعادة' }).click();
  await expect(b.getByRole('button', { name: /المنتهية والأرشيف \(1\)/ })).toBeVisible();

  // الردود محفوظة بعد الحذف والاستعادة
  const replies = await S.collection('alerts')
    .doc((await S.collection('alerts').get()).docs[0].id)
    .collection('replies')
    .get();
  expect(replies.size).toBe(1);

  expect(errors).toEqual([]);
  await ctxA.close();
  await ctxB.close();
});

test('إعلان بدون موعد + علامة مكرر + تفضيل العرض محفوظ + العرض الشبكي', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.getByRole('button', { name: 'إضافة تنبيه' }).last().click();
  await page.getByRole('button', { name: 'إعلان', exact: true }).click();
  await expect(page.getByText('(اختياري)').nth(1)).toBeVisible();
  await page.locator('select').first().selectOption('quality');
  await page.getByPlaceholder('مثال: تسليم دراسة حالة الفصل الثالث').fill('تم تأجيل المحاضرة القادمة');
  await page.getByRole('button', { name: 'نشر التنبيه' }).click();
  await expect(page.getByText('نُشر التنبيه لكل الشعبة')).toBeVisible();
  const card = page.locator('.card', { hasText: 'تم تأجيل المحاضرة القادمة' });
  await expect(card).toContainText('بدون موعد');
  await expect(card).toContainText('بواسطة مجهول');

  // مكرر محتمل
  await expand(card.locator('.card-head'));
  await card.getByRole('button', { name: /مكرر؟/ }).click();
  await expect(card).toContainText('مكرر محتمل');

  // العرض الشبكي: لا يعرض إلا ما فيه صور
  await page.getByRole('button', { name: 'عرض الصور' }).click();
  await expect(page.getByText('لا توجد تنبيهات نشطة فيها صور')).toBeVisible();
  await page.reload();
  await expect(page.getByText('لا توجد تنبيهات نشطة فيها صور')).toBeVisible(); // يتذكر التفضيل
  await page.getByRole('button', { name: 'عرض القائمة' }).click();

  // أرشفة يدوية للإعلان
  await expand(card.locator('.card-head'));
  await card.getByRole('button', { name: 'أرشفة' }).click();
  await expect(page.getByText('نُقل التنبيه إلى المنتهية')).toBeVisible();
  await expect(page.locator('main > .cards .card', { hasText: 'تم تأجيل المحاضرة القادمة' })).toHaveCount(0);
});

test('الإشعارات: iPhone بدون تثبيت يشرح خطوة التثبيت', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  await page.goto('./');
  await expect(page.getByText('لتصلك الإشعارات على iPhone: ثبّت الموقع على الشاشة الرئيسية')).toBeVisible();
  await page.getByRole('button', { name: 'كيف؟' }).click();
  await expect(page.getByText('«إضافة إلى الشاشة الرئيسية»')).toBeVisible();
  await ctx.close();
});

test('رابط الإدمن بكود خاطئ لا يمنح صلاحية', async ({ page }) => {
  await page.goto('./?admin=nope-nope');
  await expect(page.getByText('كود الإدمن غير صحيح')).toBeVisible();
  expect(page.url()).not.toContain('admin=');
  await expect(page.getByRole('button', { name: 'الإدمن', exact: true })).toBeVisible();
});

test('انقطاع الاتصال: تنبيه واضح والنموذج لا يفقد البيانات', async ({ page, context }) => {
  await page.goto('./');
  await expect(page.locator('.summary')).not.toHaveText('جارٍ التحميل…');
  await page.getByRole('button', { name: 'إضافة تنبيه' }).last().click();
  await page.locator('select').first().selectOption('risk');
  await page.getByPlaceholder('مثال: تسليم دراسة حالة الفصل الثالث').fill('اختبار بدون نت');
  const d = riyadh(Date.now() + 86_400_000);
  await page.getByLabel('تاريخ الانتهاء').fill(d.date);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'نشر التنبيه' }).click();
  await expect(page.getByText(/لا يوجد اتصال بالإنترنت الآن/)).toBeVisible();
  await expect(page.getByPlaceholder('مثال: تسليم دراسة حالة الفصل الثالث')).toHaveValue('اختبار بدون نت');
  // المسودة محفوظة حتى بعد إغلاق النموذج
  await page.getByRole('button', { name: 'إغلاق' }).click();
  await expect(page.getByText(/لا يوجد اتصال بالإنترنت/)).toBeVisible();
  await context.setOffline(false);
  await page.getByRole('button', { name: 'إضافة تنبيه' }).last().click();
  await expect(page.getByPlaceholder('مثال: تسليم دراسة حالة الفصل الثالث')).toHaveValue('اختبار بدون نت');
});
