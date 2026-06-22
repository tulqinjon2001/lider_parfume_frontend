const fs = require('fs');
const path = require('path');

const apiUrl = (process.env.API_URL || '').replace(/\/$/, '');

const content = apiUrl
  ? `window.API_BASE = '${apiUrl}';\n`
  : `window.API_BASE = (function () {
  const h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:3001';
  return '';
})();\n`;

const out = path.join(__dirname, '../public/config.js');
fs.writeFileSync(out, content);
console.log('config.js yaratildi → API_BASE =', apiUrl || '(localhost avtomatik)');
