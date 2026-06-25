#!/bin/bash
# Fix nginx untuk uni.haq

# Stop apache jika ada
systemctl stop apache2 2>/dev/null || true
systemctl disable apache2 2>/dev/null || true

# Tulis nginx config terus (elak CRLF issue)
cat > /etc/nginx/sites-available/unihaq << 'NGINXCONF'
server {
    listen 80;
    server_name _;
    client_max_body_size 50M;
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }
}
NGINXCONF

# Enable site
ln -sf /etc/nginx/sites-available/unihaq /etc/nginx/sites-enabled/unihaq
rm -f /etc/nginx/sites-enabled/default

# Tambah port 3001 dalam firewall supaya boleh test
ufw allow 3001

# Test config
nginx -t

# Start nginx
systemctl start nginx
systemctl enable nginx

echo ""
if systemctl is-active --quiet nginx; then
    echo "SUCCESS: nginx berjalan!"
    echo "Cuba akses: http://139.59.247.69"
else
    echo "nginx masih gagal. Cuba akses terus: http://139.59.247.69:3001"
fi

pm2 status
