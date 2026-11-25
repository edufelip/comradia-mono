// Grants (or removes) the gamAdmin custom claim that every Cravos admin callable
// requires (docs/gamification/admin.md). Emulator or production:
//
//   Emulator (Auth on 127.0.0.1:9099, project demo-comradia):
//     FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node scripts/grant-gam-admin.mjs <uid-or-email>
//   Production (a service-account key with enough IAM, project from the key):
//     GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json node scripts/grant-gam-admin.mjs <uid-or-email> --project comradia-prod
//   Remove:
//     ... grant-gam-admin.mjs <uid-or-email> --remove
//
// The script imports firebase-admin from the functions install (apps/firebase has no
// admin dependency of its own), so no lockfile changes: run it from apps/firebase.
import { createRequire } from 'node:module';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const arg = process.argv[2];
if (!arg || arg.startsWith('--')) {
  console.error('Usage: node scripts/grant-gam-admin.mjs <uid-or-email> [--remove] [--project <id>]');
  process.exit(1);
}
const remove = process.argv.includes('--remove');
const projectFlag = process.argv.indexOf('--project');
const projectId = projectFlag !== -1 ? process.argv[projectFlag + 1] : 'demo-comradia';

const app = getApps().length === 0 ? initializeApp({ projectId }) : getApps()[0];
const auth = getAuth(app);

const user = arg.includes('@')
  ? await auth.getUserByEmail(arg)
  : await auth.getUser(arg);

if (remove) {
  const { gamAdmin: _remove, ...claims } = user.customClaims ?? {};
  await auth.setCustomUserClaims(user.uid, claims);
  console.log(`gamAdmin claim removed from ${user.uid} (${arg}).`);
} else {
  await auth.setCustomUserClaims(user.uid, { ...user.customClaims, gamAdmin: true });
  console.log(`gamAdmin claim granted to ${user.uid} (${arg}). The user must sign in again to pick it up.`);
}
