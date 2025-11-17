import { app } from 'electron';
import { bootstrap, handleActivate, handleWindowAllClosed } from './app/main';

app.whenReady().then(bootstrap).catch((error) => {
  console.error('Failed to bootstrap the application:', error);
  app.quit();
});

app.on('activate', handleActivate);
app.on('window-all-closed', handleWindowAllClosed);

