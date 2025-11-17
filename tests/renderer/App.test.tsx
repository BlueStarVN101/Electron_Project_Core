import { render, screen } from '@testing-library/react';
import React from 'react';
import App from '../../src/renderer/app/App';
import type { ElectronAPI } from '../../src/types/global';

const electronWindow = window as Window & { electronAPI?: ElectronAPI };

describe('App component', () => {
  beforeAll(() => {
    electronWindow.electronAPI = {
      getVersions: () => ({
        electron: 'v1',
        chrome: 'v2',
        node: 'v3'
      })
    };
  });

  it('renders heading and version list', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /runtime versions/i })).toBeInTheDocument();
    expect(screen.getByText(/Electron: v1/)).toBeInTheDocument();
    expect(screen.getByText(/Chrome: v2/)).toBeInTheDocument();
    expect(screen.getByText(/Node.js: v3/)).toBeInTheDocument();
  });
});

