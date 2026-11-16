import { mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
function segment(value) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value) || value.includes('..'))
    throw new Error('Invalid atlas path segment');
  return value;
}
export function createRunRoot(base, id) {
  mkdirSync(base, { recursive: true });
  const root = resolve(base, segment(id));
  mkdirSync(root); // Deliberately fail if another run already owns this directory.
  return root;
}
export function checkpointPath(root, flow, id, viewport) {
  return join(root, segment(flow), segment(id), `${segment(viewport)}.png`);
}

export function validateManifest(manifest) {
  const ids = new Set();
  const flowIds = new Set();
  const web = [];
  for (const [name, size] of Object.entries(manifest.viewports)) {
    segment(name);
    if (
      !Number.isInteger(size.width) ||
      !Number.isInteger(size.height) ||
      size.width < 1 ||
      size.height < 1
    )
      throw new Error('Invalid viewport');
  }
  for (const flow of manifest.flows) {
    segment(flow.id);
    if (flowIds.has(flow.id)) throw new Error('Duplicate flow ID');
    flowIds.add(flow.id);
    for (const checkpoint of flow.checkpoints) {
      segment(checkpoint.id);
      if (ids.has(checkpoint.id)) throw new Error('Duplicate checkpoint ID');
      ids.add(checkpoint.id);
      for (const viewport of checkpoint.viewports) {
        if (!manifest.viewports[viewport]) throw new Error('Unknown viewport');
        checkpointPath('/atlas', flow.id, checkpoint.id, viewport);
      }
      if (checkpoint.platforms.includes('web')) {
        if (!checkpoint.viewports.length) throw new Error('Web checkpoint has no viewport');
        web.push(checkpoint);
      }
    }
  }
  return web;
}
