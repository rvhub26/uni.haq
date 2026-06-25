#!/bin/bash
# uni.haq - Update Script
# Guna bila nak update kod dari GitHub
# Usage: bash /var/www/unihaq/wa-blaster/deploy/update.sh

set -e
cd /var/www/unihaq

echo "Pulling latest code..."
git pull origin main

echo "Installing dependencies..."
cd wa-blaster/backend
npm install --production

echo "Restarting app..."
cd /var/www/unihaq
pm2 restart unihaq

echo "Done! App updated."
pm2 status
