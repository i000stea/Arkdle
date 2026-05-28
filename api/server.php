<?php
// 与前端「今日」一致，避免跨日边界与主机默认时区不一致
date_default_timezone_set('Asia/Shanghai');

/**
 * 版本与缓存说明（简要）：
 * - resource/config_version.json：configVersion（猜题相关本地缓存失效）、appVersion（页脚展示）。
 * - 主接口本文件无 GET 参数：返回今日题目等 JSON，HTTP 设为 no-store，避免 CDN/浏览器缓存旧题目。
 * - GET server.php?version_only=1：仅返回 configVersion + appVersion，带 ETag / Last-Modified，
 *   支持 304 与 Cache-Control 短时缓存，减轻重复完整请求（可选给前端或监控用）。
 */

/**
 * 每日题目调试日志：写入 PHP error_log、api/arkdle_dayrandom.log，并累积到本请求 clientLog 供前端 console
 */
function arkdle_dayrandom_client_log_string() {
    if (empty($GLOBALS['ARKDLE_DAYRANDOM_CLIENT_LOG']) || !is_array($GLOBALS['ARKDLE_DAYRANDOM_CLIENT_LOG'])) {
        return '';
    }
    return implode("\n", $GLOBALS['ARKDLE_DAYRANDOM_CLIENT_LOG']);
}

function arkdle_dayrandom_log($message, $context = null) {
    $suffix = '';
    if ($context !== null) {
        if (is_array($context)) {
            $suffix = ' | ' . json_encode($context, JSON_UNESCAPED_UNICODE);
        } else {
            $suffix = ' | ' . (string) $context;
        }
    }
    $line = '[' . date('c') . '] [ArkDle/dayrandom] ' . $message . $suffix;
    error_log($line);
    $logFile = __DIR__ . DIRECTORY_SEPARATOR . 'arkdle_dayrandom.log';
    @file_put_contents($logFile, $line . PHP_EOL, FILE_APPEND | LOCK_EX);
    if (!isset($GLOBALS['ARKDLE_DAYRANDOM_CLIENT_LOG']) || !is_array($GLOBALS['ARKDLE_DAYRANDOM_CLIENT_LOG'])) {
        $GLOBALS['ARKDLE_DAYRANDOM_CLIENT_LOG'] = array();
    }
    $GLOBALS['ARKDLE_DAYRANDOM_CLIENT_LOG'][] = $line;
}

// 设置CORS头部，允许所有来源的跨域请求
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

// 处理OPTIONS预检请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

/**
 * 从 resource/config_version.json 读取：configVersion（前端本地缓存失效）、appVersion（页脚展示）。
 * 部署或改数据后递增 configVersion；发版改 appVersion 字符串。
 *
 * @return array{configVersion:int, appVersion:string, _mtime:int}
 */
function readArkdleVersionConfig() {
    $defaults = array(
        'configVersion' => 1,
        'appVersion' => '1.0.0',
        '_mtime' => 0,
    );
    $path = __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'resource' . DIRECTORY_SEPARATOR . 'config_version.json';
    $real = realpath($path);
    if ($real === false || !is_file($real)) {
        return $defaults;
    }
    clearstatcache(true, $real);
    $mtime = @filemtime($real);
    if ($mtime === false) {
        $mtime = 0;
    }
    $content = @file_get_contents($real);
    if ($content === false) {
        return array_merge($defaults, array('_mtime' => (int) $mtime));
    }
    $decoded = json_decode($content, true);
    if (!is_array($decoded)) {
        return array_merge($defaults, array('_mtime' => (int) $mtime));
    }
    $cv = isset($decoded['configVersion']) ? $decoded['configVersion'] : 1;
    if (is_string($cv) && is_numeric($cv)) {
        $cv = (int) $cv;
    } elseif (!is_int($cv) && !is_float($cv)) {
        $cv = 1;
    } else {
        $cv = (int) $cv;
    }
    $av = isset($decoded['appVersion']) && is_string($decoded['appVersion']) && $decoded['appVersion'] !== ''
        ? trim($decoded['appVersion'])
        : $defaults['appVersion'];
    return array(
        'configVersion' => $cv,
        'appVersion' => $av,
        '_mtime' => (int) $mtime,
    );
}

/**
 * 仅返回版本元数据（不跑每日题目逻辑），供 CDN/浏览器短时缓存；变更 config_version.json 后 ETag 变。
 */
function arkdle_send_version_only_json() {
    $meta = readArkdleVersionConfig();
    $mtime = $meta['_mtime'];
    $payload = array(
        'message' => 'version',
        'status' => 'success',
        'data' => array(
            'configVersion' => $meta['configVersion'],
            'appVersion' => $meta['appVersion'],
        ),
    );
    $etagSeed = (string) $mtime . '|' . $meta['configVersion'] . '|' . $meta['appVersion'];
    $etag = '"' . md5($etagSeed) . '"';
    if (isset($_SERVER['HTTP_IF_NONE_MATCH'])) {
        $inm = trim($_SERVER['HTTP_IF_NONE_MATCH']);
        if ($inm === $etag) {
            header('ETag: ' . $etag, true);
            if ($mtime > 0) {
                header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $mtime) . ' GMT', true);
            }
            header('Cache-Control: public, max-age=120, stale-while-revalidate=600', true);
            http_response_code(304);
            exit();
        }
    }
    header('ETag: ' . $etag, true);
    if ($mtime > 0) {
        header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $mtime) . ' GMT', true);
    }
    header('Cache-Control: public, max-age=120, stale-while-revalidate=600', true);
    ob_clean();
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit();
}

// 轻量版本接口：可缓存，不读写 dayrandom
if (isset($_GET['version_only']) && $_GET['version_only'] === '1') {
    arkdle_send_version_only_json();
}

// 获取今日角色名称的函数
function getTodayOperatorName() {
    $GLOBALS['ARKDLE_DAYRANDOM_CLIENT_LOG'] = array();

    // 相对 api/ 目录解析 resource，避免依赖 PHP 当前工作目录导致读写失败、每日题目无法固定
    $resourceDir = realpath(__DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'resource');
    if ($resourceDir === false || !is_dir($resourceDir)) {
        arkdle_dayrandom_log('resource 目录解析失败', array(
            '__DIR__' => __DIR__,
            'realpath_result' => $resourceDir === false ? 'false' : $resourceDir,
        ));
        return array(
            'success' => false,
            'error' => 'resource 目录不可用: ' . __DIR__,
            'data' => null,
            'today' => date('Y-m-d'),
            'clientLog' => arkdle_dayrandom_client_log_string(),
        );
    }

    $dayrandomFile = $resourceDir . DIRECTORY_SEPARATOR . 'dayrandom.json';
    $operatorsFile = $resourceDir . DIRECTORY_SEPARATOR . 'data_Operators.json';

    // 获取当前日期（与上方时区一致）
    $today = date('Y-m-d');
    
    try {
        // 检查dayrandom.json是否存在
        $dayrandomData = array();
        if (file_exists($dayrandomFile)) {
            $content = file_get_contents($dayrandomFile);
            if ($content === false) {
                arkdle_dayrandom_log('读取 dayrandom.json 失败', array('path' => $dayrandomFile));
                throw new Exception("无法读取 dayrandom.json 文件");
            }
            $dayrandomData = json_decode($content, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                arkdle_dayrandom_log('dayrandom.json JSON 解析失败', array('error' => json_last_error_msg(), 'path' => $dayrandomFile));
                throw new Exception("dayrandom.json 文件格式错误: " . json_last_error_msg());
            }
        } else {
            arkdle_dayrandom_log('dayrandom.json 不存在，将新建', array('path' => $dayrandomFile));
        }
        
        // 检查是否有今日信息（须为非空字符串，避免脏数据导致反复重抽）
        if (isset($dayrandomData[$today]) && is_string($dayrandomData[$today]) && $dayrandomData[$today] !== '') {
            arkdle_dayrandom_log('使用已有今日记录', array('today' => $today, 'operator' => $dayrandomData[$today]));
            return array(
                'success' => true,
                'data' => $dayrandomData[$today],
                'today' => $today,
                'clientLog' => arkdle_dayrandom_client_log_string(),
            );
        }
        
        // 如果没有今日信息，从data_Operators.json随机选择一个角色名称
        if (!file_exists($operatorsFile)) {
            throw new Exception("角色数据文件不存在: " . $operatorsFile);
        }
        
        $content = file_get_contents($operatorsFile);
        if ($content === false) {
            throw new Exception("无法读取角色数据文件");
        }
        
        $operatorsData = json_decode($content, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception("角色数据文件格式错误: " . json_last_error_msg());
        }
        
        if (!is_array($operatorsData) || empty($operatorsData)) {
            throw new Exception("角色数据为空或格式不正确");
        }
        
        // 获取七日前的日期
        $sevenDaysAgo = date('Y-m-d', strtotime('-7 days'));
        
        // 找出过去七天内出现过的角色名称
        $excludedOperators = array();
        foreach ($dayrandomData as $date => $operatorName) {
            if ($date >= $sevenDaysAgo && $date < $today) {
                $excludedOperators[] = $operatorName;
            }
        }
        
        // 获取所有角色名称（键名）
        $allOperatorNames = array_keys($operatorsData);
        
        // 创建可用角色列表，排除过去七天内出现过的角色
        $availableOperators = array_diff($allOperatorNames, $excludedOperators);
        
        // 如果没有可用角色（所有角色都在过去七天出现过），则使用所有角色
        if (empty($availableOperators)) {
            $availableOperators = $allOperatorNames;
        }
        
        // 从可用角色中随机选择一个（array_diff 保留键名，array_values 避免 array_rand 边界问题）
        $pool = array_values($availableOperators);
        $randomIndex = array_rand($pool);
        $randomOperatorName = $pool[$randomIndex];

        // 更新 dayrandom.json（独占锁，减少并发下重复抽签）
        $dayrandomData[$today] = $randomOperatorName;
        $jsonPayload = json_encode($dayrandomData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        if ($jsonPayload === false) {
            arkdle_dayrandom_log('json_encode 失败', array('json_error' => json_last_error_msg()));
            throw new Exception('dayrandom 数据 json_encode 失败: ' . json_last_error_msg());
        }

        error_clear_last();
        arkdle_dayrandom_log('准备写入 dayrandom.json', array(
            'path' => $dayrandomFile,
            'today' => $today,
            'operator' => $randomOperatorName,
            'payload_bytes' => strlen($jsonPayload),
            'resource_dir_writable' => is_writable($resourceDir),
            'dayrandom_exists' => file_exists($dayrandomFile),
            'dayrandom_readable' => file_exists($dayrandomFile) ? is_readable($dayrandomFile) : null,
            'dayrandom_writable' => file_exists($dayrandomFile) ? is_writable($dayrandomFile) : null,
        ));
        $jsonResult = file_put_contents($dayrandomFile, $jsonPayload, LOCK_EX);

        if ($jsonResult === false) {
            $last = error_get_last();
            arkdle_dayrandom_log('dayrandom.json 写入失败', array(
                'path' => $dayrandomFile,
                'payload_bytes' => strlen($jsonPayload),
                'resource_dir_writable' => is_writable($resourceDir),
                'parent_writable' => is_writable(dirname($dayrandomFile)),
                'file_exists_after' => file_exists($dayrandomFile),
                'php_last_error' => $last,
            ));
        } else {
            clearstatcache(true, $dayrandomFile);
            arkdle_dayrandom_log('dayrandom.json 写入成功', array(
                'path' => $dayrandomFile,
                'bytes_written' => $jsonResult,
                'today' => $today,
                'operator' => $randomOperatorName,
                'filesize_after' => file_exists($dayrandomFile) ? filesize($dayrandomFile) : null,
            ));
        }

        return array(
            'success' => true,
            'data' => $randomOperatorName,
            'today' => $today,
            'clientLog' => arkdle_dayrandom_client_log_string(),
        );
        
    } catch (Exception $e) {
        arkdle_dayrandom_log('getTodayOperatorName 异常', array(
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
        ));
        // 返回错误状态而不是 null
        return array(
            'success' => false,
            'error' => $e->getMessage(),
            'data' => null,
            'today' => isset($today) ? $today : date('Y-m-d'),
            'clientLog' => arkdle_dayrandom_client_log_string(),
        );
    }
}

$versionMeta = readArkdleVersionConfig();
$configVersion = $versionMeta['configVersion'];
$appVersion = $versionMeta['appVersion'];

// 获取今日角色名称
$operatorResult = getTodayOperatorName();

// 构建响应数据
$todayStr = isset($operatorResult['today']) ? $operatorResult['today'] : date('Y-m-d');

$clientLog = isset($operatorResult['clientLog']) ? $operatorResult['clientLog'] : '';

if ($operatorResult['success']) {
    $response = array(
        'message' => '测试信息',
        'status' => 'success',
        'data' => array(
            'timestamp' => date('c'),
            'server' => 'ArkDle 测试服务器',
            'version' => $appVersion,
            'appVersion' => $appVersion,
            'configVersion' => $configVersion,
            'environment' => getenv('NODE_ENV') ?: 'development',
            'todayDate' => $todayStr,
            'todayOperatorName' => $operatorResult['data'],
            'dayrandomDebugLog' => $clientLog,
        )
    );
} else {
    $response = array(
        'message' => '获取今日角色失败',
        'status' => 'error',
        'error' => $operatorResult['error'],
        'data' => array(
            'timestamp' => date('c'),
            'server' => 'ArkDle 测试服务器',
            'version' => $appVersion,
            'appVersion' => $appVersion,
            'configVersion' => $configVersion,
            'environment' => getenv('NODE_ENV') ?: 'development',
            'todayDate' => $todayStr,
            'todayOperatorName' => null,
            'dayrandomDebugLog' => $clientLog,
        )
    );
}

// 主接口含每日题目，禁止中间缓存；版本号仍来自服务端 JSON，由客户端自行展示与本地记住
header('Cache-Control: no-store, no-cache, must-revalidate', true);
header('Pragma: no-cache', true);

// 输出JSON响应，确保没有BOM字符
ob_clean(); // 清空输出缓冲区
echo json_encode($response, JSON_UNESCAPED_UNICODE);

// 记录访问日志（可选）
$logMessage = "[" . date('c') . "] 接收到请求: {$_SERVER['REQUEST_METHOD']} {$_SERVER['REQUEST_URI']}";
// file_put_contents('api_access.log', $logMessage . PHP_EOL, FILE_APPEND);

exit();