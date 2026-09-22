// PM2 definition for reader-tts (2026-09-22; before this it existed only in the PM2 dump).
// Secrets come from ~/.config/reader-tts/env, loaded by server.py.
//   pm2 start ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    { name: 'reader-tts', cwd: '/home/petter/github/reader/tts', script: '.venv/bin/python', args: 'server.py',
      interpreter: 'none' },
  ],
};
