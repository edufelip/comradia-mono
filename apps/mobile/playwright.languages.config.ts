import { defineConfig } from '@playwright/test';
import base from './playwright.atlas.config';
const locales = ['pt-BR', 'es-ES', 'fr-FR', 'de-DE', 'it-IT'];
export default defineConfig({
  ...base,
  testMatch: 'languages.spec.ts',
  projects: locales.flatMap((locale) =>
    (base.projects ?? []).map((project) => ({
      ...project,
      name: `${locale}-${project.name}`,
      use: { ...project.use, locale },
    })),
  ),
});
