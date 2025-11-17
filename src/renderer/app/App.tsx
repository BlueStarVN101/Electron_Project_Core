import React from 'react';
import type { RuntimeVersions } from '../../shared/models/runtime';

const App = () => {
  const [versions, setVersions] = React.useState<RuntimeVersions | null>(null);

  React.useEffect(() => {
    const versionInfo = window.electronAPI?.getVersions();
    if (versionInfo) {
      setVersions(versionInfo);
    }
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <header>
        <h1>All-in-one Electron starter.</h1>
        <p>You're now running a typed React renderer with a secure preload bridge.</p>
      </header>

      <section>
        <h2>Runtime versions</h2>
        <ul>
          <li>Electron: {versions?.electron ?? 'loading...'}</li>
          <li>Chrome: {versions?.chrome ?? 'loading...'}</li>
          <li>Node.js: {versions?.node ?? 'loading...'}</li>
        </ul>
      </section>

      <section>
        <h2>Next steps</h2>
        <p>
          Start editing <code>src/renderer/app/App.tsx</code> or add new components under <code>src/renderer/</code>. The renderer rebuilds automatically while{' '}
          <code>npm run dev</code> is running.
        </p>
      </section>
    </main>
  );
};

export default App;

