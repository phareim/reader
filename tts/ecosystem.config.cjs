// PM2 definition for reader-tts (2026-09-22; before this it existed only in the PM2 dump).
// Secrets come from ~/.config/reader-tts/env, loaded by server.py.
// pm2 copies the environment of the shell that runs `pm2 start` into the app
// (filter_env does not stop it in pm2 6), and agent shells carry every API key.
// So clear it before pm2 reads it: the app gets only the env below and loads
// its secrets from its own env file (2026-09-29). Re-create with
//   pm2 delete reader-tts; pm2 start tts/ecosystem.config.cjs && pm2 save
// A plain `pm2 restart reader-tts` keeps the clean env. Never --update-env.
for (const k of Object.keys(process.env)) if (!k.startsWith('PM2_')) delete process.env[k];
const HOME = '/home/petter';
const PATH = `${HOME}/.local/bin:${HOME}/.npm-global/bin:/usr/local/bin:/usr/bin:/bin`;
process.env.PATH = PATH; // pm2 looks up interpreters on the CLI's PATH
const BASE = { HOME, USER: 'petter', LOGNAME: 'petter', SHELL: '/usr/bin/zsh', LANG: 'en_US.UTF-8', PATH };

module.exports = {
  apps: [
    { name: 'reader-tts', cwd: '/home/petter/github/reader/tts', script: '.venv/bin/python', args: 'server.py',
      interpreter: 'none', env: BASE },
  ],
};
