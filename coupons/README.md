# מערכת קופונים — מדריך שילוב

נבנה מחדש כדי להתאים בדיוק למבנה ה-Firestore הקיים בפרויקט `ronsharavi`.

## מבנה הנתונים (קיים אצלך)

**`coupons/<CODE>`**
| שדה | סוג | משמעות |
|-----|-----|--------|
| `code` | string | קוד הקופון (זהה ל-doc id) |
| `type` | string | `"access"` — קופון גישה |
| `value` | number | מספר **ימי הגישה** שהקופון נותן |
| `maxUses` | number | מקס מימושים (`0` = ללא הגבלה) |
| `usedCount` | number | כמה כבר מומשו |
| `expiry` | string | תוקף הקופון `"YYYY-MM-DD"` |
| `createdAt` | string | תאריך יצירה |

**`users/<uid>`** (מה שהמימוש כותב)
| שדה | ערך |
|-----|-----|
| `premium` | `true` |
| `plan` | `"coupon"` |
| `premiumUntil` | ISO string = עכשיו + `value` ימים (מאריך אם כבר יש גישה) |
| `premiumGrantedAt` | ISO string |
| `premiumGrantedBy` | `"coupon:<CODE>"` |

## הקבצים

| קובץ | לאן הולך |
|------|----------|
| `redeemCoupon.function.js` | תוכן הפונקציה → `functions/index.js` (או require ממנו) |
| `purchase-page-snippet.js` | קוד צד-לקוח → דף הרכישה |
| `firestore-coupons.rules` | חוקים → למזג ל-`firestore.rules` |

## שלבי התקנה

1. **פונקציה** — הדבק את `redeemCoupon` ב-`functions/index.js` (ודא ש-`admin.initializeApp()` נקרא פעם אחת), ואז:
   ```bash
   cd functions
   npm install
   cd ..
   firebase deploy --only functions:redeemCoupon --project ronsharavi
   ```
2. **דף רכישה** — הדבק את `purchase-page-snippet.js`, ודא ש-`app` הוא ה-Firebase app המאותחל.
3. **חוקים** — מזג את `firestore-coupons.rules` ואז:
   ```bash
   firebase deploy --only firestore:rules --project ronsharavi
   ```

## שני הבאגים הכי סבירים שגרמו ל"לא עובד"

1. **region** — הפונקציה פרוסה ב-`europe-west1`. אם הלקוח קורא לה בלי
   `getFunctions(app, "europe-west1")` הוא פונה ל-`us-central1` ומקבל
   `not-found`. הקוד החדש מציין region במפורש.
2. **תאריך כ-string** — `expiry` נשמר כ-`"2026-07-30"`. השוואה ישירה של
   מחרוזת לתאריך עלולה לסמן קופון תקף כ"פג". הקוד החדש ממיר עם
   `Date.parse(expiry + "T23:59:59.999Z")` — תקף עד סוף היום.

## בדיקה מהירה

עם הקופון הקיים `SC-9Z3BGC` (20 ימי גישה, 0/30 שימושים, תוקף 30-07):
התחבר כמשתמש רגיל, הקלד את הקוד בדף הרכישה ולחץ "ממש".
צפוי: הודעת הצלחה, `users/<uid>.premium=true`, `usedCount` עולה ל-1.
