import fsp from 'fs/promises';
import path from 'path';
import { isHtmlFile, stripHtmlExtension } from '../utils/utils.js';
import { NOVELS_DIR, MANIFEST_PATH } from '../config/paths.js';

const EMPTY_MANIFEST = { singles: [], series: [] };

async function readManifest() {
  try {
    const raw = await fsp.readFile(MANIFEST_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return EMPTY_MANIFEST;
  }
}

async function writeManifest(data) {
  await fsp.writeFile(MANIFEST_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

async function readSeriesEpisodes(seriesDir, seriesName) {
  const episodes = [];
  try {
    const files = await fsp.readdir(seriesDir);
    for (const file of files) {
      if (!isHtmlFile(file)) continue;
      const nameWithoutExt = stripHtmlExtension(file);
      const lastUnderscore = nameWithoutExt.lastIndexOf('_');
      if (lastUnderscore === -1) continue;
      const episodeTitle = nameWithoutExt.substring(0, lastUnderscore);
      const episodeNum = parseInt(nameWithoutExt.substring(lastUnderscore + 1), 10);
      episodes.push({
        fileId: nameWithoutExt,
        title: episodeTitle,
        number: isNaN(episodeNum) ? 0 : episodeNum,
        htmlPath: `/novels/${seriesName}/${file}`,
      });
    }
  } catch {}
  return episodes.sort((a, b) => a.number - b.number);
}

async function rebuildManifest() {
  const singles = [];
  const series = [];

  try {
    await fsp.access(NOVELS_DIR);
  } catch {
    await writeManifest(EMPTY_MANIFEST);
    return EMPTY_MANIFEST;
  }

  const entries = await fsp.readdir(NOVELS_DIR, { withFileTypes: true });
  const singleEntries = entries.filter(e => e.isFile() && isHtmlFile(e.name));
  const seriesEntries = entries.filter(e => e.isDirectory());

  for (const entry of singleEntries) {
    const id = stripHtmlExtension(entry.name);
    singles.push({ id, htmlPath: `/novels/${entry.name}` });
  }

  const seriesEpisodesList = await Promise.all(
    seriesEntries.map(e => readSeriesEpisodes(path.join(NOVELS_DIR, e.name), e.name))
  );

  for (let i = 0; i < seriesEntries.length; i++) {
    series.push({ id: seriesEntries[i].name, episodes: seriesEpisodesList[i] });
  }

  const manifest = { singles, series };
  await writeManifest(manifest);
  return manifest;
}

export { readManifest, writeManifest, rebuildManifest };
