# צ'ק-ליסט לפני כל deploy (push ל-main)

> **למה:** Railway מריץ את השרת מחדש בכל push. הזיכרון של השרת מתאפס, והמערכת נטענת מחדש מ-Google Sheets.
> כל שינוי שעוד לא נכתב ל-Sheets — **נמחק**. (5.10.2026: אבדו 5 שבועות של נסיעות ככה.)

## לפני ה-push — חובה

1. **בדיקת סנכרון:** לפתוח (מחוברים ל-LUZ)
   `https://app.luzapp.co.il/api/admin/sync-status`
   - `safeToDeploy: true` → אפשר להמשיך.
   - `safeToDeploy: false` → **לא לעשות push.** לבדוק `lastFlushError` ו-`pendingWrites`, לתקן, ולחכות עד שחוזר ל-true.
2. **גיבוי Drive:** ב-Google Drive, לכל קובץ (`LUZ — VikoLahyani`, `LUZ — UrbanTours`):
   ⋮ → *יצירת עותק* → לשנות שם ל-`BACKUP YYYY-MM-DD — LUZ <Tenant>`.
3. **מקום בגיליון:** בגיליון "סידור עבודה" חייב להישאר מרווח של אלפי שורות ריקות מתחת לנתונים (כרגע ~98,000 בוויקו, ~51,000 באורבן).

## אחרי ה-deploy

4. לפתוח שוב `/api/admin/sync-status` ולוודא שמספר ה-`records` של `work-schedule` לכל טננט זהה למה שהיה לפני.
5. בדיקה חיה של הפיצ'ר שעלה.

## שחזור (אם משהו השתבש)

- **קוד:** ב-GitHub → Commits → ⋯ על ה-commit הקודם → Revert. Railway יפרוס אוטומטית.
- **נתונים:** Google Sheets → קובץ → היסטוריית גרסאות → לבחור גרסה → *שחזור הגרסה הזו*. או לפתוח את עותק ה-BACKUP מ-Drive ולהעתיק ממנו.
  אחרי שחזור נתונים ב-Sheets חובה **redeploy** (Railway → Deploy) כדי שהשרת יטען את הגרסה המשוחזרת.
