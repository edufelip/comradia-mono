import { expect, type Page } from '@playwright/test';
type Checkpoint = {
  id: string;
  setup: string;
  expect: string;
  platforms: string[];
  viewports: string[];
};
async function control(page: Page, method: string, ...args: unknown[]) {
  return page.evaluate(({ method, args }) => (window as any).__COMRADIA_ATLAS__[method](...args), {
    method,
    args,
  });
}
export async function captureCheckpoint(page: Page, c: Checkpoint): Promise<void> {
  const [flow, state] = c.id.split('.');
  const routes: Record<string, string> = {
    '01-entry': '/',
    '02-welcome': '/welcome',
    '03-registration': '/register',
    '04-verification': '/verify-phone?phone=%2B5511999990000',
    '05-onboarding-basics': '/vibe',
    '06-onboarding-values': '/values',
    '07-onboarding-starter': '/starter',
    '08-discovery': '/discover',
    '09-discovery-filters': '/discover',
    '10-match': '/match/maya_test-user',
    '11-matches': '/matches',
    '12-chat': '/chat/maya_test-user',
    '13-profile': '/profile',
    '14-safety': '/safety/maya?context=profile',
    '15-notifications-web': '/profile',
  };
  if (!routes[flow]) throw new Error(`Native/unknown checkpoint: ${c.id}`);
  await page.addInitScript(
    ({ id }) => {
      (window as any).__COMRADIA_ATLAS_BOOT__ = { id };
    },
    { id: c.id },
  );
  await page.goto(
    (flow === '10-match' && state === 'keep-swiping') || flow === '14-safety'
      ? '/discover'
      : routes[flow],
  );
  await expect
    .poll(async () => {
      if (c.id.startsWith('04-')) await page.clock.runFor(16);
      return page.evaluate(() => (window as any).__COMRADIA_ATLAS__?.ready);
    })
    .toBeTruthy();
  if (c.id.startsWith('04-')) await page.clock.runFor(100);
  if (flow === '14-safety') await control(page, 'pushSafety');
  if (flow === '10-match' && state === 'keep-swiping') await control(page, 'pushMatch');
  const id = (name: string) => page.getByTestId(name);
  const click = async (name: string) => {
    await id(name).click();
    if (c.id.startsWith('04-')) await page.clock.runFor(100);
  };
  const fill = async (name: string, value: string) => {
    await id(name).fill(value);
    if (c.id.startsWith('04-')) await page.clock.runFor(100);
  };
  const visible = async (name: string) => {
    if (c.id.startsWith('04-')) {
      await expect
        .poll(async () => {
          await page.clock.runFor(16);
          return id(name).isVisible();
        })
        .toBe(true);
    } else await expect(id(name)).toBeVisible();
  };
  if (flow === '04-verification' && state !== 'invalid-route') await visible('verify-code-input');
  const hold = async (name: string) => control(page, 'hold', name);
  const fail = async (name: string, code = 'network') => control(page, 'fail', name, code);
  const unsupported = () => {
    throw new Error(`Checkpoint driver not implemented: ${c.id}. ${c.setup}`);
  };
  if (flow === '01-entry') {
    if (state === 'loading') return visible('session-loading');
    if (state === 'profile-error') return visible('session-error');
    return visible(
      state === 'signed-out'
        ? 'welcome-cta-start'
        : state === 'onboarding'
          ? 'onboarding-name'
          : 'discover-screen',
    );
  }
  if (flow === '02-welcome') {
    if (state === 'signup' || state === 'login') {
      await click(`welcome-cta-${state === 'signup' ? 'start' : 'login'}`);
      return visible('register-phone-input');
    }
    if (state === 'default') return visible('welcome-cta-start');
    if (state === 'portuguese' || state === 'spanish') {
      await expect(page.getByRole('heading').first()).toContainText(
        state === 'portuguese' ? 'Conheça' : 'Conoce',
      );
      return visible('welcome-cta-start');
    }
    if (state === 'dark') {
      await page.emulateMedia({ colorScheme: 'dark' });
      return visible('welcome-cta-start');
    }
    return unsupported();
  }
  if (flow === '03-registration') {
    if (state === 'default') return visible('register-phone-input');
    if (state === 'login-mode') {
      await page.goto('/register?mode=login');
      return visible('register-switch-mode');
    }
    if (state === 'phone-focus') {
      await id('register-phone-input').focus();
      await expect(id('register-phone-input')).toBeFocused();
      return;
    }
    if (['phone-valid', 'sending', 'send-error', 'rate-limit'].includes(state)) {
      await fill('register-phone-input', '11999990000');
      if (state === 'phone-valid') {
        await expect(id('register-send-code')).toBeEnabled();
        return;
      }
      if (state === 'sending') await hold('startPhoneSignIn');
      else await fail('startPhoneSignIn', state === 'rate-limit' ? 'too_many_requests' : 'network');
      await click('register-send-code');
      return visible(state === 'sending' ? 'register-send-code' : 'register-error');
    }
    if (state.startsWith('provider-')) {
      if (state === 'provider-busy') await hold('signInWithGoogle');
      else await fail('signInWithGoogle', state === 'provider-cancel' ? 'cancelled' : 'network');
      await click('register-google');
      return visible(state === 'provider-error' ? 'register-error' : 'register-google');
    }
    if (state === 'success') {
      await click('register-google');
      return visible('discover-screen');
    }
    return unsupported();
  }
  if (flow === '04-verification') {
    if (state === 'invalid-route') {
      await page.goto('/verify-phone');
      return visible('register-phone-input');
    }
    if (state === 'default') return visible('verify-code-input');
    if (state === 'partial') {
      await fill('verify-code-input', '123');
      await expect(id('verify-submit')).toBeDisabled();
      return;
    }
    if (['submitting', 'wrong-code', 'expired', 'no-pending', 'success'].includes(state)) {
      if (state === 'submitting') await hold('confirmPhoneCode');
      if (state === 'expired' || state === 'no-pending')
        await fail('confirmPhoneCode', state === 'expired' ? 'code_expired' : 'no_pending_code');
      await fill('verify-code-input', state === 'wrong-code' ? '000000' : '123456');
      if (state === 'success') return visible('onboarding-name');
      return visible(state === 'submitting' ? 'verify-submit' : 'verify-error');
    }
    if (state.startsWith('resend')) {
      await page.clock.runFor(31000);
      await expect(id('verify-resend')).toBeEnabled();
      if (state === 'resend-ready') return;
      if (state === 'resend-error') await fail('startPhoneSignIn');
      await click('verify-resend');
      return visible(state === 'resend-error' ? 'verify-error' : 'verify-resend-countdown');
    }
    if (state === 'edit-number') {
      await click('verify-edit');
      return visible('register-phone-input');
    }
    return unsupported();
  }
  if (flow === '05-onboarding-basics') {
    if (state === 'default') {
      await fill('onboarding-name', '');
      await expect(id('onboarding-continue')).toBeDisabled();
      return;
    }
    if (['valid', 'age-boundaries', 'invalid-birthday', 'underage'].includes(state)) {
      await fill('onboarding-name', 'Ana');
      await fill(
        'onboarding-birthday',
        state === 'invalid-birthday'
          ? '31/02/1994'
          : state === 'underage'
            ? '01/01/2020'
            : state === 'age-boundaries'
              ? '13/11/2008'
              : '14/03/1994',
      );
      await click('vibe-bookworm');
      await click('looking-for-everyone');
      await expect(id('onboarding-continue'))[
        state === 'invalid-birthday' || state === 'underage' ? 'toBeDisabled' : 'toBeEnabled'
      ]();
      return;
    }
    if (['photo', 'photo-error', 'photo-removed'].includes(state)) {
      await click('onboarding-photo-pick');
      if (state === 'photo-removed') await click('onboarding-photo-remove');
      return visible(state === 'photo-error' ? 'onboarding-photo-error' : 'onboarding-photo');
    }
    if (state === 'union') {
      await click('union-toggle');
      await click('union-apeoesp');
      return visible('union-apeoesp');
    }
    if (state === 'back-retained') {
      await click('onboarding-continue');
      await click('onboarding-back');
      return visible('onboarding-name');
    }
    return unsupported();
  }
  if (flow === '06-onboarding-values') {
    if (state === 'back-retained') {
      for (const v of ['bookshops_coffee', 'tenant_rights', 'cycling']) await click(`value-${v}`);
      await click('onboarding-continue');
      await page.getByTestId('onboarding-starter').getByTestId('onboarding-back').click();
      await expect(id('value-cycling')).toBeChecked();
      return;
    }
    if (state === 'default') {
      await expect(id('onboarding-continue')).toBeDisabled();
      return;
    }
    if (state === 'minimum' || state === 'maximum') {
      for (const value of [
        'bookshops_coffee',
        'tenant_rights',
        'cycling',
        ...(state === 'maximum' ? ['climate_outdoors', 'pets_parks'] : []),
      ])
        await click(`value-${value}`);
      await expect(id('onboarding-continue')).toBeEnabled();
      if (state === 'maximum') await expect(id('value-food_markets')).toBeDisabled();
      return;
    }
    if (state === 'weight-low' || state === 'weight-high') {
      for (let i = 0; i < 10; i++) {
        const button = id(state === 'weight-low' ? 'weight-decrease' : 'weight-increase');
        if (await button.isEnabled()) await button.click();
      }
      return visible('onboarding-continue');
    }
    return unsupported();
  }
  if (flow === '07-onboarding-starter') {
    if (state === 'default') {
      await expect(id('starter-finish')).toBeDisabled();
      return;
    }
    if (state === 'prompt') {
      await click('prompt-green_flag');
      return visible('starter-answer');
    }
    await fill(
      'starter-answer',
      state === 'answer-limit' ? 'A'.repeat(280) : 'A community garden together.',
    );
    if (state === 'valid' || state === 'answer-limit') {
      await expect(id('starter-finish')).toBeEnabled();
      return;
    }
    if (state === 'saving') await hold('saveOnboarding');
    if (state === 'save-error') await fail('saveOnboarding');
    if (['saving', 'save-error', 'success'].includes(state)) {
      await click('starter-finish');
      return visible(
        state === 'success'
          ? 'discover-screen'
          : state === 'save-error'
            ? 'onboarding-error'
            : 'starter-finish',
      );
    }
    return unsupported();
  }
  if (flow === '08-discovery') {
    if (state === 'loading' || state === 'empty' || state === 'read-error')
      return visible(
        state === 'read-error'
          ? 'discover-retry'
          : state === 'empty'
            ? 'discover-refresh'
            : 'discover-screen',
      );
    if (state === 'refresh') {
      await control(page, 'addPeer');
      return visible('discover-card-name');
    }
    if (state === 'hidden-return' || state === 'account-change') {
      await hold('recordSwipe');
      await click('discover-pass');
      if (state === 'account-change') {
        await control(page, 'switchAccount');
        await control(page, 'release', 'recordSwipe');
      } else {
        await page.getByRole('tab', { name: 'Profile' }).click();
        await control(page, 'release', 'recordSwipe');
        await page.getByRole('tab', { name: 'Discover' }).click();
      }
      return visible('discover-card-name');
    }
    if (state === 'ready') return visible('discover-card-name');
    if (state === 'retry') {
      await click('discover-retry');
      return visible('discover-card-name');
    }
    if (['pass-pending', 'pass-success', 'like-success', 'write-error'].includes(state)) {
      if (state === 'pass-pending') await hold('recordSwipe');
      if (state === 'write-error') await fail('recordSwipe');
      await click(state === 'like-success' ? 'discover-like' : 'discover-pass');
      await visible('discover-card-name');
      return;
    }
    return unsupported();
  }
  if (flow === '09-discovery-filters') {
    await click('discover-filters-open');
    if (state === 'default') return visible('discover-filters-panel');
    if (state === 'localized-dark' || state === 'localized-dark-es') {
      await page.emulateMedia({ colorScheme: 'dark' });
      return visible('discover-filter-min-age');
    }
    if (state === 'account-reset') {
      await click('discover-filter-vibe-creative');
      await click('discover-filters-apply');
      await control(page, 'switchAccount');
      await expect(id('discover-card-name')).toContainText('Ana');
      await control(page, 'switchBack');
      await expect(id('discover-card-name')).toContainText('Maya');
      await click('discover-filters-open');
      await expect(id('discover-filter-vibe-any')).toHaveCSS(
        'background-color',
        'rgb(252, 232, 233)',
      );
      return;
    }
    if (state === 'invalid') {
      await fill('discover-filter-min-age', '50');
      await fill('discover-filter-max-age', '20');
      await click('discover-filters-apply');
      return visible('discover-filters-error');
    }
    await click('discover-filter-vibe-creative');
    if (state === 'selected') return visible('discover-filters-panel');
    if (state === 'filtered-empty') {
      await fill('discover-filter-min-age', '99');
      await fill('discover-filter-max-age', '99');
    }
    if (state === 'cancel') {
      await click('discover-filters-cancel');
      await click('discover-filters-open');
      return visible('discover-filter-vibe-any');
    }
    if (['filtered', 'filtered-empty', 'reset'].includes(state)) {
      await click('discover-filters-apply');
      if (state === 'reset') {
        await click('discover-filters-open');
        await click('discover-filters-reset');
      }
      return visible('discover-screen');
    }
    return unsupported();
  }
  if (flow === '10-match') {
    if (state === 'loading') return visible('match-screen');
    if (state === 'missing') return visible('match-not-found');
    if (state === 'error') return visible('match-error');
    if (state === 'chat') {
      await click('match-send-message');
      return visible('chat-screen');
    }
    if (state === 'keep-swiping') {
      await click('match-keep-swiping');
      return visible('discover-screen');
    }
    if (['ready', 'fallbacks', 'reduced-motion'].includes(state)) return visible('match-names');
    return unsupported();
  }
  if (flow === '11-matches') {
    if (state === 'loading') return visible('matches-screen');
    if (state === 'empty') return visible('matches-empty');
    if (state === 'error') return visible('matches-error');
    if (state === 'live-arrival' || state === 'hidden-arrival') {
      if (state === 'hidden-arrival') await page.getByRole('tab', { name: 'Profile' }).click();
      await control(page, 'match');
      if (state === 'hidden-arrival') await page.getByRole('tab', { name: 'Matches' }).click();
      return visible('match-row-maya_test-user');
    }
    if (state === 'ready') {
      await visible('match-row-lucas_test-user');
      return visible('match-row-maya_test-user');
    }
    if (state === 'open-chat') {
      await click('match-row-maya_test-user');
      return visible('chat-screen');
    }
    return unsupported();
  }
  if (flow === '12-chat') {
    if (state === 'loading') return visible('chat-screen');
    if (state === 'missing') return visible('chat-not-found');
    if (state === 'read-error') return visible('chat-load-error');
    if (state === 'closed') return visible('chat-closed');
    if (state === 'history') {
      await expect(
        page.getByText('Hello Maya, the garden sounds lovely.', { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText('Shall we visit the community garden?', { exact: true }),
      ).toBeVisible();
      return visible('chat-input');
    }
    if (state === 'empty') return visible('chat-input');
    if (state === 'hidden-return') {
      await control(page, 'pushCover');
      await visible('safety-screen');
      await control(page, 'incoming');
      await control(page, 'back');
      await expect(page.getByText('A new message from Maya.', { exact: true })).toBeVisible();
      return;
    }
    if (state === 'received') {
      await control(page, 'incoming');
      await expect(page.getByText('A new message from Maya.', { exact: true })).toBeVisible();
      return;
    }
    if (['composing', 'sending', 'sent', 'send-error', 'reload'].includes(state)) {
      await fill(
        'chat-input',
        state === 'composing'
          ? 'A community garden together.\nCoffee afterwards?'
          : 'A community garden together.',
      );
      if (state === 'composing') return visible('chat-input');
      if (state === 'sending') await hold('sendMessage');
      if (state === 'send-error') await fail('sendMessage');
      await click('chat-send');
      if (state === 'send-error') return visible('chat-error');
      if (state === 'sending') return visible('chat-send');
      await expect(page.getByText('A community garden together.', { exact: true })).toBeVisible();
      if (state === 'reload') {
        await control(page, 'persist');
        await page.reload();
        await expect(page.getByText('A community garden together.', { exact: true })).toBeVisible();
      }
      return;
    }
    return unsupported();
  }
  if (flow === '13-profile') {
    if (state === 'missing') {
      await control(page, 'release', 'getProfile');
      await visible('profile-card-name');
      await control(page, 'profileMissing');
      await expect(id('profile-card-name')).toHaveCount(0);
      return visible('profile-sign-out');
    }
    if (state === 'ready' || state === 'photo') return visible('profile-card-name');
    if (state === 'photo-uploading' || state === 'photo-error') {
      if (state === 'photo-uploading') await hold('setProfilePhoto');
      await click('profile-photo-change');
      return visible(state === 'photo-error' ? 'profile-photo-error' : 'profile-photo-saving');
    }
    if (state.startsWith('edit')) {
      await click('profile-edit');
      if (state === 'edit') return visible('profile-editor');
      if (state === 'edit-selected') {
        await click('profile-edit-vibe-creative');
        await click('profile-edit-looking-men');
        await click('profile-edit-union-app_workers');
        await click('profile-edit-prompt-green_flag');
        await click('profile-edit-value-climate_outdoors');
        return visible('profile-editor');
      }
      if (state === 'edit-invalid') await fill('profile-edit-name', '');
      else await fill('profile-edit-name', 'Rosa Atlas');
      if (state === 'edit-cancel') {
        await click('profile-edit-cancel');
        return visible('profile-card-name');
      }
      if (state === 'edit-saving') await hold('updateProfile');
      if (state === 'edit-error') await fail('updateProfile');
      if (state === 'edit-account-switch') await hold('updateProfile');
      await click('profile-edit-save');
      if (state === 'edit-account-switch') {
        await control(page, 'switchAccount');
        await expect(id('profile-card-name')).toContainText('Other');
        await control(page, 'release', 'updateProfile');
        await expect(id('profile-card-name')).toContainText('Other');
        return;
      }
      await visible(
        state === 'edit-invalid' || state === 'edit-error'
          ? 'profile-edit-error'
          : state === 'edit-saving'
            ? 'profile-edit-save'
            : 'profile-card-name',
      );
      if (state === 'edit-success') {
        await control(page, 'persist');
        await page.reload();
        await expect(id('profile-card-name')).toContainText('Rosa Atlas');
      }
      return;
    }
    if (state === 'signout-error' || state === 'signed-out') {
      if (state === 'signout-error') await fail('signOut');
      await click('profile-sign-out');
      return visible(state === 'signed-out' ? 'welcome-cta-start' : 'profile-sign-out');
    }
    if (state.startsWith('delete') || state === 'deleted') {
      await click('profile-delete-account');
      if (state === 'delete-confirm') return visible('profile-delete-panel');
      if (state === 'delete-cancel') {
        await click('profile-delete-cancel');
        return visible('profile-delete-account');
      }
      if (state === 'delete-error') await fail('deleteAccount');
      await click('profile-delete-confirm');
      return visible(
        state === 'deleted'
          ? 'welcome-cta-start'
          : state === 'delete-reauth'
            ? 'profile-delete-reauth'
            : 'profile-delete-error',
      );
    }
    if (state === 'photo-remove') {
      await control(page, 'setPhoto');
      await click('profile-photo-remove');
      return visible('profile-photo');
    }
    return unsupported();
  }
  if (flow === '14-safety') {
    if (state === 'profile-context') return visible('safety-screen');
    if (state === 'chat-context') {
      await control(page, 'back');
      await control(page, 'pushChat');
      await visible('chat-screen');
      await click('chat-safety');
      return visible('safety-screen');
    }
    if (state.startsWith('block') || state === 'blocked') {
      await click('safety-block');
      if (state === 'block-confirm') return visible('safety-block-confirm-panel');
      if (state === 'block-cancel') {
        await click('safety-block-cancel');
        return visible('safety-screen');
      }
      if (state === 'block-pending') await hold('blockUser');
      if (state === 'block-error') await fail('blockUser');
      await click('safety-block-confirm');
      return visible(
        state === 'blocked'
          ? 'discover-screen'
          : state === 'block-error'
            ? 'safety-error'
            : 'safety-block-confirm',
      );
    }
    await click('report-reason-spam');
    await fill('report-details', 'Synthetic atlas report; no real user.');
    if (state === 'report-draft') return visible('report-submit');
    if (state === 'report-pending') await hold('reportUser');
    if (state === 'report-error') await fail('reportUser');
    if (['report-pending', 'report-error', 'reported'].includes(state)) {
      await click('report-submit');
      return visible(
        state === 'reported'
          ? 'discover-screen'
          : state === 'report-error'
            ? 'safety-error'
            : 'report-submit',
      );
    }
    return unsupported();
  }
  if (flow === '15-notifications-web') {
    await expect(id('notifications-status')).toContainText(
      'Push notifications are available in the iOS and Android apps.',
    );
    return;
  }
  return unsupported();
}
