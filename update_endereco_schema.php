<?php
try {
    $db = new PDO('mysql:host=localhost;dbname=nordcscare;charset=utf8mb4', 'root', '266072');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Verifica se as colunas já existem
    $checkSql = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'pacientes' AND TABLE_SCHEMA = 'nordcscare' AND COLUMN_NAME = 'cep'";
    $result = $db->query($checkSql)->fetch();
    
    if (!$result) {
        // Adiciona as novas colunas
        $sql = "ALTER TABLE pacientes 
                ADD COLUMN cep VARCHAR(10) AFTER email,
                ADD COLUMN rua VARCHAR(150) AFTER cep,
                ADD COLUMN numero VARCHAR(20) AFTER rua,
                ADD COLUMN complemento VARCHAR(100) AFTER numero,
                ADD COLUMN bairro VARCHAR(100) AFTER complemento,
                ADD COLUMN cidade VARCHAR(100) AFTER bairro,
                ADD COLUMN estado VARCHAR(2) AFTER cidade";
        
        $db->exec($sql);
        echo "✓ Colunas de endereço adicionadas com sucesso!\n";
    } else {
        echo "✓ Colunas de endereço já existem!\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
?>
