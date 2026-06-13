// =============================================================
//  קוד צד-לקוח לדף הרכישה — קריאה ל-redeemCoupon
// =============================================================
//  הדבק את זה בדף הרכישה (שם המשתמש מקליד את הקופון).
//  משתמש ב-Firebase v10 modular SDK, כמו ב-js/auth.js שלך.
//
//  ❗ הכי חשוב: getFunctions(app, "europe-west1")
//     ה-region חייב להיות זהה לזה שהפונקציה פרוסה בו,
//     אחרת תקבל שגיאת "not-found"/"internal" והקופון "לא יעבוד".
// =============================================================

import { getFunctions, httpsCallable } from
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";

// 'app' = ה-Firebase app שכבר אתחלת בדף (initializeApp(firebaseConfig))
const functions = getFunctions(app, "europe-west1"); // ← region!
const redeemCouponFn = httpsCallable(functions, "redeemCoupon");

/**
 * קורא לפונקציה. מחזיר את התשובה או זורק שגיאה עם הודעה בעברית.
 * @param {string} code קוד הקופון מהשדה
 */
export async function redeemCoupon(code) {
  const clean = (code || "").trim();
  if (!clean) throw new Error("יש להזין קוד קופון.");
  const res = await redeemCouponFn({ code: clean });
  return res.data; // { success, message, premiumUntil }
}

// ---------- דוגמת שימוש מול שדה קלט וכפתור ----------
// HTML מינימלי לדף הרכישה:
//   <input id="coupon-input" placeholder="קוד קופון">
//   <button id="coupon-btn">ממש קופון</button>
//   <div id="coupon-msg"></div>

const btn = document.getElementById("coupon-btn");
if (btn) {
  btn.addEventListener("click", async () => {
    const msg = document.getElementById("coupon-msg");
    const input = document.getElementById("coupon-input");
    btn.disabled = true;
    msg.textContent = "רגע...";
    try {
      const data = await redeemCoupon(input.value);
      msg.style.color = "#065f46";
      msg.textContent = data.message; // "הקופון מומש בהצלחה! נוספו 20 ימי גישה."
      // כאן אפשר לרענן את מצב המשתמש / להעביר לאפליקציה:
      setTimeout(() => location.reload(), 1200);
    } catch (e) {
      msg.style.color = "#dc2626";
      // Firebase callable מחזיר את ה-message שלנו ב-e.message
      msg.textContent = e.message || "שגיאה במימוש הקופון.";
    } finally {
      btn.disabled = false;
    }
  });
}
