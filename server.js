import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

const NOVELS_DIR = path.join(__dirname, 'novels');
const DATA_DIR = path.join(__dirname, 'data');
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(COMMENTS_FILE)) fs.writeFileSync(COMMENTS_FILE, '{}', 'utf-8');

app.use(express.json());
app.use('/novels', express.static(NOVELS_DIR));

function readComments() {
  try {
    return JSON.parse(fs.readFileSync(COMMENTS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function writeComments(data) {
  fs.writeFileSync(COMMENTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function avgRating(comments) {
  if (!comments || comments.length === 0) return null;
  const sum = comments.reduce((acc, c) => acc + c.rating, 0);
  return Math.round((sum / comments.length) * 10) / 10;
}

function scanNovels() {
  const novels = [];
  const allComments = readComments();

  if (!fs.existsSync(NOVELS_DIR)) return novels;

  const entries = fs.readdirSync(NOVELS_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.html')) {
      const id = entry.name.replace('.html', '');
      const comments = allComments[id] || [];
      novels.push({
        id,
        title: id,
        type: 'single',
        htmlPath: `/novels/${entry.name}`,
        commentCount: comments.length,
        avgRating: avgRating(comments),
      });
    } else if (entry.isDirectory()) {
      const seriesDir = path.join(NOVELS_DIR, entry.name);
      const episodes = [];

      try {
        const files = fs.readdirSync(seriesDir);
        for (const file of files) {
          if (!file.endsWith('.html')) continue;
          const nameWithoutExt = file.replace('.html', '');
          const lastUnderscore = nameWithoutExt.lastIndexOf('_');
          if (lastUnderscore === -1) continue;
          const episodeTitle = nameWithoutExt.substring(0, lastUnderscore);
          const episodeNum = parseInt(nameWithoutExt.substring(lastUnderscore + 1), 10);
          episodes.push({
            fileId: nameWithoutExt,
            title: episodeTitle,
            number: isNaN(episodeNum) ? 0 : episodeNum,
            htmlPath: `/novels/${entry.name}/${file}`,
          });
        }
      } catch {}

      episodes.sort((a, b) => a.number - b.number);

      const id = entry.name;
      const comments = allComments[id] || [];
      novels.push({
        id,
        title: entry.name,
        type: 'series',
        episodes,
        episodeCount: episodes.length,
        commentCount: comments.length,
        avgRating: avgRating(comments),
      });
    }
  }

  return novels;
}

app.get('/api/novels', (req, res) => {
  try {
    res.json(scanNovels());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/novels/:id(*)', (req, res) => {
  try {
    const novel = scanNovels().find(n => n.id === decodeURIComponent(req.params.id));
    if (!novel) return res.status(404).json({ error: 'Not found' });
    res.json(novel);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/comments/:id(*)', (req, res) => {
  try {
    const comments = readComments();
    res.json(comments[decodeURIComponent(req.params.id)] || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/comments/:id(*)', (req, res) => {
  try {
    const { name, rating, comment } = req.body;
    if (!name || !rating || !comment) {
      return res.status(400).json({ error: '必須項目が入力されていません' });
    }
    const ratingNum = parseInt(rating, 10);
    if (ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: '評価は1〜5で入力してください' });
    }

    const comments = readComments();
    const id = decodeURIComponent(req.params.id);
    if (!comments[id]) comments[id] = [];

    const newComment = {
      id: crypto.randomUUID(),
      name: String(name).slice(0, 50),
      rating: ratingNum,
      comment: String(comment).slice(0, 1000),
      createdAt: new Date().toISOString(),
    };

    comments[id].push(newComment);
    writeComments(comments);
    res.status(201).json(newComment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get(/^(?!\/api|\/novels).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
