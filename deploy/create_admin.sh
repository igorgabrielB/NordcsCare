#!/bin/bash
HASH=$(php -r 'echo password_hash("Admin@2026", PASSWORD_BCRYPT);')
mysql -h nordcscare-db.czs8ckmi0nop.sa-east-1.rds.amazonaws.com -u admin -p44SAevvB538qxAlyysBY --connect-timeout=5 nordcscare -e "INSERT INTO usuarios (nome, email, login, senha, role, ativo) VALUES ('Administrador', 'admin@nordcscare.com', 'admin', '$HASH', 'admin', 1);"
echo "EXIT: $?"
mysql -h nordcscare-db.czs8ckmi0nop.sa-east-1.rds.amazonaws.com -u admin -p44SAevvB538qxAlyysBY --connect-timeout=5 nordcscare -e "SELECT id, nome, login, role, ativo FROM usuarios;"
