import { clearEmulators, seedProfiles } from './firebase';

/** Every run starts from empty emulators plus the seeded Discover profiles. */
export default async function globalSetup() {
  await clearEmulators();
  await seedProfiles();
}
