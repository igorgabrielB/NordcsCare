<?php
require_once __DIR__ . '/env.php';

$autoloadPath = __DIR__ . '/../vendor/autoload.php';
if (file_exists($autoloadPath)) {
    require_once $autoloadPath;
}

use Aws\S3\S3Client;

class S3Config {
    private static ?S3Client $instance = null;

    public static function getClient(): S3Client {
        if (self::$instance === null) {
            $config = [
                'region'  => Env::get('AWS_REGION', 'sa-east-1'),
                'version' => 'latest',
            ];

            // Se tiver credenciais explícitas, usa; senão, usa IAM Role da EC2
            $key = Env::get('AWS_ACCESS_KEY_ID', '');
            $secret = Env::get('AWS_SECRET_ACCESS_KEY', '');
            if ($key && $secret) {
                $config['credentials'] = [
                    'key'    => $key,
                    'secret' => $secret,
                ];
            }

            self::$instance = new S3Client($config);
        }
        return self::$instance;
    }

    public static function getBucket(): string {
        return Env::get('S3_BUCKET', 'nordcscare-bucket');
    }
}
