import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCV4zQ1gKvcrLspRl5eG2PaBqa9x7dxvSI",
  authDomain: "ronsharavi.firebaseapp.com",
  projectId: "ronsharavi",
  storageBucket: "ronsharavi.firebasestorage.app",
  messagingSenderId: "556800505802",
  appId: "1:556800505802:web:f4dabf28bffd0c1613c133"
};

const ADMIN_EMAIL = 'ron6eli@gmail.com';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

async function ensureUserDoc(user) {
  try {
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      await setDoc(userRef, {
        email: user.email,
        name: user.displayName || user.email.split('@')[0],
        role: user.email === ADMIN_EMAIL ? 'admin' : 'student',
        createdAt: serverTimestamp()
      });
    }
  } catch (e) { console.error('Firestore user doc error:', e); }
}

let isRegister = false;

// ---------- MODAL ----------
window.openLoginModal = () => {
  document.getElementById('login-modal').classList.add('active');
  document.body.style.overflow = 'hidden';
};
window.closeLoginModal = () => {
  document.getElementById('login-modal').classList.remove('active');
  document.body.style.overflow = '';
};
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.closeLoginModal();
});

function showError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg; el.style.display = 'block';
  document.getElementById('auth-success').style.display = 'none';
}
function showSuccess(msg) {
  const el = document.getElementById('auth-success');
  el.textContent = msg; el.style.display = 'block';
  document.getElementById('auth-error').style.display = 'none';
}
function hideMessages() {
  document.getElementById('auth-error').style.display = 'none';
  document.getElementById('auth-success').style.display = 'none';
}

// ---------- AUTH STATE ----------
onAuthStateChanged(auth, async (user) => {
  if (user) {
    await ensureUserDoc(user);
    if (!window._loginAttempted) return;
    if (user.providerData[0]?.providerId === 'password' && !user.emailVerified) {
      document.getElementById('verify-banner').style.display = 'block';
      return;
    }
    window.location.href = './safety_learning_1.html';
  }
});

// ---------- GOOGLE LOGIN ----------
window.doGoogleLogin = async () => {
  hideMessages();
  window._loginAttempted = true;
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    await ensureUserDoc(cred.user);
    window.location.href = './safety_learning_1.html';
  } catch (e) {
    window._loginAttempted = false;
    console.error('Google login error:', e.code, e.message);
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
    if (e.code === 'auth/unauthorized-domain') {
      showError('הדומיין הנוכחי אינו מורשה ב-Firebase. יש להוסיפו ב-Authentication → Settings → Authorized domains');
    } else if (e.code === 'auth/popup-blocked') {
      showError('החלון הקופץ נחסם על ידי הדפדפן — אפשר חלונות קופצים לאתר זה ונסה שוב');
    } else if (e.code === 'auth/network-request-failed') {
      showError('בעיית חיבור לאינטרנט — בדוק את החיבור ונסה שוב');
    } else {
      showError('שגיאה בהתחברות עם Google: ' + (e.code || e.message));
    }
  }
};

// ---------- TOGGLE REGISTER / LOGIN ----------
window.toggleAuthMode = () => {
  isRegister = !isRegister;
  hideMessages();
  document.getElementById('verify-banner').style.display = 'none';
  document.getElementById('auth-name').style.display = isRegister ? 'block' : 'none';
  document.getElementById('pw-strength').style.display = 'none';
  document.getElementById('auth-submit').textContent = isRegister ? 'הירשם' : 'התחבר';
  document.getElementById('auth-toggle').textContent = isRegister
    ? 'כבר יש לך חשבון? התחבר כאן'
    : 'אין לך חשבון? הירשם כאן';
  document.getElementById('auth-password').value = '';
};

// ---------- PASSWORD STRENGTH ----------
window.checkStrength = () => {
  if (!isRegister) return;
  const pw = document.getElementById('auth-password').value;
  document.getElementById('pw-strength').style.display = pw.length > 0 ? 'block' : 'none';
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;

  const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
  const labels = ['חלשה', 'בינונית', 'טובה', 'חזקה מאוד'];
  for (let i = 0; i < 4; i++) {
    document.getElementById('pw' + (i + 1)).style.background = i < score ? colors[score - 1] : '#e2e8f0';
  }
  document.getElementById('pw-label').textContent = score > 0 ? labels[score - 1] : '';
  document.getElementById('pw-label').style.color = score > 0 ? colors[score - 1] : '';
};

// ---------- EMAIL AUTH ----------
window.doEmailAuth = async () => {
  hideMessages();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const name = document.getElementById('auth-name').value.trim();

  if (!email || !password) { showError('יש למלא אימייל וסיסמה'); return; }
  if (isRegister && password.length < 6) { showError('הסיסמה חייבת להכיל לפחות 6 תווים'); return; }
  if (isRegister && !name) { showError('יש למלא שם מלא'); return; }

  const btn = document.getElementById('auth-submit');
  btn.disabled = true;
  btn.textContent = 'רגע...';
  window._loginAttempted = true;

  try {
    if (isRegister) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await ensureUserDoc(cred.user);
      await sendEmailVerification(cred.user);
      window._loginAttempted = false;
      document.getElementById('verify-banner').style.display = 'block';
      showSuccess('נרשמת בהצלחה! שלחנו קוד אימות למייל ' + email);
    } else {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await ensureUserDoc(cred.user);
      if (!cred.user.emailVerified) {
        window._loginAttempted = false;
        document.getElementById('verify-banner').style.display = 'block';
        showError('המייל שלך עדיין לא אומת. בדוק את תיבת הדואר.');
      } else {
        window.location.href = './safety_learning_1.html';
      }
    }
  } catch (e) {
    window._loginAttempted = false;
    const msgs = {
      'auth/email-already-in-use': 'האימייל הזה כבר רשום. נסה להתחבר.',
      'auth/invalid-email': 'כתובת אימייל לא תקינה.',
      'auth/weak-password': 'הסיסמה חלשה מדי. נסה לפחות 6 תווים.',
      'auth/invalid-credential': 'אימייל או סיסמה שגויים.',
      'auth/user-not-found': 'לא נמצא חשבון עם האימייל הזה.',
      'auth/wrong-password': 'סיסמה שגויה.',
      'auth/too-many-requests': 'יותר מדי ניסיונות. נסה שוב בעוד כמה דקות.',
    };
    showError(msgs[e.code] || 'שגיאה: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = isRegister ? 'הירשם' : 'התחבר';
  }
};

// ---------- RESEND VERIFICATION ----------
window.resendVerification = async () => {
  try {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
      showSuccess('מייל אימות נשלח מחדש!');
    }
  } catch (e) { showError('לא ניתן לשלוח כרגע. נסה שוב בעוד דקה.'); }
};

// ---------- FORGOT PASSWORD ----------
window.doForgotPassword = async () => {
  hideMessages();
  const email = document.getElementById('auth-email').value.trim();
  if (!email) { showError('הכנס את האימייל שלך למעלה ואז לחץ על "שכחתי סיסמה"'); return; }
  try {
    await sendPasswordResetEmail(auth, email);
    showSuccess('שלחנו קישור לאיפוס סיסמה ל-' + email);
  } catch (e) { showError('לא נמצא חשבון עם האימייל הזה.'); }
};
