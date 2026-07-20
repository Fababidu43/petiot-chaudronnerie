<?php
declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

const GALLERY_PASSWORD = 'FABIAN';
const DATA_FILE = __DIR__ . '/../assets/data/realisations.json';
const UPLOAD_DIR = __DIR__ . '/../assets/uploads/realisations';
const PUBLIC_UPLOAD_BASE = 'assets/uploads/realisations';

function send_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function ensure_storage(): void
{
    $dataDir = dirname(DATA_FILE);

    if (!is_dir($dataDir)) {
        mkdir($dataDir, 0775, true);
    }

    if (!is_dir(UPLOAD_DIR)) {
        mkdir(UPLOAD_DIR, 0775, true);
    }

    if (!file_exists(DATA_FILE)) {
        file_put_contents(DATA_FILE, "[]", LOCK_EX);
    }
}

function default_photos(): array
{
    return [
        [
            'id' => 'default-1',
            'image' => 'assets/img/reparation-benne-camion-beauzac.png',
            'type' => 'image',
            'isDefault' => true,
            'timestamp' => 1
        ],
        [
            'id' => 'default-2',
            'image' => 'assets/img/reparation-broyeur-carriere-beauzac.png',
            'type' => 'image',
            'isDefault' => true,
            'timestamp' => 2
        ],
        [
            'id' => 'default-3',
            'image' => 'assets/img/creation-godets-camion-beauzac.png',
            'type' => 'image',
            'isDefault' => true,
            'timestamp' => 3
        ]
    ];
}

function read_uploaded_photos(): array
{
    ensure_storage();

    $raw = file_get_contents(DATA_FILE);
    $items = json_decode($raw ?: '[]', true);

    if (!is_array($items)) {
        return [];
    }

    return array_values(array_filter($items, static function ($item) {
        return is_array($item) && !empty($item['id']) && !empty($item['image']) && !empty($item['type']);
    }));
}

function write_uploaded_photos(array $items): void
{
    ensure_storage();
    file_put_contents(
        DATA_FILE,
        json_encode(array_values($items), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        LOCK_EX
    );
}

function is_authenticated(): bool
{
    return !empty($_SESSION['gallery_admin']);
}

function require_auth(): void
{
    if (!is_authenticated()) {
        send_json(['success' => false, 'message' => 'Authentification requise'], 403);
    }
}

function sanitize_filename(string $filename): string
{
    $filename = pathinfo($filename, PATHINFO_FILENAME);
    $filename = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $filename) ?: 'media';
    $filename = strtolower($filename);
    $filename = preg_replace('/[^a-z0-9]+/', '-', $filename) ?: 'media';
    return trim($filename, '-') ?: 'media';
}

function extension_from_mime(string $mime): string
{
    $map = [
        'image/jpeg' => 'jpg',
        'image/jpg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
        'video/mp4' => 'mp4',
        'video/webm' => 'webm',
        'video/ogg' => 'ogv',
        'video/quicktime' => 'mov'
    ];

    return $map[$mime] ?? '';
}

function detect_media_type(string $mime): ?string
{
    if (strpos($mime, 'image/') === 0) {
        return 'image';
    }

    if (strpos($mime, 'video/') === 0) {
        return 'video';
    }

    return null;
}

function build_public_url(string $filename): string
{
    return PUBLIC_UPLOAD_BASE . '/' . $filename;
}

$action = $_GET['action'] ?? $_POST['action'] ?? 'list';

if ($action === 'status') {
    send_json([
        'success' => true,
        'authenticated' => is_authenticated()
    ]);
}

if ($action === 'login') {
    $password = trim((string)($_POST['password'] ?? ''));

    if ($password !== GALLERY_PASSWORD) {
        send_json(['success' => false, 'message' => 'Mot de passe incorrect'], 401);
    }

    session_regenerate_id(true);
    $_SESSION['gallery_admin'] = true;

    send_json([
        'success' => true,
        'authenticated' => true
    ]);
}

if ($action === 'logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();

    send_json([
        'success' => true,
        'authenticated' => false
    ]);
}

if ($action === 'list') {
    $items = array_merge(default_photos(), read_uploaded_photos());

    usort($items, static function (array $a, array $b): int {
        return (int)($a['timestamp'] ?? 0) <=> (int)($b['timestamp'] ?? 0);
    });

    send_json([
        'success' => true,
        'items' => $items
    ]);
}

if ($action === 'upload') {
    require_auth();
    ensure_storage();

    if (empty($_FILES['media']) || !isset($_FILES['media']['tmp_name'])) {
        send_json(['success' => false, 'message' => 'Aucun fichier reçu'], 400);
    }

    $file = $_FILES['media'];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        send_json(['success' => false, 'message' => 'Erreur lors du téléversement'], 400);
    }

    $maxSize = 50 * 1024 * 1024;
    if ((int)$file['size'] > $maxSize) {
        send_json(['success' => false, 'message' => 'Fichier trop volumineux'], 400);
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']) ?: '';
    $mediaType = detect_media_type($mime);

    if ($mediaType === null) {
        send_json(['success' => false, 'message' => 'Type de fichier non supporté'], 400);
    }

    $extension = extension_from_mime($mime);
    if ($extension === '') {
        send_json(['success' => false, 'message' => 'Extension non supportée'], 400);
    }

    $baseName = sanitize_filename((string)($_POST['filename'] ?? $file['name']));
    $uniqueId = 'media-' . bin2hex(random_bytes(8)) . '-' . time();
    $targetName = $baseName . '-' . $uniqueId . '.' . $extension;
    $targetPath = UPLOAD_DIR . '/' . $targetName;

    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        send_json(['success' => false, 'message' => 'Impossible d\'enregistrer le fichier'], 500);
    }

    $stored = read_uploaded_photos();
    $stored[] = [
        'id' => $uniqueId,
        'image' => build_public_url($targetName),
        'type' => $mediaType,
        'isDefault' => false,
        'timestamp' => time(),
        'filename' => (string)($_POST['filename'] ?? $file['name'])
    ];

    write_uploaded_photos($stored);

    $lastIndex = count($stored) - 1;
    send_json([
        'success' => true,
        'item' => $stored[$lastIndex]
    ]);
}

if ($action === 'delete') {
    require_auth();

    $id = trim((string)($_POST['id'] ?? ''));
    if ($id === '') {
        send_json(['success' => false, 'message' => 'ID manquant'], 400);
    }

    $stored = read_uploaded_photos();
    $remaining = [];
    $deleted = null;

    foreach ($stored as $item) {
        if (($item['id'] ?? '') === $id) {
            $deleted = $item;
            continue;
        }
        $remaining[] = $item;
    }

    if ($deleted === null) {
        send_json(['success' => false, 'message' => 'Média introuvable'], 404);
    }

    $imagePath = (string)($deleted['image'] ?? '');
    $filesystemPath = __DIR__ . '/../' . ltrim($imagePath, '/');
    if (is_file($filesystemPath)) {
        @unlink($filesystemPath);
    }

    write_uploaded_photos($remaining);

    send_json([
        'success' => true
    ]);
}

send_json(['success' => false, 'message' => 'Action inconnue'], 400);
