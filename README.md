# שעון עבודה

אתר לרישום שעות עבודה: שעון עצר, טבלה לעריכה, תצוגת יום, חודש ושנה, וייצוא לאקסל.
המחזור החודשי מוגדר לכל משתמש (ברירת מחדל: מ-27 עד 26).

**עלות: 0 ₪.** האתר יושב ב-Cloudflare Pages (חינם), והנתונים וההתחברות ב-Supabase (חינם).

---

## לנסות במחשב (לפני ההעלאה)

צריך להתקין Node.js בגרסה 24.22.2 (LTS). גרסאות ישנות מ-22.13 לא נתמכות.

```bash
npm install
npm run dev
```

נפתח מצב הדגמה שעובד בלי שרת (שם משתמש `demo`, סיסמה `demo`). הנתונים נשמרים רק בדפדפן.

---

## העלאה לאוויר: מדריך צעד אחר צעד (בערך 30 דקות, פעם אחת)

### שלב 1: Supabase (מסד נתונים והתחברות)

1. נכנסים ל-[supabase.com](https://supabase.com), נרשמים (אפשר עם חשבון GitHub) ולוחצים על **New project**.
   - שם: `work-clock`
   - סיסמה למסד: לבחור סיסמה חזקה ולשמור אותה במקום בטוח
   - Region: לבחור את הקרוב לישראל (למשל Frankfurt)
2. כשהפרויקט מוכן, בתפריט הצד: **SQL Editor** ← **New query**. מדביקים את כל התוכן של `supabase/schema.sql` ולוחצים על **Run**. אמורה להופיע ההודעה "Success".
3. **ביטול הרשמה עצמית:** בתפריט הצד: **Authentication** ← **Sign In / Providers**. מכבים את **Allow new users to sign up** ושומרים. כך רק המנהל יכול ליצור משתמשים.
4. **יצירת המנהל (אתה):** **Authentication** ← **Users** ← **Add user** ← **Create new user**.
   - Email: `admin@workclock.local` (במקום `admin` אפשר לבחור שם משתמש אחר באנגלית, ואז להתחבר איתו)
   - Password: הסיסמה שלך
   - לסמן **Auto Confirm User**
5. חוזרים ל-**SQL Editor** ומריצים (עם השם שלך):
   ```sql
   update public.profiles set is_admin = true, display_name = 'השם שלך' where username = 'admin';
   ```
6. **פונקציית הניהול:** בתפריט הצד: **Edge Functions** ← **Deploy a new function** ← **Via Editor**.
   - שם הפונקציה: `admin-users` (בדיוק כך)
   - מוחקים את הקוד לדוגמה, מדביקים את כל התוכן של `supabase/functions/admin-users/index.ts` ולוחצים על **Deploy**.
   - בהגדרות הפונקציה (**Details** או **Settings**) מכבים את **Verify JWT with legacy secret** (או **Enforce JWT verification**) ושומרים. הפונקציה בודקת בעצמה שרק מנהל משתמש בה.
7. **שני הפרטים שצריך לאתר:** **Project Settings** ← **API Keys** (ובכתובת הפרויקט ב-**Data API**). מעתיקים:
   - **Project URL** (נראה כמו `https://abcd1234.supabase.co`)
   - המפתח הציבורי: **Publishable key**, או **anon public** בלשונית Legacy. המפתח הזה מותר לחשיפה. אסור להעתיק את המפתח הסודי (secret / service_role).

### שלב 2: GitHub (שמירת הקוד)

1. נכנסים ל-[github.com](https://github.com), נרשמים ולוחצים על **New repository**. שם: `work-clock`. אפשר לבחור **Private**.
2. מעלים את כל קבצי הפרויקט (בלי התיקיות `node_modules` ו-`dist`). הדרך הפשוטה: בעמוד המאגר לוחצים על **uploading an existing file** וגוררים את הקבצים והתיקיות.
   או משורת הפקודה:
   ```bash
   git init
   git add .
   git commit -m "first version"
   git branch -M main
   git remote add origin https://github.com/<שם-המשתמש-שלך>/work-clock.git
   git push -u origin main
   ```

### שלב 3: Cloudflare Pages (האתר עצמו)

1. נכנסים ל-[dash.cloudflare.com](https://dash.cloudflare.com) ונרשמים בחינם.
2. **Workers & Pages** ← **Create** ← לשונית **Pages** ← **Connect to Git**, ובוחרים את המאגר `work-clock`.
3. הגדרות הבנייה:
   - Framework preset: **React (Vite)** (או None)
   - Build command: `npm run build`
   - Build output directory: `dist`
4. תחת **Environment variables** מוסיפים שני משתנים:
   - `VITE_SUPABASE_URL` = ה-Project URL משלב 1
   - `VITE_SUPABASE_ANON_KEY` = המפתח הציבורי משלב 1
5. לוחצים על **Save and Deploy**. אחרי דקה-שתיים האתר זמין בכתובת `https://work-clock.pages.dev` (או שם דומה).

> מעכשיו כל שינוי שתעלה ל-GitHub יעלה לאתר אוטומטית.
> אם משנים משתני סביבה ב-Cloudflare, צריך לבנות מחדש: **Deployments** ← **Retry deployment**.

### שלב 4: שמירה על הפרויקט ער (מומלץ)

Supabase משהה פרויקט חינמי אחרי שבוע בלי פעילות. הנתונים לא נמחקים, אבל צריך להפעיל אותו מחדש ידנית.
בקוד יש משימה אוטומטית (`.github/workflows/keep-alive.yml`) שפונה למסד כל 3 ימים. כדי להפעיל אותה:

1. במאגר ב-GitHub: **Settings** ← **Secrets and variables** ← **Actions** ← **New repository secret**.
2. מוסיפים שני Secrets עם אותם ערכים: `SUPABASE_URL` ו-`SUPABASE_ANON_KEY`.
3. בלשונית **Actions** בוחרים "Keep Supabase awake" ולוחצים על **Run workflow** כדי לבדוק שזה עובד (וי ירוק).

---

## שימוש יומיומי

- **הוספת משתמש:** נכנסים כמנהל ← לחיצה על השם למעלה ← **ניהול משתמשים**. בוחרים שם משתמש (אפשר גם בעברית) וסיסמה ראשונית, ומוסרים אותם למשתמש.
- **שכח סיסמה:** בניהול משתמשים ← **איפוס סיסמה**.
- **משתמש שעזב:** לחיצה על "פעיל" משביתה אותו (הנתונים נשמרים, והוא לא יכול להיכנס).
- **שינוי שם האתר:** בקובץ `src/config.ts` משנים את `APP_NAME` וגם את `<title>` בקובץ `index.html`.

## מבנה הפרויקט

```
src/
  config.ts            שם האתר והגדרות כלליות
  api/                 תקשורת עם Supabase (ומצב הדגמה)
  lib/time.ts          חישובי ימים, מחזורים ופיצול בחצות
  lib/hebrew.ts        תאריך עברי
  lib/export.ts        ייצוא לאקסל
  components/          מסכים ורכיבים
supabase/
  schema.sql           טבלאות והרשאות
  functions/admin-users פונקציית ניהול משתמשים
```

## איך מחושבות השעות

- כל לחיצה על "התחלה" ו"סיום" יוצרת מקטע. ביום אחד יכולים להיות כמה מקטעים.
- מקטע שעובר את חצות מתחלק: השעות עד 24:00 נספרות ביום הראשון, והשאר ביום הבא (וגם במחזור הבא, אם עברת את ה-26).
- השעון נשמר בשרת, כך שסגירת הדפדפן או כיבוי המחשב לא עוצרים אותו.
- "שנה" = שנה לועזית: כל המחזורים שמסתיימים בינואר עד דצמבר.
