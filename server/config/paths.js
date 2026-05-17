import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// プロジェクトルート基準のパス定数
export const NOVELS_DIR = path.join(__dirname, '..', '..', 'novels');
export const MANIFEST_PATH = path.join(__dirname, '..', '..', 'novels-manifest.json');
