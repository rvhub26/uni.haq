#!/bin/bash
# Setup nginx + firewall untuk uni.haq

# Copy nginx config
cp /var/www/unihaq/wa-blaster/deploy/nginx.conf /etc/nginx/sites-available/unihaq

# Enable site
ln -sf /etc/nginx/sites-available/unihaq /etc/nginx/sites-enabled/unihaq

# Disable default site
rm -f /etc/nginx/sites-enabled/default

# Test & restart nginx
nginx -t && systemctl restart nginx && systemctl enable nginx

# Allow ports
ufw allow 22
ufw allow 80
ufw allow 443
echo "y" | ufw enable

# Check PM2 status
pm2 status
pm2 save

echo ""
echo "======================================"
echo "  nginx & firewall siap!"
echo "  Cuba akses: http://139.59.247.69"
echo "======================================"
