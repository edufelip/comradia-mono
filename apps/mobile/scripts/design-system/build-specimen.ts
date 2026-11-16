import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderSpecimen } from './specimen';

export const SPECIMEN_PATH = resolve(__dirname, '../../../../docs/design-system-specimen.html');

writeFileSync(SPECIMEN_PATH, renderSpecimen());
console.log(`wrote ${SPECIMEN_PATH}`);
