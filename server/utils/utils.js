import path from 'path';

const HTML_EXTENSION = '.html';

function sanitizeFilename(str) {
  return String(str)
    .trim()
    .replace(/[\0\\/:*?"<>|]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/^\./, '_')
    .slice(0, 200);
}

function safeJoin(base, ...parts) {
  const resolved = path.resolve(base, ...parts);
  if (!resolved.startsWith(path.resolve(base) + path.sep) &&
      resolved !== path.resolve(base)) {
    throw new Error('不正なパスです');
  }
  return resolved;
}

function stripHtmlExtension(filename) {
  return filename.slice(0, -HTML_EXTENSION.length);
}

function isHtmlFile(filename) {
  return filename.endsWith(HTML_EXTENSION);
}

export { HTML_EXTENSION, sanitizeFilename, safeJoin, stripHtmlExtension, isHtmlFile };
