// =============================================================
//  redeemCoupon — Firebase Callable Function (Gen 1)
// =============================================================
//  מימוש קופון "גישה" (type: "access").
//  מתאים בדיוק למבנה הקיים שלך ב-Firestore:
//
//  coupons/<CODE>:
//    code:      "SC-9Z3BGC"
//    type:      "access"
//    value:     20             // מספר ימי הגישה שהקופון נותן
//    maxUses:   30             // מקס מימושים (0 = ללא הגבלה)
//    usedCount: 0              // כמה כבר מומשו
//    expiry:    "2026-07-30"   // תוקף הקופון (string YYYY-MM-DD)
//    createdAt: "2026-06-12"
//
//  users/<uid> (מה שהפונקציה כותבת אחרי מימוש מוצלח):
//    premium:          true
//    plan:             "coupon"
//    premiumUntil:     "<ISO>"            // עכשיו + value ימים (או הארכה)
//    premiumGrantedAt: "<ISO>"
//    premiumGrantedBy: "coupon:<CODE>"
//
//  שילוב ב-functions/index.js:
//    הדבק את הבלוק הזה (או require לקובץ נפרד) וודא ש-
//    admin.initializeApp() כבר נקרא פעם אחת ב-index.js.
// =============================================================

const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

// אם admin עדיין לא אותחל במקום אחר ב-index.js, בטל את ההערה:
// if (!admin.apps.length) admin.initializeApp();

const REGION = "europe-west1"; // ← חייב להיות זהה ל-region בצד הלקוח!

exports.redeemCoupon = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    // 1) חובה להיות מחובר
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "יש להתחבר כדי לממש קופון."
      );
    }
    const uid = context.auth.uid;

    // 2) ניקוי הקוד (הקופונים נשמרים באותיות גדולות, וה-doc id הוא הקוד)
    const code = String((data && data.code) || "").trim().toUpperCase();
    if (!code) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "יש להזין קוד קופון."
      );
    }

    const db = admin.firestore();
    const couponRef = db.collection("coupons").doc(code);
    const userRef = db.collection("users").doc(uid);

    // 3) הכל בתוך טרנזקציה — מונע מירוץ ושימוש כפול
    const result = await db.runTransaction(async (tx) => {
      // --- כל הקריאות לפני כל הכתיבות (דרישה של Firestore) ---
      const couponSnap = await tx.get(couponRef);
      if (!couponSnap.exists) {
        throw new functions.https.HttpsError("not-found", "קוד קופון לא קיים.");
      }
      const c = couponSnap.data();

      const redemptionRef = couponRef.collection("redemptions").doc(uid);
      const redemptionSnap = await tx.get(redemptionRef);

      const userSnap = await tx.get(userRef);

      // --- ולידציות ---
      // סוג נתמך
      if (c.type && c.type !== "access") {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "סוג הקופון אינו נתמך."
        );
      }

      // תוקף הקופון. expiry הוא string "YYYY-MM-DD" → תקף עד סוף אותו יום.
      if (c.expiry) {
        const expiryEnd = Date.parse(c.expiry + "T23:59:59.999Z");
        if (!isNaN(expiryEnd) && Date.now() > expiryEnd) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "תוקף הקופון פג."
          );
        }
      }

      // מכסת שימושים (0 = ללא הגבלה)
      const maxUses = Number(c.maxUses) || 0;
      const usedCount = Number(c.usedCount) || 0;
      if (maxUses > 0 && usedCount >= maxUses) {
        throw new functions.https.HttpsError(
          "resource-exhausted",
          "הקופון מוצה — נגמרו השימושים."
        );
      }

      // מניעת מימוש כפול ע"י אותו משתמש
      if (redemptionSnap.exists) {
        throw new functions.https.HttpsError(
          "already-exists",
          "כבר מימשת את הקופון הזה."
        );
      }

      // --- חישוב premiumUntil (מאריך אם כבר יש גישה פעילה) ---
      const days = Number(c.value) || 0;
      if (days <= 0) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "הקופון אינו מגדיר ימי גישה תקינים."
        );
      }

      const now = Date.now();
      let base = now;
      if (userSnap.exists) {
        const existing = userSnap.get("premiumUntil");
        const existingMs = existing ? Date.parse(existing) : NaN;
        if (!isNaN(existingMs) && existingMs > now) base = existingMs;
      }
      const premiumUntil = new Date(base + days * 86400000).toISOString();
      const nowIso = new Date(now).toISOString();

      // --- כתיבות ---
      tx.set(
        userRef,
        {
          premium: true,
          plan: "coupon",
          premiumUntil: premiumUntil,
          premiumGrantedAt: nowIso,
          premiumGrantedBy: "coupon:" + code,
        },
        { merge: true }
      );

      tx.update(couponRef, { usedCount: usedCount + 1 });

      tx.set(redemptionRef, {
        uid: uid,
        redeemedAt: nowIso,
        days: days,
      });

      return { premiumUntil, days };
    });

    return {
      success: true,
      message: `הקופון מומש בהצלחה! נוספו ${result.days} ימי גישה.`,
      premiumUntil: result.premiumUntil,
    };
  });
