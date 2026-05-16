import fsp from 'fs/promises';
import path from 'path';
import { isHtmlFile, stripHtmlExtension } from '../utils/utils.js';
import { fetchAllComments, avgRating } from './commentService.js';
import { NOVELS_DIR } from '../config/paths.js';

function buildStatsMap(allComments) {
  const map = {};
  for (const [id, comments] of Object.entries(allComments)) {
    map[id] = { count: comments.length, avg: avgRating(comments) };
  }
  return map;
}

function getCommentStats(statsMap, id) {
  return statsMap[id] || { count: 0, avg: null };
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

async function scanNovels() {
  const novels = [];
  try {
    await fsp.access(NOVELS_DIR);
  } catch {
    return novels;
  }

  const entries = await fsp.readdir(NOVELS_DIR, { withFileTypes: true });

  const singleEntries = entries.filter(e => e.isFile() && isHtmlFile(e.name));
  const seriesEntries = entries.filter(e => e.isDirectory());

  const [allComments, ...seriesEpisodesList] = await Promise.all([
    fetchAllComments(),
    ...seriesEntries.map(e => readSeriesEpisodes(path.join(NOVELS_DIR, e.name), e.name)),
  ]);

  const statsMap = buildStatsMap(allComments);

  for (const entry of singleEntries) {
    const id = stripHtmlExtension(entry.name);
    const stats = getCommentStats(statsMap, id);
    novels.push({
      id,
      title: id,
      type: 'single',
      htmlPath: `/novels/${entry.name}`,
      commentCount: stats.count,
      avgRating: stats.avg,
    });
  }

  for (let i = 0; i < seriesEntries.length; i++) {
    const entry = seriesEntries[i];
    const id = entry.name;
    const rawEpisodes = seriesEpisodesList[i];
    const episodes = rawEpisodes.map(ep => ({
      ...ep,
      commentCount: getCommentStats(statsMap, `${id}__ep__${ep.number}`).count,
    }));
    const stats = getCommentStats(statsMap, id);
    novels.push({
      id,
      title: id,
      type: 'series',
      episodes,
      episodeCount: episodes.length,
      commentCount: stats.count,
      avgRating: stats.avg,
    });
  }

  return novels;
}

export { scanNovels };
