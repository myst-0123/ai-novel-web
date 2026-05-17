import fs from 'fs';
import path from 'path';
import { drive, DRIVE_FOLDER_ID } from '../config/drive.js';
import { NOVELS_DIR } from '../config/paths.js';
import { rebuildManifest } from './manifestService.js';

async function listDriveFiles(folderId) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType)',
    orderBy: 'name',
    pageSize: 1000,
  });
  return res.data.files || [];
}

async function downloadDriveFile(fileId, destPath) {
  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  fs.writeFileSync(destPath, Buffer.from(response.data));
}

// Drive → ローカルに全ファイルを同期（既存をすべて削除してから再取得）
async function syncFromDrive() {
  if (!drive) return;
  console.log('🔄 Google Drive から同期中...');

  if (fs.existsSync(NOVELS_DIR)) fs.rmSync(NOVELS_DIR, { recursive: true, force: true });
  fs.mkdirSync(NOVELS_DIR, { recursive: true });

  const entries = await listDriveFiles(DRIVE_FOLDER_ID);
  for (const entry of entries) {
    if (entry.mimeType === 'application/vnd.google-apps.folder') {
      const seriesDir = path.join(NOVELS_DIR, entry.name);
      if (!fs.existsSync(seriesDir)) fs.mkdirSync(seriesDir, { recursive: true });
      const seriesFiles = await listDriveFiles(entry.id);
      for (const file of seriesFiles) {
        if (!file.name.toLowerCase().endsWith('.html')) continue;
        await downloadDriveFile(file.id, path.join(seriesDir, file.name));
      }
    } else if (entry.name.toLowerCase().endsWith('.html')) {
      await downloadDriveFile(entry.id, path.join(NOVELS_DIR, entry.name));
    }
  }
  await rebuildManifest();
  console.log('✅ Google Drive 同期完了');
}

export { listDriveFiles, downloadDriveFile, syncFromDrive };
