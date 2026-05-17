import { fetchAllComments, avgRating } from './commentService.js';
import { readManifest } from './manifestService.js';

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

async function scanNovels() {
  const [manifest, allComments] = await Promise.all([
    readManifest(),
    fetchAllComments(),
  ]);

  const statsMap = buildStatsMap(allComments);
  const novels = [];

  for (const entry of manifest.singles) {
    const stats = getCommentStats(statsMap, entry.id);
    novels.push({
      id: entry.id,
      title: entry.id,
      type: 'single',
      htmlPath: entry.htmlPath,
      commentCount: stats.count,
      avgRating: stats.avg,
    });
  }

  for (const entry of manifest.series) {
    const episodes = entry.episodes.map(ep => ({
      ...ep,
      commentCount: getCommentStats(statsMap, `${entry.id}__ep__${ep.number}`).count,
    }));
    const stats = getCommentStats(statsMap, entry.id);
    novels.push({
      id: entry.id,
      title: entry.id,
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
