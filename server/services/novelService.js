import fs from 'fs';
import path from 'path';
import { isHtmlFile, stripHtmlExtension } from '../utils/utils.js';
import { fetchComments, avgRating } from './commentService.js';
import { NOVELS_DIR } from '../config/paths.js';

function collectNovelIds(entries) {
  return entries.flatMap(entry => {
    if (entry.isFile() && isHtmlFile(entry.name)) {
      return [stripHtmlExtension(entry.name)];
    }
    if (entry.isDirectory()) {
      return [entry.name];
    }
    return [];
  });
}

async function buildCommentStatsMap(novelIds) {
  const commentStats = await Promise.all(
    novelIds.map(async id => {
      const comments = await fetchComments(id);
      return { id, count: comments.length, avg: avgRating(comments) };
    })
  );
  return Object.fromEntries(commentStats.map(s => [s.id, s]));
}

function getCommentStats(statsMap, id) {
  return statsMap[id] || { count: 0, avg: null };
}

function readSeriesEpisodes(seriesDir, seriesName) {
  const episodes = [];
  try {
    const files = fs.readdirSync(seriesDir);
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
  if (!fs.existsSync(NOVELS_DIR)) return novels;

  const entries = fs.readdirSync(NOVELS_DIR, { withFileTypes: true });
  const statsMap = await buildCommentStatsMap(collectNovelIds(entries));

  for (const entry of entries) {
    if (entry.isFile() && isHtmlFile(entry.name)) {
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
    } else if (entry.isDirectory()) {
      const seriesDir = path.join(NOVELS_DIR, entry.name);
      const id = entry.name;
      const rawEpisodes = readSeriesEpisodes(seriesDir, id);

      const epCommentCounts = await Promise.all(
        rawEpisodes.map(async ep => {
          const comments = await fetchComments(`${id}__ep__${ep.number}`);
          return { number: ep.number, count: comments.length };
        })
      );
      const epCountMap = Object.fromEntries(epCommentCounts.map(e => [e.number, e.count]));
      const episodes = rawEpisodes.map(ep => ({
        ...ep,
        commentCount: epCountMap[ep.number] ?? 0,
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
  }

  return novels;
}

export { scanNovels };
