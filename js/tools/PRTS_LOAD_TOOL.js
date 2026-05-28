// ==UserScript==
// @name         PRTS Load Tool
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  明日方舟干员数据加载工具 - 提供本地JSON文件读取和保存功能
// @author       You
// @match		 prts.wiki/w/%E5%B9%B2%E5%91%98%E4%B8%80%E8%A7%88
// @match        https://greasyfork.org/zh-CN
// @icon         https://www.google.com/s2/favicons?sz=64&domain=greasyfork.org
// @grant        GM_setClipboard
// @grant        GM_download
// ==/UserScript==

(function () {
    'PRTS Load Tool';
    // 注入样式
    injectStyles();

    // 当文档加载完成后初始化工具
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTool);
    } else {
        initTool();
    }


})();
// 全局变量用于暂存干员数据
let stagedOperatorsData = {};


// 注入样式
function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
/* PRTS Load Tool 样式 */
#prts-control-panel {
    position: fixed;
    top: 10px;
    right: 10px;
    width: 250px;
    background: #000000cc;
    border: 1px solid #444;
    border-radius: 8px;
    padding: 15px;
    z-index: 9999;
    color: #fff;
    font-family: Arial, sans-serif;
    font-size: 12px;
    box-shadow: 0 4px 12px #00000080;
    backdrop-filter: blur(5px);
}

.prts-panel-title {
    margin: 0 0 10px 0;
    font-size: 14px;
    color: #4e8cff;
}

.prts-button {
    width: 100%;
    padding: 8px;
    margin-bottom: 10px;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
}

.prts-button-read {
    background: #3a7ad9;
}

.prts-button-extract {
    background: #4e8cff;
}

.prts-button-view {
    background: #ff9f43;
}

.prts-button-traverse {
    background: #51cf66;
}

.prts-button-save {
    background: #ff6b6b;
}

.prts-file-input {
    display: none;
}

.prts-status {
    margin-top: 10px;
    font-size: 11px;
    color: #999;
}

.prts-status-error {
    color: #ff6b6b;
}

.prts-preview-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 600px;
    max-height: 80vh;
    background: #000000f2;
    border: 1px solid #444;
    border-radius: 8px;
    padding: 20px;
    z-index: 10000;
    color: #fff;
    font-family: Arial, sans-serif;
}

.prts-preview-title {
    margin: 0 0 15px 0;
    font-size: 16px;
    color: #4e8cff;
}

.prts-data-area {
    width: 100%;
    max-height: 50vh;
    overflow: auto;
    padding: 10px;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 4px;
    font-size: 12px;
    color: white;
    white-space: pre-wrap;
}

.prts-staged-info {
    margin-top: 10px;
    font-size: 12px;
    color: #ff9f43;
}

.prts-button-area {
    margin-top: 15px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

.prts-dialog-button {
    padding: 8px 16px;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.prts-button-cancel {
    background: #666;
}

.prts-button-apply {
    background: #4e8cff;
}

.prts-close-button {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 30px;
    height: 30px;
    background: transparent;
    color: #999;
    border: none;
    border-radius: 50%;
    font-size: 20px;
    cursor: pointer;
}

.prts-close-button:hover {
    color: #fff;
    background: #ffffff1a;
}

.prts-progress-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 400px;
    background: #000000f2;
    border: 1px solid #444;
    border-radius: 8px;
    padding: 20px;
    z-index: 10001;
    color: #fff;
    font-family: Arial, sans-serif;
    text-align: center;
}

.prts-progress-title {
    margin: 0 0 15px 0;
    font-size: 16px;
    color: #4e8cff;
}

.prts-progress-info {
    margin: 10px 0;
    font-size: 14px;
}

.prts-progress-bar {
    width: 100%;
    height: 20px;
    background: #333;
    border-radius: 10px;
    overflow: hidden;
    margin: 15px 0;
}

.prts-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #4e8cff, #51cf66);
    transition: width 0.3s ease;
}

.prts-stop-button {
    padding: 8px 16px;
    background: #ff6b6b;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    margin-top: 10px;
}
`;
    document.head.appendChild(style);
}


// 创建固定在右上角的控制面板
function createControlPanel() {
    // 创建主容器
    const panel = document.createElement('div');
    panel.id = 'prts-control-panel';

    // 标题
    const title = document.createElement('h3');
    title.textContent = 'PRTS 数据工具';
    title.className = 'prts-panel-title';
    panel.appendChild(title);

    // 文件读取按钮
    const readButton = document.createElement('button');
    readButton.textContent = '读取本地JSON文件';
    readButton.className = 'prts-button prts-button-read';
    readButton.onclick = handleReadFile;
    panel.appendChild(readButton);

    // 从页面提取数据按钮
    const extractButton = document.createElement('button');
    extractButton.textContent = '从页面提取干员数据';
    extractButton.className = 'prts-button prts-button-extract';
    extractButton.onclick = function () {
        const stagedBefore = stagedOperatorsData ? Object.keys(stagedOperatorsData).length : 0;
        logExtract('按钮「从页面提取干员数据」：点击', { 点击前暂存干员数: stagedBefore });

        const extractedData = extractOperatorsData();
        const extractedKeys = Object.keys(extractedData || {});
        logExtract('按钮回调：extractOperatorsData 已返回', {
            返回对象键数量: extractedKeys.length,
            键列表: extractedKeys,
        });

        if (extractedData) {
            // 如果有暂存数据，则进行合并（增量添加）
            if (stagedOperatorsData) {
                // 创建新的数据对象，保留原有暂存数据，添加新提取的数据
                const mergedData = { ...stagedOperatorsData };
                let mergeUpdated = 0;
                let mergeAdded = 0;

                // 合并提取的数据到暂存数据（字段级别）
                for (const operatorName in extractedData) {
                    if (extractedData.hasOwnProperty(operatorName)) {
                        // 如果暂存数据中已经有这个干员，则进行字段级别合并
                        if (mergedData[operatorName]) {
                            mergedData[operatorName] = {
                                ...mergedData[operatorName],
                                ...extractedData[operatorName]
                            };
                            mergeUpdated++;
                        } else {
                            // 如果暂存数据中没有这个干员，则直接添加
                            mergedData[operatorName] = extractedData[operatorName];
                            mergeAdded++;
                        }
                    }
                }

                logExtract('预览数据：已与暂存合并', {
                    合并后干员总数: Object.keys(mergedData).length,
                    本次覆盖已有干员条目数: mergeUpdated,
                    本次新增干员条目数: mergeAdded,
                });

                // 显示合并后的数据
                showDataPreview(mergedData);
            } else {
                logExtract('预览数据：无暂存，直接展示本次提取', { 数量: extractedKeys.length });
                // 没有暂存数据，直接显示提取的数据
                showDataPreview(extractedData);
            }
        }
    };
    panel.appendChild(extractButton);

    // 查看暂存内容按钮
    const viewStagedButton = document.createElement('button');
    viewStagedButton.textContent = '查看暂存内容';
    viewStagedButton.className = 'prts-button prts-button-view';
    viewStagedButton.onclick = showStagedData;
    panel.appendChild(viewStagedButton);

    // 暂存内容填充拼音字段按钮
    const fillPinyinButton = document.createElement('button');
    fillPinyinButton.textContent = '暂存内容填充拼音字段';
    fillPinyinButton.className = 'prts-button prts-button-traverse';
    fillPinyinButton.onclick = fillStagedDataPinyin;
    panel.appendChild(fillPinyinButton);


    // 自动遍历势力按钮
    const traverseFactionButton = document.createElement('button');
    traverseFactionButton.textContent = '自动遍历势力';
    traverseFactionButton.className = 'prts-button prts-button-traverse';
    traverseFactionButton.onclick = traverseFaction;
    panel.appendChild(traverseFactionButton);

    // 自动遍历出身地按钮
    const traverseOriginButton = document.createElement('button');
    traverseOriginButton.textContent = '自动遍历出身地';
    traverseOriginButton.className = 'prts-button prts-button-traverse';
    traverseOriginButton.onclick = traverseOrigin;
    panel.appendChild(traverseOriginButton);

    // 自动遍历种族按钮
    const traverseRaceButton = document.createElement('button');
    traverseRaceButton.textContent = '自动遍历种族';
    traverseRaceButton.className = 'prts-button prts-button-traverse';
    traverseRaceButton.onclick = traverseRace;
    panel.appendChild(traverseRaceButton);

    // 文件保存按钮
    const saveButton = document.createElement('button');
    saveButton.textContent = '保存当前数据';
    saveButton.className = 'prts-button prts-button-save';
    saveButton.onclick = handleSaveFile;
    panel.appendChild(saveButton);

    // 文件输入元素（隐藏）
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.className = 'prts-file-input';
    fileInput.id = 'prts-file-input';
    fileInput.onchange = handleFileSelect;
    panel.appendChild(fileInput);

    // 状态信息
    const status = document.createElement('div');
    status.id = 'prts-status';
    status.className = 'prts-status';
    status.textContent = '就绪';
    panel.appendChild(status);

    return panel;
}

// 处理文件读取按钮点击
function handleReadFile() {
    document.getElementById('prts-file-input').click();
}

// 处理文件选择
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 检查文件类型
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        updateStatus('请选择JSON格式的文件', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            updateStatus('成功读取文件: ' + file.name);

            // 如果有暂存数据，则进行合并（增量添加）
            if (stagedOperatorsData) {
                // 创建新的数据对象，保留原有暂存数据，添加新数据
                const mergedData = { ...stagedOperatorsData };

                // 合并文件中的数据到暂存数据（字段级别）
                for (const operatorName in data) {
                    if (data.hasOwnProperty(operatorName)) {
                        // 如果暂存数据中已经有这个干员，则进行字段级别合并
                        if (mergedData[operatorName]) {
                            mergedData[operatorName] = {
                                ...mergedData[operatorName],
                                ...data[operatorName]
                            };
                        } else {
                            // 如果暂存数据中没有这个干员，则直接添加
                            mergedData[operatorName] = data[operatorName];
                        }
                    }
                }

                // 显示合并后的数据
                showDataPreview(mergedData);
            } else {
                // 没有暂存数据，直接显示文件数据
                showDataPreview(data);
            }

            // 移除自动应用数据的功能，让用户在预览后手动决定

        } catch (error) {
            updateStatus('文件解析错误: ' + error.message, 'error');
        }
    };
    reader.onerror = function () {
        updateStatus('文件读取失败', 'error');
    };
    reader.readAsText(file);
}

// 处理文件保存
function handleSaveFile() {
    try {
        // 优先使用暂存数据
        const dataToSave = stagedOperatorsData || getCurrentGameData();

        // 转换为JSON字符串
        const jsonString = JSON.stringify(dataToSave, null, 2);

        // 创建Blob对象
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // 创建下载链接并触发下载
        const a = document.createElement('a');
        a.href = url;
        a.download = 'operators_' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        updateStatus('数据已保存到本地文件');
    } catch (error) {
        updateStatus('保存失败: ' + error.message, 'error');
    }
}

// 获取当前游戏数据
function getCurrentGameData() {
    // 尝试从游戏中获取干员数据
    // 这里假设游戏中的operators变量是全局可访问的
    if (window.operators && Array.isArray(window.operators)) {
        return window.operators;
    }

    // 如果无法直接获取，尝试从operators.json加载默认数据
    // 注意：这里返回的是一个示例数据，实际使用时可能需要调整
    return {
        "能天使": { "1": "能天使" },
        "推进之王": { "1": "推进之王" },
        "银灰": { "1": "银灰" },
        "艾雅法拉": { "1": "艾雅法拉" }
    };
}

// 将读取的数据应用到游戏中并导出保存JSON
function applyDataToGame(data) {
    try {
        // 增量保存：如果已有暂存数据，则进行字段级别的合并
        if (Object.keys(stagedOperatorsData).length > 0) {
            // 创建合并后的数据对象
            const mergedData = { ...stagedOperatorsData };

            // 合并新数据到暂存数据（字段级别）
            for (const operatorName in data) {
                if (data.hasOwnProperty(operatorName)) {
                    // 如果暂存数据中已经有这个干员，则进行字段级别合并
                    if (mergedData[operatorName]) {
                        mergedData[operatorName] = {
                            ...mergedData[operatorName],
                            ...data[operatorName]
                        };
                    } else {
                        // 如果暂存数据中没有这个干员，则直接添加
                        mergedData[operatorName] = data[operatorName];
                    }
                }
            }

            // 更新暂存数据
            stagedOperatorsData = mergedData;
        } else {
            // 如果没有暂存数据，则直接设置
            stagedOperatorsData = data;
        }

        // 获取暂存的干员数量
        const operatorCount = Object.keys(stagedOperatorsData).length;

        updateStatus(`数据已暂存，共暂存 ${operatorCount} 个干员数据`);

        // 这里不再自动应用到游戏或保存文件
        // 数据只保存在内存中的全局变量中

    } catch (error) {
        updateStatus('暂存数据失败: ' + error.message, 'error');
    }
}

// 显示数据预览
function showDataPreview(data) {
    // 创建预览对话框
    const previewDialog = document.createElement('div');
    previewDialog.className = 'prts-preview-dialog';

    // 标题
    const title = document.createElement('h3');
    title.textContent = '数据预览';
    title.className = 'prts-preview-title';
    previewDialog.appendChild(title);

    // 数据显示区域
    const dataArea = document.createElement('pre');
    dataArea.className = 'prts-data-area';
    dataArea.textContent = JSON.stringify(data, null, 2);
    previewDialog.appendChild(dataArea);

    // 暂存信息提示
    const stagedInfo = document.createElement('div');
    stagedInfo.className = 'prts-staged-info';

    // 获取暂存的干员数量
    const currentDataCount = Object.keys(data).length;
    const stagedCount = stagedOperatorsData ? Object.keys(stagedOperatorsData).length : 0;

    stagedInfo.textContent = `当前预览干员数量: ${currentDataCount} | 已暂存干员数量: ${stagedCount}`;
    previewDialog.appendChild(stagedInfo);

    // 按钮区域
    const buttonArea = document.createElement('div');
    buttonArea.className = 'prts-button-area';

    // 取消按钮
    const cancelButton = document.createElement('button');
    cancelButton.textContent = '取消';
    cancelButton.className = 'prts-dialog-button prts-button-cancel';
    cancelButton.onclick = function () {
        document.body.removeChild(previewDialog);
    };
    buttonArea.appendChild(cancelButton);

    // 暂存按钮 (原应用按钮)
    const applyButton = document.createElement('button');
    applyButton.textContent = '暂存';
    applyButton.className = 'prts-dialog-button prts-button-apply';
    applyButton.onclick = function () {
        applyDataToGame(data);
        document.body.removeChild(previewDialog);
    };
    buttonArea.appendChild(applyButton);

    previewDialog.appendChild(buttonArea);

    // 关闭按钮
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.className = 'prts-close-button';
    closeButton.onclick = function () {
        document.body.removeChild(previewDialog);
    };
    previewDialog.appendChild(closeButton);

    document.body.appendChild(previewDialog);
}


/** 从页面提取干员数据流程的详细控制台日志（前缀便于过滤） */
function logExtract(message, detail) {
    if (detail !== undefined) {
        console.log('[PRTSLoadTool|页面提取]', message, detail);
    } else {
        console.log('[PRTSLoadTool|页面提取]', message);
    }
}

/** 在容器内按候选选择器依次查询，返回第一个命中的元素（PRTS 表格新版 short-container / 旧版 long-container 兼容） */
function firstMatch(root, selectors) {
    for (let i = 0; i < selectors.length; i++) {
        const el = root.querySelector(selectors[i]);
        if (el) return el;
    }
    return null;
}

function findPageOperatorsData() {
    logExtract('查找 DOM：开始', { href: location.href });
    const filterResult = document.getElementById('filter-result');
    if (!filterResult) {
        logExtract('查找 DOM：失败', { reason: '未找到 #filter-result' });
        updateStatus('未找到filter-result元素', 'error');
        return null;
    }

    // PRTS 新版干员卡片为 .short-container，旧版为 .long-container
    const operatorContainers = filterResult.querySelectorAll('.short-container, .long-container');

    if (operatorContainers.length === 0) {
        logExtract('查找 DOM：失败', { reason: '#filter-result 下无 .short-container / .long-container', filterResultChildCount: filterResult.children.length });
        updateStatus('未找到任何干员数据容器', 'error');
        return null;
    }

    logExtract('查找 DOM：成功', { 容器数量: operatorContainers.length });
    updateStatus(`找到 ${operatorContainers.length} 个干员数据`);

    return operatorContainers;
}

// 从页面提取干员数据
function extractOperatorsData() {
    logExtract('extractOperatorsData：开始', {
        当前暂存干员数: stagedOperatorsData ? Object.keys(stagedOperatorsData).length : 0,
    });

    const operatorContainers = findPageOperatorsData();
    let tempOperatorsData = {};

    // 添加空异常处理
    if (!operatorContainers) {
        logExtract('extractOperatorsData：中止', { reason: '无有效数据容器，返回空对象' });
        updateStatus('无法提取干员数据：找不到有效的数据容器', 'error');
        return tempOperatorsData; // 返回空对象
    }

    operatorContainers.forEach((container, index) => {

        // 提取干员名称（.name 区：新版与旧版链接结构兼容）
        const nameElement = firstMatch(container, [
            '.name a div:nth-child(1)',
            '.name > a > div:first-child',
            '.name a',
        ]);
        const operatorName = nameElement ? nameElement.textContent.trim() : `未知干员_${index}`;

        // 提取英文名称
        const englishNameElement = firstMatch(container, [
            '.name > div > div:nth-child(2)',
            '.name a div:nth-child(2)',
        ]);
        const englishName = englishNameElement ? englishNameElement.textContent.trim() : '';

        // 稀有度：新版在 .avatar-container / .avatar 内；旧版可能在 .camp 或独立 .rarity
        const rarityImg = firstMatch(container, [
            '.avatar .rarity img',
            '.avatar-container .rarity img',
            '.camp .rarity img',
            '.rarity img',
        ]);
        let rarity = '未知';
        let raritySrcLogged = '';
        if (rarityImg) {
            const raritySrc = rarityImg.src;
            raritySrcLogged = raritySrc;
            if (raritySrc.includes('稀有度_')) {
                const rarityMatch = raritySrc.match(/稀有度_([^_]+)_([0-9])/);
                if (rarityMatch && rarityMatch[2]) {
                    rarity = rarityMatch[2] + '星';
                }
            }
        }

        // 职业图标：新版在头像区 .avatar .profession；旧版可能在 .camp 或独立 .profession
        let profession = '未知';
        let professionSrcLogged = '';
        const professionHost = firstMatch(container, ['.avatar .profession', '.avatar-container .profession', '.camp .profession', '.profession']);
        let professionImg = null;
        if (professionHost) {
            professionImg = professionHost.querySelector('img') || professionHost.children[0];
        }
        if (professionImg && professionImg.src) {
            const professionSrc = decodeURI(professionImg.src);
            professionSrcLogged = professionSrc;
            if (professionSrc.includes('图标_职业_')) {
                const professionMatch = professionSrc.match(/图标_职业_([^.\/]+)/);
                if (professionMatch && professionMatch[1]) {
                    profession = professionMatch[1].split('.')[0].split('/')[0];
                }
            } else {
                profession = professionSrc;
            }
        }

        // 基础属性：新版仅在 .data 下含 hp/atk/def/res；再部署等不在 .data 而在 .property
        const hpElement = firstMatch(container, ['.data .hp', '.data1 .hp']);
        const atkElement = firstMatch(container, ['.data .atk', '.data1 .atk']);
        const defElement = firstMatch(container, ['.data .def', '.data1 .def']);
        const resElement = firstMatch(container, ['.data .res', '.data1 .res']);

        // 再部署 / 费用 / 阻挡 / 攻击间隔：新版在 .property 下（class 为 re_deploy）；旧版在 .data2
        const reDeployElement = firstMatch(container, ['.property .re_deploy', '.data .re_deploy', '.data2 .re_deploy']);
        const costElement = firstMatch(container, ['.property .cost', '.data .cost', '.data2 .cost']);
        const blockElement = firstMatch(container, ['.property .block', '.data .block', '.data2 .block']);
        const intervalElement = firstMatch(container, ['.property .interval', '.data .interval', '.data2 .interval']);

        // 部署位（远程位/近战位等）：新版在 .tag .position；旧版可能在 .property 或 .other
        const positionElement = firstMatch(container, ['.tag .position', '.property .position', '.other .position']);
        const obtainElement = firstMatch(container, ['.obtain div', '.obtain > div', '.obtain']);

        const domHits = {
            nameElement: !!nameElement,
            englishNameElement: !!englishNameElement,
            rarityImg: !!rarityImg,
            professionImg: !!professionImg,
            camp: !!container.querySelector('.camp'),
            data: !!container.querySelector('.data'),
            data1: !!container.querySelector('.data1'),
            property: !!container.querySelector('.property'),
            tag: !!container.querySelector('.tag'),
            hp: !!hpElement,
            atk: !!atkElement,
            def: !!defElement,
            res: !!resElement,
            reDeploy: !!reDeployElement,
            cost: !!costElement,
            block: !!blockElement,
            interval: !!intervalElement,
            position: !!positionElement,
            obtain: !!obtainElement,
        };

        // 构建干员数据对象
        const extractedData = {
            'name': operatorName,
            'englishName': englishName,
            'rarity': rarity,
            'profession': profession,
            'hp': hpElement ? hpElement.textContent.trim() : '0',
            'atk': atkElement ? atkElement.textContent.trim() : '0',
            'def': defElement ? defElement.textContent.trim() : '0',
            'res': resElement ? resElement.textContent.trim() : '0',
            'reDeploy': reDeployElement ? reDeployElement.textContent.trim() : '',
            'cost': costElement ? costElement.textContent.trim() : '',
            'block': blockElement ? blockElement.textContent.trim() : '',
            'interval': intervalElement ? intervalElement.textContent.trim() : '',
            'position': positionElement ? positionElement.textContent.trim() : '',
            'obtain': obtainElement ? obtainElement.textContent.trim() : '',
        };

        const hadStaged = !!(stagedOperatorsData && stagedOperatorsData[operatorName]);

        // 如果暂存数据存在，执行增量添加（使用提取的数据更新暂存数据）
        if (hadStaged) {
            // 先使用暂存数据，然后用提取的数据更新它
            tempOperatorsData[operatorName] = { ...tempOperatorsData[operatorName], ...extractedData };
        } else {
            tempOperatorsData[operatorName] = extractedData;
        }

        logExtract(`条目 [${index + 1}/${operatorContainers.length}]`, {
            operatorName,
            englishName,
            rarity,
            profession,
            与暂存同名合并: hadStaged,
            dom选择器命中: domHits,
            稀有度图片src: raritySrcLogged || '(无)',
            职业图片src: professionSrcLogged || '(无)',
            提取字段: extractedData,
        });

        const missingDom = Object.entries(domHits).filter(([, v]) => !v).map(([k]) => k);
        if (missingDom.length) {
            logExtract(`条目 [${index + 1}] DOM 未命中提示`, { operatorName, 未命中: missingDom });
        }
    });

    const extractedCount = Object.keys(tempOperatorsData).length;
    logExtract('extractOperatorsData：完成', {
        本次提取干员数: extractedCount,
        干员名称列表: Object.keys(tempOperatorsData),
    });

    updateStatus(`成功提取 ${extractedCount} 个干员数据`);
    return tempOperatorsData;

}

// 更新状态信息
function updateStatus(message, type = 'info') {
    const statusElement = document.getElementById('prts-status');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = type === 'error' ? 'prts-status prts-status-error' : 'prts-status';

        // 3秒后恢复默认状态（如果不是错误信息）
        if (type !== 'error') {
            setTimeout(() => {
                statusElement.textContent = '就绪';
                statusElement.className = 'prts-status';
            }, 3000);
        }
    }
}

// 加载外部拼音库
function loadPinyinLibraries() {
    return new Promise((resolve, reject) => {
        // 加载拼音字典
        const script1 = document.createElement('script');
        script1.src = 'https://gitee.com/anxon/pinyinjs/raw/master/dict/pinyin_dict_withtone.js';
        script1.onload = function() {
            // 第一个脚本加载完成后，加载第二个脚本
            const script2 = document.createElement('script');

            script2.src = 'https://gitee.com/anxon/pinyinjs/raw/master/pinyinUtil.js';
            script2.onload = function() {
                updateStatus('拼音库加载完成');
                resolve();
            };
            script2.onerror = function(event) {
                console.error('拼音工具库加载失败:', event);
                console.error('Script URL:', script2.src);
                console.error('Error details:', event.error || event.message || '未知错误');
                updateStatus('拼音工具库加载失败', 'error');
                reject(new Error('拼音工具库加载失败: ' + (event.error || event.message || '未知错误')));
            };
            document.head.appendChild(script2);
        };
        script1.onerror = function(event) {
            console.error('拼音字典加载失败:', event);
            console.error('Script URL:', script1.src);
            console.error('Error details:', event.error || event.message || '未知错误');
            updateStatus('拼音字典加载失败', 'error');
            reject(new Error('拼音字典加载失败: ' + (event.error || event.message || '未知错误')));
        };
        document.head.appendChild(script1);
    });
}

// 初始化工具
function initTool() {
    // 创建并添加控制面板
    const controlPanel = createControlPanel();
    document.body.appendChild(controlPanel);

    // 添加样式，确保面板在不同网站上都能正常显示
    const style = document.createElement('style');
    style.textContent = `
        #prts-control-panel button:hover {
            opacity: 0.9;
            transform: translateY(-1px);
            transition: all 0.2s ease;
        }
        #prts-control-panel button:active {
            transform: translateY(0);
        }
    `;
    document.head.appendChild(style);

    // 加载拼音库
    loadPinyinLibraries().then(() => {
        updateStatus('工具已加载，拼音功能可用');
    }).catch((error) => {
        updateStatus('工具已加载，但拼音功能不可用');
        console.error('拼音库加载失败:', error);
    });
}

// 显示暂存的干员数据
function showStagedData() {
    // 检查是否有暂存的数据
    if (!stagedOperatorsData || Object.keys(stagedOperatorsData).length === 0) {
        updateStatus('没有暂存的数据', 'error');
        return;
    }

    // 创建暂存数据预览对话框
    const stagedDialog = document.createElement('div');
    stagedDialog.className = 'prts-preview-dialog';

    // 标题
    const title = document.createElement('h3');
    title.textContent = '暂存数据预览';
    title.className = 'prts-preview-title';
    stagedDialog.appendChild(title);

    // 暂存信息提示
    const stagedInfo = document.createElement('div');
    stagedInfo.className = 'prts-staged-info';
    stagedInfo.textContent = `已暂存干员数量: ${Object.keys(stagedOperatorsData).length}`;
    stagedDialog.appendChild(stagedInfo);

    // 数据显示区域
    const dataArea = document.createElement('pre');
    dataArea.className = 'prts-data-area';
    dataArea.textContent = JSON.stringify(stagedOperatorsData, null, 2);
    stagedDialog.appendChild(dataArea);

    // 按钮区域
    const buttonArea = document.createElement('div');
    buttonArea.className = 'prts-button-area';

    // 关闭按钮
    const closeButton = document.createElement('button');
    closeButton.textContent = '关闭';
    closeButton.className = 'prts-dialog-button prts-button-cancel';
    closeButton.onclick = function () {
        document.body.removeChild(stagedDialog);
    };
    buttonArea.appendChild(closeButton);

    // 清除暂存按钮
    const clearButton = document.createElement('button');
    clearButton.textContent = '清除暂存';
    clearButton.className = 'prts-dialog-button prts-button-save';
    clearButton.onclick = function () {
        stagedOperatorsData = null;
        updateStatus('暂存数据已清除');
        document.body.removeChild(stagedDialog);
    };
    buttonArea.appendChild(clearButton);

    stagedDialog.appendChild(buttonArea);

    // 右上角关闭按钮
    const cornerCloseButton = document.createElement('button');
    cornerCloseButton.textContent = '×';
    cornerCloseButton.className = 'prts-close-button';
    cornerCloseButton.onclick = function () {
        document.body.removeChild(stagedDialog);
    };
    stagedDialog.appendChild(cornerCloseButton);

    document.body.appendChild(stagedDialog);
}

// 为暂存内容填充拼音字段
function fillStagedDataPinyin() {
    // 检查是否有暂存的数据
    if (!stagedOperatorsData || Object.keys(stagedOperatorsData).length === 0) {
        updateStatus('没有暂存的数据', 'error');
        return;
    }

    // 检查是否存在拼音工具
    if (typeof window.pinyinUtil === 'undefined') {
        updateStatus('拼音库未加载，无法填充拼音字段', 'error');
        return;
    }

    try {
        let updatedCount = 0;

        // 遍历暂存数据中的每个干员
        for (const operatorName in stagedOperatorsData) {
            if (stagedOperatorsData.hasOwnProperty(operatorName)) {
                // 确保干员对象存在
                if (!stagedOperatorsData[operatorName]) {
                    stagedOperatorsData[operatorName] = {};
                }

                // 生成拼音字段
                const pinyin = convertToPinyin(operatorName);
                if (pinyin) {
                    stagedOperatorsData[operatorName]['拼音'] = pinyin;
                    updatedCount++;
                }
            }
        }

        updateStatus(`成功为 ${updatedCount} 个干员填充拼音字段`);

    } catch (error) {
        updateStatus('填充拼音字段时出错: ' + error.message, 'error');
    }
}

// 将中文转换为拼音的辅助函数
function convertToPinyin(chineseText) {
    if (!chineseText || typeof window.pinyinUtil === 'undefined') {
        return '';
    }

    try {
        // 使用外部拼音库转换，去除声调
        const pinyin = window.pinyinUtil.getFirstLetter(chineseText);
        return pinyin;
    } catch (error) {
        console.error('拼音转换出错:', error);
        return '';
    }
}

// 查找筛选区域的checkboxs元素的通用函数
function findCheckboxsElement(title = "title") {
    try {
        // 1. 查找class="title"并且内容等于"${title}"的元素
        const titleElement = document.evaluate(
            `//*[@class='title' and text()='${title}']`,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        ).singleNodeValue;

        if (!titleElement) {
            console.log(`未找到内容为"${title}"`);
            return null;
        }
        else {
            console.log(`找到标题为"${title}"的元素`, titleElement);

        }

        // 2. 获取其父元素的所有子元素（同级元素），并取末尾元素作为allGroup
        const parentElement = titleElement.parentNode;
        const siblingElements = parentElement.children;

        if (siblingElements.length === 0) {
            console.log('未找到同级元素或同级元素数量为0');
            return null;
        }

        const checkboxs = siblingElements[siblingElements.length - 1];
        console.log('找到了同级元素中的最后一个对象作为checkboxs', checkboxs);

        return checkboxs;
    } catch (error) {
        console.error('查找checkboxs元素时出错:', error);
        return null;
    }
}

// 自动遍历势力
function traverseFaction() {
    try {
        // 查找页面上显示"势力"的元素
        const factionElement = findCheckboxsElement("势力");

        if (factionElement) {
            console.log('找到了势力元素，准备循环点击每一个子元素');
            const children = Array.from(factionElement.children);
            let index = 0;

            // 开始点击第一个元素
            clickNextElement();

            // 创建延迟点击函数
            function clickNextElement() {
                if (index < children.length) {
                    console.log(`点击第${index + 1}个势力元素${children[index].textContent}`);
                    children[index].click();

                    // 捕捉当前页面中的所有角色列表
                    setTimeout(() => {
                        // 提取当前页面的干员数据
                        const currentOperators = extractOperatorsData();

                        VerificationAddition(currentOperators, 'Campus', children[index].textContent);

                        // 继续原来的逻辑
                        children[index].click();
                        index++;
                        // 再次调用函数处理下一个元素
                        clickNextElement();
                    }, 100);
                } else {
                    console.log('所有势力元素点击完成');
                    updateStatus('所有势力元素点击完成', 'success');
                }
            }

        } else {
            console.log('未找到势力元素');
            updateStatus('未找到势力元素', 'error');
        }
    } catch (error) {
        console.error('自动遍历势力执行出错:', error);
        updateStatus('自动遍历势力执行出错: ' + error.message, 'error');
    }
}

// 自动遍历出身地（预留方法）
function traverseOrigin() {
    try {
        // 查找页面上显示"出身地"的元素
        const originElement = findCheckboxsElement("出身地");

        if (originElement) {
            console.log('找到了出身地元素，准备循环点击每一个子元素');
            const children = Array.from(originElement.children);
            let index = 0;

            // 开始点击第一个元素
            clickNextElement();

            // 创建延迟点击函数
            function clickNextElement() {
                if (index < children.length) {
                    console.log(`点击第${index + 1}个出身地元素${children[index].textContent}`);
                    children[index].click();

                    // 捕捉当前页面中的所有角色列表
                    setTimeout(() => {
                        // 提取当前页面的干员数据
                        const currentOperators = extractOperatorsData();

                        VerificationAddition(currentOperators, 'Origin', children[index].textContent);

                        // 继续原来的逻辑
                        children[index].click();
                        index++;
                        // 再次调用函数处理下一个元素
                        clickNextElement();
                    }, 100);
                } else {
                    console.log('所有出身地元素点击完成');
                    updateStatus('所有出身地元素点击完成', 'success');
                }
            }

        } else {
            console.log('未找到出身地元素');
            updateStatus('未找到出身地元素', 'error');
        }
    } catch (error) {
        console.error('自动遍历出身地执行出错:', error);
        updateStatus('自动遍历出身地执行出错: ' + error.message, 'error');
    }
}

// 自动遍历种族（预留方法）
function traverseRace() {
    try {
        // 查找页面上显示"种族"的元素
        const raceElement = findCheckboxsElement("种族");

        if (raceElement) {
            console.log('找到了种族元素，准备循环点击每一个子元素');
            const children = Array.from(raceElement.children);
            let index = 0;

            // 开始点击第一个元素
            clickNextElement();

            // 创建延迟点击函数
            function clickNextElement() {
                if (index < children.length) {
                    console.log(`点击第${index + 1}个种族元素${children[index].textContent}`);
                    children[index].click();

                    // 捕捉当前页面中的所有角色列表
                    setTimeout(() => {
                        // 提取当前页面的干员数据
                        const currentOperators = extractOperatorsData();

                        VerificationAddition(currentOperators, 'Race', children[index].textContent);

                        // 继续原来的逻辑
                        children[index].click();
                        index++;
                        // 再次调用函数处理下一个元素
                        clickNextElement();
                    }, 100);
                } else {
                    console.log('所有种族元素点击完成');
                    updateStatus('所有种族元素点击完成', 'success');
                }
            }

        } else {
            console.log('未找到种族元素');
            updateStatus('未找到种族元素', 'error');
        }
    } catch (error) {
        console.error('自动遍历种族执行出错:', error);
        updateStatus('自动遍历种族执行出错: ' + error.message, 'error');
    }
}

function VerificationAddition(valueList, targetKey, value) {
    if (valueList && stagedOperatorsData) {
        console.log(`当前页面提取到${Object.keys(valueList).length}个干员数据`);

        // 遍历当前页面的干员数据，与暂存表匹配
        for (const operatorName in valueList) {
            // 检查暂存数据中是否存在同名干员
            if (stagedOperatorsData.hasOwnProperty(operatorName)) {
                // 确保干员对象存在
                if (!stagedOperatorsData[operatorName]) {
                    stagedOperatorsData[operatorName] = {};
                }
                // 增量更新：设置targetKey对应的值
                stagedOperatorsData[operatorName][targetKey] = value;
                console.log(`已为干员：${operatorName} 设置 ${targetKey} 值为：${value}`);
            }
        }
    }
}
