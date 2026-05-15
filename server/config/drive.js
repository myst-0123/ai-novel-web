let drive = null;
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || null;

if (
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_REFRESH_TOKEN &&
  DRIVE_FOLDER_ID
) {
  try {
    const { google } = await import('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });
    drive = google.drive({ version: 'v3', auth: oauth2Client });
    console.log('✅ Google Drive 接続完了（OAuth2）');
  } catch (err) {
    console.error('⚠️  Google Drive 初期化失敗（ローカルフォルダを使用）:', err.message);
  }
} else {
  console.warn('⚠️  Google Drive 環境変数未設定 — ローカルフォルダを使用');
}

export { drive, DRIVE_FOLDER_ID };
