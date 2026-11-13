import type { Page } from '@playwright/test';
/** Full-page representation: expand the active nested scroll area without changing its width. */
export async function expandScrollContents(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('div'))
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return (
          ['auto', 'scroll'].includes(style.overflowY) &&
          el.scrollHeight > el.clientHeight + 2 &&
          rect.width > 0 &&
          rect.right > 0 &&
          rect.left < innerWidth &&
          rect.bottom > 0 &&
          rect.top < innerHeight &&
          !el.closest('[aria-hidden="true"]')
        );
      })
      .sort((a, b) => b.scrollHeight - a.scrollHeight);
    const target = candidates[0];
    if (!target) return false;
    const height = target.scrollHeight;
    target.scrollTop = 0;
    target.style.height = `${height}px`;
    target.style.maxHeight = 'none';
    target.style.flex = '0 0 auto';
    target.style.overflow = 'visible';
    for (let parent = target.parentElement; parent; parent = parent.parentElement) {
      parent.style.height = 'auto';
      parent.style.minHeight = `${height}px`;
      parent.style.maxHeight = 'none';
      parent.style.overflow = 'visible';
      if (getComputedStyle(parent).position === 'absolute') {
        parent.style.position = 'relative';
        parent.style.inset = 'auto';
      }
    }
    return true;
  });
}

/** Keep the requested width; decorative absolute overflow is not page content. */
export async function captureBounds(page: Page) {
  return page.evaluate(() => ({
    x: 0,
    y: 0,
    width: innerWidth,
    height: Math.max(
      innerHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight,
    ),
  }));
}
