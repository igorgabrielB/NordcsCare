#!/bin/bash
# Instalar Certbot (Let's Encrypt) para HTTPS
sudo dnf install -y certbot python3-certbot-apache 2>&1

# Obter e instalar certificado SSL
sudo certbot --apache -d nordcscare.com.br -d www.nordcscare.com.br --non-interactive --agree-tos --email admin@nordcscare.com.br --redirect 2>&1

# Verificar status
echo "--- Status do certificado ---"
sudo certbot certificates 2>&1

# Configurar renovação automática
echo "--- Configurar renovação automática ---"
sudo systemctl enable certbot-renew.timer 2>&1
sudo systemctl start certbot-renew.timer 2>&1
echo "Renovação automática configurada!"
