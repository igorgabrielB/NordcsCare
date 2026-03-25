#!/bin/bash
HASH=$(php -r 'echo password_hash("Admin@2026", PASSWORD_BCRYPT);')
mysql -h nordcscare-db.czs8ckmi0nop.sa-east-1.rds.amazonaws.com -u admin -p44SAevvB538qxAlyysBY --connect-timeout=5 nordcscare -e "UPDATE usuarios SET senha='$HASH' WHERE login='admin';"
echo "UPDATE EXIT: $?"
