module.exports = {
  apps: [{
    name: 'unihaq',
    script: 'wa-blaster/backend/index.js',
    cwd: '/var/www/unihaq',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3002,
    },
    error_file: '/var/log/unihaq-error.log',
    out_file: '/var/log/unihaq-out.log',
  }],
};
