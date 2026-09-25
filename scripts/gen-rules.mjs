// يولّد firestore.rules من القالب بإدخال مسار الشعبة العشوائي
import { readFileSync, writeFileSync } from 'node:fs';
import { getSlug, DEV_SLUG } from './env.mjs';

const slug = getSlug();
if (slug === DEV_SLUG) console.warn(`[rules] SECTION_SLUG غير مضبوط — استخدام "${DEV_SLUG}" (للتطوير فقط)`);
const tpl = readFileSync('firestore.rules.template', 'utf8');
writeFileSync('firestore.rules', tpl.replaceAll('__SECTION_SLUG__', slug));
console.log(`[rules] firestore.rules جاهز للشعبة: ${slug}`);
