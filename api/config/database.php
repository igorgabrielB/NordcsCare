<?php
require_once __DIR__ . '/env.php';
Env::load();

class Database {
    private static ?PDO $instance = null;

    public static function getInstance(): PDO {
        if (self::$instance === null) {
            $host = Env::get('DB_HOST', 'localhost');
            $dbName = Env::get('DB_NAME', 'nordcscare');
            $user = Env::get('DB_USER', 'root');
            $pass = Env::get('DB_PASSWORD', '');

            $dsn = "mysql:host={$host};dbname={$dbName};charset=utf8mb4";
            self::$instance = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        }
        return self::$instance;
    }
}
