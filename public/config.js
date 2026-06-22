window.API_BASE = (function () {
  const h = location.hostname;
  const isPrivate =
    h === 'localhost'
    || h === '127.0.0.1'
    || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)
    || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)
    || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h);

  if (isPrivate) return `http://${h}:3001`;
  return '';
})();
