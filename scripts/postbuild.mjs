// بعد البناء: صفحة جذر محايدة (لا تكشف رابط الشعبة) + ملفات GitHub Pages
import { writeFileSync, mkdirSync } from 'node:fs';

const neutral = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>الرابط غير مكتمل</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#F7F1E6;color:#44403C;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;padding:24px;text-align:center}
  h1{color:#1E3B2E;font-size:20px;margin:0 0 8px}
  p{margin:0;font-size:15px;line-height:1.7}
</style>
</head>
<body>
  <div>
    <h1>الرابط غير مكتمل</h1>
    <p>افتح الموقع من الرابط الكامل المرسل في مجموعة الشعبة.</p>
  </div>
</body>
</html>
`;

mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', neutral);
writeFileSync('dist/404.html', neutral);
writeFileSync('dist/.nojekyll', '');
console.log('[postbuild] dist/index.html + 404.html جاهزة');
