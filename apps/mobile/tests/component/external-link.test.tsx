import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { ExternalLink } from '@/components/external-link';

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(() => Promise.resolve()),
  WebBrowserPresentationStyle: { AUTOMATIC: 'automatic' },
}));

function renderLink() {
  return renderRouter(
    {
      index: () => (
        <ExternalLink href="https://comradia.example/privacy">Read the privacy policy</ExternalLink>
      ),
    },
    { initialUrl: '/' },
  );
}

describe('ExternalLink', () => {
  it('opens the link in the in-app browser instead of leaving the app', async () => {
    const router = renderLink();
    await router;

    await fireEvent.press(screen.getByText('Read the privacy policy'));

    expect(openBrowserAsync).toHaveBeenCalledWith('https://comradia.example/privacy', {
      presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
    });
  });
});
