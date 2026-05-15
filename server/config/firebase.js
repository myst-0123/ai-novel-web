let db = null;
let FieldValue = null;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const firestoreModule = await import('firebase-admin/firestore');
    FieldValue = firestoreModule.FieldValue;
    if (!getApps().length) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({ credential: cert(serviceAccount) });
    }
    db = firestoreModule.getFirestore();
    console.log('✅ Firestore 接続完了');
  } catch (err) {
    console.error('⚠️  Firestore 初期化失敗（コメント機能は無効）:', err.message);
  }
} else {
  console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT 未設定 — コメント機能は無効です');
}

export { db, FieldValue };
