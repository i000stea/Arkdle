<?php
/**
 * SQLite 出题包测试 API
 * 数据库：storage/data.db
 */

date_default_timezone_set('Asia/Shanghai');

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

define('SQLITE_STORAGE_DIR', __DIR__ . DIRECTORY_SEPARATOR . 'storage');
define('SQLITE_DB_PATH', SQLITE_STORAGE_DIR . DIRECTORY_SEPARATOR . 'set_question.db');
define('SQLITE_LEGACY_DB_PATH', __DIR__ . DIRECTORY_SEPARATOR . 'set_question.db');
define('SQLITE_SHARE_KEY_MIN_LEN', 4);
define('SQLITE_SHARE_KEY_MAX_LEN', 128);

function sqlite_test_validate_custom_share_key($key) {
    $key = trim((string) $key);
    if ($key === '') {
        return null;
    }
    $len = function_exists('mb_strlen') ? mb_strlen($key, 'UTF-8') : strlen($key);
    if ($len < SQLITE_SHARE_KEY_MIN_LEN) {
        return '分享 Key 自定义时至少需要 ' . SQLITE_SHARE_KEY_MIN_LEN . ' 个字符';
    }
    if ($len > SQLITE_SHARE_KEY_MAX_LEN) {
        return '分享 Key 长度不能超过 ' . SQLITE_SHARE_KEY_MAX_LEN . ' 个字符';
    }
    return null;
}

function sqlite_test_json($payload, $statusCode = 200) {
    http_response_code($statusCode);
    if (function_exists('ob_get_level') && ob_get_level() > 0) {
        @ob_clean();
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit();
}

function sqlite_test_chmod_writable($path, $isDir) {
    if (!file_exists($path)) {
        return;
    }
    if (DIRECTORY_SEPARATOR === '\\') {
        @chmod($path, $isDir ? 0777 : 0666);
        return;
    }
    @chmod($path, $isDir ? 0775 : 0664);
}

function sqlite_test_dir_writable($dir) {
    if (!is_dir($dir)) {
        return false;
    }
    if (is_writable($dir)) {
        return true;
    }
    sqlite_test_chmod_writable($dir, true);
    return is_writable($dir);
}

function sqlite_test_migrate_legacy_db() {
    if (!is_file(SQLITE_LEGACY_DB_PATH) || is_file(SQLITE_DB_PATH)) {
        return;
    }
    if (!sqlite_test_dir_writable(SQLITE_STORAGE_DIR)) {
        return;
    }
    @rename(SQLITE_LEGACY_DB_PATH, SQLITE_DB_PATH);
    foreach (glob(SQLITE_LEGACY_DB_PATH . '-*') ?: array() as $sidecar) {
        $base = basename($sidecar);
        @rename($sidecar, SQLITE_STORAGE_DIR . DIRECTORY_SEPARATOR . $base);
    }
}

function sqlite_test_ensure_storage() {
    if (!is_dir(SQLITE_STORAGE_DIR)) {
        if (!@mkdir(SQLITE_STORAGE_DIR, 0775, true) && !is_dir(SQLITE_STORAGE_DIR)) {
            sqlite_test_json(array(
                'status' => 'error',
                'message' => '无法创建 storage 目录: ' . SQLITE_STORAGE_DIR,
                'hint' => '请在宝塔文件管理中为 SQLiteTest 目录赋予 www 用户写权限，或手动创建 storage 并 chmod 775。',
            ), 500);
        }
        sqlite_test_chmod_writable(SQLITE_STORAGE_DIR, true);
    }

    sqlite_test_migrate_legacy_db();

    if (!sqlite_test_dir_writable(SQLITE_STORAGE_DIR)) {
        sqlite_test_json(array(
            'status' => 'error',
            'message' => 'storage 目录不可写: ' . SQLITE_STORAGE_DIR,
            'hint' => 'SQLite 需要在数据库所在目录创建临时文件。请为 SQLiteTest/storage 赋予 Web 用户写权限（chmod 775）。',
        ), 500);
    }

    if (is_file(SQLITE_DB_PATH) && !is_writable(SQLITE_DB_PATH)) {
        sqlite_test_chmod_writable(SQLITE_DB_PATH, false);
    }
}

function sqlite_test_writable_hint() {
    return '请为 SQLiteTest/storage 及其中 data.db 赋予 Web 服务用户写权限（宝塔：目录权限 775，所有者 www）。';
}

function sqlite_test_probe_write(PDO $pdo) {
    try {
        $pdo->exec('BEGIN IMMEDIATE');
        $pdo->exec('ROLLBACK');
    } catch (PDOException $e) {
        if (stripos($e->getMessage(), 'readonly') !== false) {
            sqlite_test_json(array(
                'status' => 'error',
                'message' => '数据库为只读，无法写入',
                'hint' => sqlite_test_writable_hint(),
                'path' => SQLITE_DB_PATH,
            ), 500);
        }
        throw $e;
    }
}

function sqlite_test_client_ip() {
    $candidates = array();
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        foreach (explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']) as $part) {
            $ip = trim($part);
            if ($ip !== '') {
                $candidates[] = $ip;
            }
        }
    }
    if (!empty($_SERVER['HTTP_X_REAL_IP'])) {
        $candidates[] = trim($_SERVER['HTTP_X_REAL_IP']);
    }
    if (!empty($_SERVER['REMOTE_ADDR'])) {
        $candidates[] = trim($_SERVER['REMOTE_ADDR']);
    }
    foreach ($candidates as $ip) {
        if (filter_var($ip, FILTER_VALIDATE_IP)) {
            return $ip;
        }
    }
    return isset($candidates[0]) ? $candidates[0] : '';
}

function sqlite_test_migrate_columns(PDO $pdo) {
    $cols = $pdo->query('PRAGMA table_info(quiz_store)')->fetchAll(PDO::FETCH_ASSOC);
    $names = array();
    foreach ($cols as $col) {
        $names[] = $col['name'];
    }
    if (!in_array('client_ip', $names, true)) {
        $pdo->exec('ALTER TABLE quiz_store ADD COLUMN client_ip TEXT NOT NULL DEFAULT \'\'');
    }
}

function sqlite_test_init_schema(PDO $pdo) {
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS quiz_store (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            share_key TEXT NOT NULL UNIQUE,
            md5_hash TEXT NOT NULL UNIQUE,
            author_nickname TEXT NOT NULL DEFAULT \'\',
            author_message TEXT NOT NULL DEFAULT \'\',
            payload_json TEXT NOT NULL,
            client_ip TEXT NOT NULL DEFAULT \'\',
            created_at TEXT NOT NULL DEFAULT (datetime(\'now\', \'localtime\'))
        )'
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_quiz_store_md5 ON quiz_store (md5_hash)');
    sqlite_test_migrate_columns($pdo);

    // 兼容旧版纯文本表
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS text_store (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL UNIQUE,
            md5_hash TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT (datetime(\'now\', \'localtime\'))
        )'
    );
}

function sqlite_test_pdo() {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    sqlite_test_ensure_storage();

    try {
        $pdo = new PDO('sqlite:' . SQLITE_DB_PATH);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->exec('PRAGMA foreign_keys = ON');
        sqlite_test_init_schema($pdo);
        sqlite_test_probe_write($pdo);
    } catch (PDOException $e) {
        $msg = $e->getMessage();
        $hint = null;
        if (stripos($msg, 'readonly') !== false || stripos($msg, 'unable to open') !== false) {
            $hint = sqlite_test_writable_hint();
        }
        sqlite_test_json(array(
            'status' => 'error',
            'message' => '数据库连接失败: ' . $msg,
            'hint' => $hint,
            'path' => SQLITE_DB_PATH,
        ), 500);
    }
    return $pdo;
}

function sqlite_test_read_body() {
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return array();
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : array();
}

function sqlite_test_pick($arr, $keys, $default = '') {
    foreach ($keys as $k) {
        if (isset($arr[$k]) && $arr[$k] !== '' && $arr[$k] !== null) {
            return $arr[$k];
        }
    }
    return $default;
}

function sqlite_test_normalize_hints($raw) {
    if (is_array($raw)) {
        $out = array();
        foreach ($raw as $h) {
            $t = trim((string) $h);
            if ($t !== '') {
                $out[] = $t;
            }
        }
        return $out;
    }
    $str = trim((string) $raw);
    if ($str === '') {
        return array();
    }
    if (strpos($str, "\n") !== false) {
        $lines = preg_split('/\r\n|\r|\n/', $str);
        $out = array();
        foreach ($lines as $line) {
            $t = trim($line);
            if ($t !== '') {
                $out[] = $t;
            }
        }
        return $out;
    }
    return array($str);
}

function sqlite_test_normalize_question($q, $index) {
    if (!is_array($q)) {
        sqlite_test_json(array(
            'status' => 'error',
            'message' => '题目 #' . ($index + 1) . ' 格式无效',
        ), 400);
    }

    $target = trim((string) sqlite_test_pick($q, array('targetText', '目标文本', 'target')));
    if ($target === '') {
        sqlite_test_json(array(
            'status' => 'error',
            'message' => '题目 #' . ($index + 1) . ' 缺少目标文本',
        ), 400);
    }

    $maxGuesses = sqlite_test_pick($q, array('maxGuesses', '可猜测次数', 'guessLimit'), 6);
    if (is_string($maxGuesses) && is_numeric($maxGuesses)) {
        $maxGuesses = (int) $maxGuesses;
    } elseif (!is_int($maxGuesses) && !is_float($maxGuesses)) {
        $maxGuesses = 6;
    } else {
        $maxGuesses = (int) $maxGuesses;
    }
    if ($maxGuesses < 2) {
        $maxGuesses = 2;
    }
    if ($maxGuesses > 12) {
        $maxGuesses = 12;
    }

    $hintMax = $maxGuesses - 1;
    $hintReveal = sqlite_test_pick($q, array(
        'hintRevealAfterAttempt',
        'hintRevealCount',
        '提示出现时间',
        '提示出现次数',
        'hintCount',
    ), 1);
    if (is_string($hintReveal) && is_numeric($hintReveal)) {
        $hintReveal = (int) $hintReveal;
    } else {
        $hintReveal = (int) $hintReveal;
    }
    if ($hintReveal < 1 || $hintReveal > $hintMax) {
        sqlite_test_json(array(
            'status' => 'error',
            'message' => '题目 #' . ($index + 1) . ' 提示出现时间须在 1～' . $hintMax . ' 之间（第几次尝试之后，须小于可猜测次数）',
        ), 400);
    }

    $allowRabbit = sqlite_test_pick($q, array('allowRabbitHead', '是否允许兔头', 'allowRabbit'), false);
    if (is_bool($allowRabbit)) {
        $allowRabbitHead = $allowRabbit;
    } elseif ($allowRabbit === 1 || $allowRabbit === '1' || $allowRabbit === 'true' || $allowRabbit === 'yes' || $allowRabbit === '是') {
        $allowRabbitHead = true;
    } elseif ($allowRabbit === 0 || $allowRabbit === '0' || $allowRabbit === 'false' || $allowRabbit === 'no' || $allowRabbit === '否') {
        $allowRabbitHead = false;
    } else {
        $allowRabbitHead = (bool) $allowRabbit;
    }

    $hints = sqlite_test_normalize_hints(sqlite_test_pick($q, array('hints', '提示', 'hint'), array()));

    return array(
        'targetText' => $target,
        'maxGuesses' => $maxGuesses,
        'hints' => $hints,
        'hintRevealAfterAttempt' => $hintReveal,
        'allowRabbitHead' => $allowRabbitHead,
    );
}

function sqlite_test_normalize_pack($body) {
    $nickname = trim((string) sqlite_test_pick($body, array('authorNickname', '出题人昵称', 'nickname')));
    $message = trim((string) sqlite_test_pick($body, array('authorMessage', '出题人寄语', 'message')));
    $shareKey = trim((string) sqlite_test_pick($body, array('shareKey', '分享Key', 'share_key')));

    $questionsRaw = isset($body['questions']) ? $body['questions'] : (isset($body['题目数组']) ? $body['题目数组'] : null);
    if (!is_array($questionsRaw) || count($questionsRaw) === 0) {
        sqlite_test_json(array(
            'status' => 'error',
            'message' => '题目数组不能为空，至少包含一题',
        ), 400);
    }

    $questions = array();
    foreach ($questionsRaw as $i => $q) {
        $questions[] = sqlite_test_normalize_question($q, $i);
    }

    $pack = array(
        'authorNickname' => $nickname,
        'authorMessage' => $message,
        'questions' => $questions,
    );

    $jsonForHash = json_encode($pack, JSON_UNESCAPED_UNICODE);
    $md5 = md5($jsonForHash);

    if ($shareKey === '') {
        $shareKey = $md5;
    } else {
        $keyErr = sqlite_test_validate_custom_share_key($shareKey);
        if ($keyErr !== null) {
            sqlite_test_json(array(
                'status' => 'error',
                'message' => $keyErr,
            ), 400);
        }
    }

    $pack['shareKey'] = $shareKey;

    return array(
        'pack' => $pack,
        'md5' => $md5,
        'shareKey' => $shareKey,
        'payloadJson' => json_encode($pack, JSON_UNESCAPED_UNICODE),
    );
}

function sqlite_test_row_to_data($row, $includeHidden = false) {
    $pack = json_decode($row['payload_json'], true);
    if (!is_array($pack)) {
        $pack = array();
    }
    $data = array(
        'id' => (int) $row['id'],
        'shareKey' => $row['share_key'],
        'md5' => $row['md5_hash'],
        'authorNickname' => $row['author_nickname'],
        'authorMessage' => $row['author_message'],
        'questions' => isset($pack['questions']) ? $pack['questions'] : array(),
        'pack' => $pack,
        'created_at' => $row['created_at'],
    );
    if ($includeHidden && array_key_exists('client_ip', $row)) {
        $data['clientIp'] = $row['client_ip'];
    }
    return $data;
}

function sqlite_test_public_data($data) {
    unset($data['clientIp']);
    return $data;
}

function sqlite_test_find_by_key(PDO $pdo, $key) {
    $key = trim((string) $key);
    if ($key === '') {
        return null;
    }
    $stmt = $pdo->prepare(
        'SELECT id, share_key, md5_hash, author_nickname, author_message, payload_json, client_ip, created_at
         FROM quiz_store WHERE share_key = :k OR md5_hash = :k LIMIT 1'
    );
    $stmt->execute(array('k' => $key));
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ? sqlite_test_row_to_data($row, false) : null;
}

function sqlite_test_create_pack($body) {
    $norm = sqlite_test_normalize_pack($body);
    $pdo = sqlite_test_pdo();

    $existing = sqlite_test_find_by_key($pdo, $norm['shareKey']);
    if (!$existing) {
        $existing = sqlite_test_find_by_key($pdo, $norm['md5']);
    }

    if ($existing) {
        // 库中已存在相同内容，等待2-5秒后返回
        $delay = rand(2000, 5000);
        usleep($delay * 1000);
        sqlite_test_json(array(
            'status' => 'success',
            'action' => 'create',
            'data' => sqlite_test_public_data(array_merge($existing, array('existed' => true))),
        ));
    }

    $clientIp = sqlite_test_client_ip();

    try {
        $insert = $pdo->prepare(
            'INSERT INTO quiz_store (share_key, md5_hash, author_nickname, author_message, payload_json, client_ip)
             VALUES (:share_key, :md5, :nickname, :message, :payload, :client_ip)'
        );
        $insert->execute(array(
            'share_key' => $norm['shareKey'],
            'md5' => $norm['md5'],
            'nickname' => $norm['pack']['authorNickname'],
            'message' => $norm['pack']['authorMessage'],
            'payload' => $norm['payloadJson'],
            'client_ip' => $clientIp,
        ));
    } catch (PDOException $e) {
        if (stripos($e->getMessage(), 'UNIQUE') !== false) {
            $dup = sqlite_test_find_by_key($pdo, $norm['shareKey']);
            if ($dup) {
                // 库中已存在相同内容，等待2-5秒后返回
                $delay = rand(2000, 5000);
                usleep($delay * 1000);
                sqlite_test_json(array(
                    'status' => 'success',
                    'action' => 'create',
                    'data' => sqlite_test_public_data(array_merge($dup, array('existed' => true))),
                ));
            }
        }
        $hint = stripos($e->getMessage(), 'readonly') !== false ? sqlite_test_writable_hint() : null;
        sqlite_test_json(array(
            'status' => 'error',
            'message' => '写入失败: ' . $e->getMessage(),
            'hint' => $hint,
        ), 500);
    }

    // 等待2-5秒后返回新创建的内容
    $delay = rand(2000, 5000);
    usleep($delay * 1000);

    $id = (int) $pdo->lastInsertId();
    sqlite_test_json(array(
        'status' => 'success',
        'action' => 'create',
        'data' => array(
            'id' => $id,
            'shareKey' => $norm['shareKey'],
            'md5' => $norm['md5'],
            'authorNickname' => $norm['pack']['authorNickname'],
            'authorMessage' => $norm['pack']['authorMessage'],
            'questions' => $norm['pack']['questions'],
            'pack' => $norm['pack'],
            'existed' => false,
        ),
    ));
}

function sqlite_test_lookup($key) {
    $key = trim((string) $key);
    if ($key === '') {
        sqlite_test_json(array(
            'status' => 'error',
            'message' => '请输入分享 Key 或 MD5',
        ), 400);
    }

    $pdo = sqlite_test_pdo();
    $found = sqlite_test_find_by_key($pdo, $key);

    if ($found) {
        sqlite_test_json(array(
            'status' => 'success',
            'action' => 'lookup',
            'data' => $found,
        ));
    }

    // 兼容旧版 text_store
    if (preg_match('/^[a-f0-9]{32}$/i', $key)) {
        $stmt = $pdo->prepare('SELECT content, md5_hash, created_at FROM text_store WHERE md5_hash = :k LIMIT 1');
        $stmt->execute(array('k' => strtolower($key)));
        $legacy = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($legacy) {
            sqlite_test_json(array(
                'status' => 'success',
                'action' => 'lookup',
                'data' => array(
                    'legacy' => true,
                    'shareKey' => $legacy['md5_hash'],
                    'md5' => $legacy['md5_hash'],
                    'text' => $legacy['content'],
                    'created_at' => $legacy['created_at'],
                ),
            ));
        }
    }

    sqlite_test_json(array(
        'status' => 'error',
        'message' => '未找到该 Key 对应的出题包',
    ), 404);
}

function sqlite_test_check_key($key) {
    $key = trim((string) $key);

    if ($key === '') {
        sqlite_test_json(array(
            'status' => 'success',
            'action' => 'checkKey',
            'data' => array(
                'key' => '',
                'available' => true,
                'message' => '未填写时将根据题目内容自动生成 MD5 作为分享 Key，可直接保存',
            ),
        ));
    }

    $keyErr = sqlite_test_validate_custom_share_key($key);
    if ($keyErr !== null) {
        sqlite_test_json(array(
            'status' => 'error',
            'message' => $keyErr,
        ), 400);
    }

    $pdo = sqlite_test_pdo();

    $stmt = $pdo->prepare(
        'SELECT id, share_key, author_nickname FROM quiz_store
         WHERE share_key = :k OR md5_hash = :k LIMIT 1'
    );
    $stmt->execute(array('k' => $key));
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row) {
        sqlite_test_json(array(
            'status' => 'success',
            'action' => 'checkKey',
            'data' => array(
                'key' => $key,
                'available' => false,
                'message' => '该 Key 已被占用',
                'occupiedBy' => array(
                    'id' => (int) $row['id'],
                    'shareKey' => $row['share_key'],
                    'authorNickname' => $row['author_nickname'],
                ),
            ),
        ));
    }

    $legacyStmt = $pdo->prepare('SELECT id FROM text_store WHERE md5_hash = :k LIMIT 1');
    $legacyStmt->execute(array('k' => $key));
    if ($legacyStmt->fetch(PDO::FETCH_ASSOC)) {
        sqlite_test_json(array(
            'status' => 'success',
            'action' => 'checkKey',
            'data' => array(
                'key' => $key,
                'available' => false,
                'message' => '该 Key 与旧版记录冲突，请换一个',
            ),
        ));
    }

    sqlite_test_json(array(
        'status' => 'success',
        'action' => 'checkKey',
        'data' => array(
            'key' => $key,
            'available' => true,
            'message' => '该 Key 可以使用',
        ),
    ));
}

function sqlite_test_list_all($includeHidden = false) {
    $pdo = sqlite_test_pdo();
    $stmt = $pdo->query(
        'SELECT id, share_key, md5_hash, author_nickname, author_message, payload_json, client_ip, created_at
         FROM quiz_store ORDER BY id DESC'
    );
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $items = array();
    foreach ($rows as $row) {
        $items[] = sqlite_test_row_to_data($row, $includeHidden);
    }

    $legacyStmt = $pdo->query('SELECT id, content, md5_hash, created_at FROM text_store ORDER BY id DESC');
    $legacyRows = $legacyStmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($legacyRows as $row) {
        $items[] = array(
            'id' => 'legacy-' . $row['id'],
            'shareKey' => $row['md5_hash'],
            'md5' => $row['md5_hash'],
            'legacy' => true,
            'text' => $row['content'],
            'authorNickname' => '(旧版文本)',
            'authorMessage' => '',
            'questions' => array(),
            'created_at' => $row['created_at'],
        );
    }

    sqlite_test_json(array(
        'status' => 'success',
        'action' => 'list',
        'data' => array(
            'count' => count($items),
            'items' => $items,
        ),
    ));
}

// --- 路由 ---
$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? trim($_GET['action']) : '';

if ($method === 'GET' && $action === 'list') {
    $includeHidden = isset($_GET['edit']) && $_GET['edit'] === 'true';
    sqlite_test_list_all($includeHidden);
}

if ($method === 'GET' && $action === 'checkKey') {
    $key = isset($_GET['key']) ? $_GET['key'] : '';
    sqlite_test_check_key($key);
}

if ($method === 'GET' && $action === 'getQuizPack') {
    $key = isset($_GET['key']) ? trim($_GET['key']) : '';
    if ($key === '') {
        sqlite_test_json(array(
            'status' => 'error',
            'message' => '请提供 key 参数',
        ), 400);
    }
    $pdo = sqlite_test_pdo();
    $found = sqlite_test_find_by_key($pdo, $key);
    if (!$found) {
        sqlite_test_json(array(
            'status' => 'error',
            'message' => '未找到该 Key 对应的出题包',
        ), 404);
    }
    sqlite_test_json(array(
        'status' => 'success',
        'action' => 'getQuizPack',
        'data' => sqlite_test_public_data($found),
    ));
}

$body = sqlite_test_read_body();
if ($action === '' && isset($body['action'])) {
    $action = trim((string) $body['action']);
}

if ($method === 'POST') {
    if ($action === 'create') {
        if (isset($body['pack']) && is_array($body['pack'])) {
            sqlite_test_create_pack($body['pack']);
        } else {
            sqlite_test_create_pack($body);
        }
    }
    if ($action === 'lookup') {
        $key = isset($body['key']) ? $body['key'] : (isset($body['shareKey']) ? $body['shareKey'] : (isset($body['md5']) ? $body['md5'] : ''));
        sqlite_test_lookup($key);
    }
    if ($action === 'checkKey') {
        $key = isset($body['key']) ? $body['key'] : (isset($body['shareKey']) ? $body['shareKey'] : '');
        sqlite_test_check_key($key);
    }
}

sqlite_test_json(array(
    'status' => 'error',
    'message' => '未知操作。支持: POST action=create|lookup|checkKey, GET ?action=list|checkKey',
), 400);
