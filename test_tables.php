<?php
require_once "/var/www/html/api/config/database.php";
$db = Database::getInstance();

// Add 'biomicroscopia' to exames.tipo_exame ENUM
$db->exec("ALTER TABLE exames MODIFY COLUMN tipo_exame ENUM('acuidade_visual','refracao','tonometria','spot_vision','eyer','retinografia','biomicroscopia','outro') NOT NULL");
echo "Added 'biomicroscopia' to exames.tipo_exame ENUM\n";

// Verify
$stmt = $db->query("SHOW COLUMNS FROM exames WHERE Field = 'tipo_exame'");
$row = $stmt->fetch(PDO::FETCH_ASSOC);
echo "exames.tipo_exame: " . $row['Type'] . "\n";
