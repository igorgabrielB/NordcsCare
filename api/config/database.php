<?php
class Database {
    private static ?PDO $instance = null;

    private const HOST = 'localhost';
    private const DB_NAME = 'nordcscare';
    private const USERNAME = 'root';
    private const PASSWORD = '266072';

    public static function getInstance(): PDO {
        if (self::$instance === null) {
            $dsn = 'mysql:host=' . self::HOST . ';dbname=' . self::DB_NAME . ';charset=utf8mb4';
            self::$instance = new PDO($dsn, self::USERNAME, self::PASSWORD, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        }
        return self::$instance;
    }
}
