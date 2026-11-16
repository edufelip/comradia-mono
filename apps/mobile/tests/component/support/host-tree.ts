import { isHiddenFromAccessibility, screen } from '@testing-library/react-native';

type Serialized = { type: string; children?: (Serialized | string)[] | null };

/** The rendered tree as `toJSON` reports it (host components only). */
export function serializedTree(): Serialized {
  return screen.toJSON() as Serialized;
}

/** Every host component type in the rendered tree, in render order. */
export function collectHostTypes(
  node: Serialized | string | null = serializedTree(),
  found: string[] = [],
): string[] {
  if (node === null || typeof node === 'string') return found;
  found.push(node.type);
  node.children?.forEach((child) => collectHostTypes(child, found));
  return found;
}

/** Host children rendered directly under the test container (handles fragments). */
export function countHostChildren(): number {
  return screen.container.children.filter((child) => typeof child !== 'string').length;
}

/** Direct children of the root element that assistive tech cannot reach. */
export function countHiddenHostChildren(): number {
  return (screen.root?.children ?? []).filter(
    (child) => typeof child !== 'string' && isHiddenFromAccessibility(child),
  ).length;
}
