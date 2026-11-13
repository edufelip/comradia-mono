const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path').resolve(__dirname, '../assets/images');
const svg = fs.readFileSync(path + '/comradia-mark.svg', 'utf8');
const mono = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><path d="M21 47c0-15 12-27 27-27 9 0 18 5 22 12M75 49c0 15-12 27-27 27-9 0-18-5-22-12" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round"/><circle cx="48" cy="48" r="8" fill="#fff"/></svg>`;
(async () => {
  await sharp(Buffer.from(svg))
    .flatten({ background: '#C94143' })
    .png()
    .toFile(path + '/icon.png');
  await sharp(Buffer.from(svg))
    .resize(432, 432)
    .png()
    .toFile(path + '/android-icon-foreground.png');
  await sharp({ create: { width: 432, height: 432, channels: 4, background: '#FCE7E7' } })
    .png()
    .toFile(path + '/android-icon-background.png');
  await sharp(Buffer.from(mono))
    .resize(96, 96)
    .png()
    .toFile(path + '/android-icon-monochrome.png');
  await sharp(Buffer.from(svg))
    .resize(400, 400)
    .png()
    .toFile(path + '/splash-icon.png');
  await sharp(Buffer.from(svg))
    .resize(64, 64)
    .png()
    .toFile(path + '/favicon.png');
  await sharp(Buffer.from(mono))
    .resize(96, 96)
    .png()
    .toFile(path + '/notification-icon.png');
})();
