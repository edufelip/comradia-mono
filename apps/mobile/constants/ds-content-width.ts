export type DsContentWidth = 'form' | 'content' | 'wide' | 'workspace' | 'full';

type DsContentLayout = {
  alignSelf: 'center' | 'flex-start';
  maxWidth: number | undefined;
  paddingHorizontal?: number;
};

/** Content cap for a screen at this viewport width. Phones (< 768) are never capped. */
export function resolveDsContentLayout(
  viewportWidth: number,
  contentWidth: DsContentWidth,
): DsContentLayout {
  if (viewportWidth < 768 || contentWidth === 'full') {
    return { alignSelf: 'center', maxWidth: undefined };
  }
  if (contentWidth === 'workspace' && viewportWidth >= 1024) {
    return { alignSelf: 'flex-start', maxWidth: 1360, paddingHorizontal: 28 };
  }
  if (contentWidth === 'form') return { alignSelf: 'center', maxWidth: 600 };
  if (contentWidth === 'wide' || contentWidth === 'workspace') {
    return { alignSelf: 'center', maxWidth: viewportWidth < 1024 ? 680 : 1040 };
  }
  return { alignSelf: 'center', maxWidth: viewportWidth < 1024 ? 680 : 880 };
}

/** A cap for screens that are not built on DsScreen: web at 768 and up only, undefined elsewhere. */
export function resolveWebWidthCap(
  platform: string,
  viewportWidth: number,
  cap: number,
): number | undefined {
  return platform === 'web' && viewportWidth >= 768 ? cap : undefined;
}
