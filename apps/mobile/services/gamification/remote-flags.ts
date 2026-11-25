import { GAM_FLAG_DEFAULTS, parseGamFlags, type GamFlags } from '@/features/gamification/flags';
import { emulatorHost } from '@/services/backend/config';

type ConfigReader = {
  read(key: keyof GamFlags): string;
  activate(): Promise<boolean>;
  fetchAndActivate(): Promise<boolean>;
  onUpdate(next: () => void, failed: () => void): () => void;
};

export function watchRemoteFlags(
  open: () => Promise<ConfigReader>,
  receive: (flags: GamFlags) => void,
) {
  if (emulatorHost()) {
    receive(
      process.env.EXPO_PUBLIC_E2E_GAMIFICATION === 'true'
        ? {
            ...GAM_FLAG_DEFAULTS,
            gam_ui_enabled: true,
            gam_fullscreen_celebrations: true,
            gam_experiment_pct: 100,
          }
        : GAM_FLAG_DEFAULTS,
    );
    return () => {};
  }
  let active = true;
  let stop: (() => void) | undefined;
  const reset = () => {
    if (active) receive(GAM_FLAG_DEFAULTS);
  };
  void open()
    .then(async (config) => {
      if (!active) return;
      const publish = () => {
        if (active) receive(parseGamFlags(config.read));
      };
      await config.fetchAndActivate();
      if (!active) return;
      stop = config.onUpdate(() => {
        void config.activate().then(publish, reset);
      }, reset);
      publish();
    })
    .catch(reset);
  return () => {
    active = false;
    stop?.();
  };
}
