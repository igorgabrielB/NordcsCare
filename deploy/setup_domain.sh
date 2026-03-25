#!/bin/bash
# Criar VirtualHost para nordcscare.com.br
sudo tee /etc/httpd/conf.d/nordcscare.conf > /dev/null << 'EOF'
<VirtualHost *:80>
    ServerName nordcscare.com.br
    ServerAlias www.nordcscare.com.br
    DocumentRoot /var/www/html

    <Directory /var/www/html>
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog /var/log/httpd/nordcscare-error.log
    CustomLog /var/log/httpd/nordcscare-access.log combined
</VirtualHost>
EOF

sudo systemctl restart httpd
echo "Apache configurado com sucesso!"
