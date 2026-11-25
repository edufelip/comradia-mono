import { onIdTokenChanged } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createAdminClient, type AdminClient } from './firebase';
import { OpsConsole } from './ops';
import './style.css';

function AdminApp({ client }: { client: AdminClient }) {
  const [session, setSession] = useState<'loading' | 'signed-out' | 'forbidden' | 'admin'>('loading');
  const [uid, setUid] = useState('');
  const [error, setError] = useState('');
  const revision = useRef(0);
  useEffect(() => onIdTokenChanged(client.auth, (user) => {
    const token = ++revision.current;
    setSession(user ? 'loading' : 'signed-out');
    setUid('');
    if (!user) return;
    void user.getIdTokenResult().then(({ claims }) => {
      if (token !== revision.current) return;
      setUid(user.uid);
      setSession(claims.gamAdmin === true ? 'admin' : 'forbidden');
    }, () => {
      if (token === revision.current) setSession('forbidden');
    });
  }), [client]);

  const showError = (error: unknown) => setError(error instanceof Error ? error.message : 'Action failed.');
  return (
    <main>
      <header>
        <h1>Cravos Admin</h1>
        {session !== 'loading' && session !== 'signed-out' &&
          <button onClick={() => { void client.signOut().catch(showError); }}>Sign out</button>}
      </header>
      {error && <p role="alert">{error}</p>}
      {session === 'loading' && <p role="status">Checking access…</p>}
      {session === 'signed-out' && <button onClick={() => { void client.signIn().catch(showError); }}>Sign in with Google</button>}
      {session === 'forbidden' && <p role="alert">This account has no Cravos admin access.</p>}
      {session === 'admin' && <OpsConsole key={uid} client={client} />}
    </main>
  );
}

const node = document.getElementById('root');
if (node === null) throw new Error('Missing application root');
const root = createRoot(node);
try {
  root.render(<AdminApp client={createAdminClient()} />);
} catch (error) {
  root.render(<main><h1>Cravos Admin</h1><p role="alert">
    {error instanceof Error ? error.message : 'Firebase initialization failed.'}
  </p></main>);
}
