#!/bin/bash
# uni.haq - Server Setup Script
# Jalankan sekali sahaja pada Droplet baru
# Usage: bash setup.sh

set -e

echo "======================================"
echo "  uni.haq Server Setup"
echo "======================================"

# Update system
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2 + nginx
npm install -g pm2
apt install -y nginx

# Install git
apt install -y git

# Buat folder app
mkdir -p /var/www/unihaq
cd /var/www/unihaq

# Clone repo
git clone https://github.com/rvhub26/uni.haq.git .

# Install dependencies
cd wa-blaster/backend
npm install --production

# Buat data folder & fail permulaan
mkdir -p data
for f in contacts templates schedules logs queue sent_history blacklist replies sales users; do
  [ -f "data/$f.json" ] || echo "[]" > "data/$f.json"
done
# replies & users guna object/array
echo "{}" > data/replies.json
echo "[]" > data/users.json

# Buat uploads & auth folder
mkdir -p uploads auth

# Setup PM2
cd /var/www/unihaq
pm2 start wa-blaster/deploy/ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

echo ""
echo "======================================"
echo "  Setup selesai!"
echo "  App berjalan pada http://localhost:3001"
echo "======================================"
