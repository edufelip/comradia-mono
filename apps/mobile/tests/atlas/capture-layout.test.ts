import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { captureBounds, expandScrollContents } from './capture-layout';
test('captures keep viewport width despite decorative overflow and include expanded content', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setContent(
      '<style>html,body{margin:0;height:100%}</style><main style="height:100%;position:relative"><div style="position:absolute;left:180px;top:664px;width:340px;height:340px;border-radius:50%;background:pink"></div></main>',
    );
    assert.equal(await expandScrollContents(page), false);
    const bounds = await captureBounds(page);
    assert.deepEqual(bounds, { x: 0, y: 0, width: 390, height: 844 });
    const png = await page.screenshot({ fullPage: true, clip: bounds });
    assert.equal(png.readUInt32BE(16), 390);
    assert.equal(png.readUInt32BE(20), 844);
    await page.setContent(
      '<style>html,body{margin:0;height:100%}</style><main style="height:100%"><div style="height:100%;overflow-y:auto"><article style="height:1600px">Long content</article></div></main>',
    );
    assert.equal(await expandScrollContents(page), true);
    const longBounds = await captureBounds(page);
    assert.equal(longBounds.width, 390);
    assert.ok(longBounds.height >= 1600);
    const longPng = await page.screenshot({ fullPage: true, clip: longBounds });
    assert.equal(longPng.readUInt32BE(16), 390);
    assert.ok(longPng.readUInt32BE(20) >= 1600);
  } finally {
    await browser.close();
  }
});
