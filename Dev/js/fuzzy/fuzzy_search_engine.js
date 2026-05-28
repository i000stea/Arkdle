(function () {
    'use strict';

    /**
     * FuzzySearchEngine - 干员名称模糊匹配“纯算法层”
     *
     * 迁移来源
     * - 旧版：js/data/operator_name_fuzzy_search.js 的 searchOperators()
     *
     * 为什么要做成“纯函数模块”
     * - 便于单元测试/性能压测（不依赖 DOM、不依赖 window）
     * - Controller 只负责事件与状态编排，搜索规则集中在这里维护
     * - 未来可替换实现：例如 trigram、fuse.js（如项目后续引入）或预构建索引
     *
     * 搜索字段
     * - 中文名：key（operatorsData 的键）
     * - 英文名：englishName
     * - 拼音全拼：pinyinAll（可能带空格，因此会同时比较去空格版本）
     * - 拼音简拼：pinyinFirst
     *
     * 排序规则（与旧版一致）
     * - 分数高优先
     * - 同分时：最早命中位置优先
     * - 再同：名称更短优先
     * - 最后：中文 localeCompare
     */
    function normalize(s) {
        return (s || '').toString().toLowerCase();
    }

    /**
     * 根据 searchTerm 返回匹配的干员名称列表（已排序）
     * @param {Record<string, any>} operatorsData - 干员数据表（key 为干员中文名）
     * @param {string} searchTerm - 用户输入
     * @returns {string[]} 匹配干员中文名数组
     */
    function searchOperators(operatorsData, searchTerm) {
        if (!searchTerm || !operatorsData || Object.keys(operatorsData).length === 0) {
            return [];
        }

        const term = normalize(searchTerm.trim());
        const termNoSpace = term.replace(/\s+/g, '');
        if (!term) return [];

        const results = [];

        for (const name in operatorsData) {
            if (!Object.prototype.hasOwnProperty.call(operatorsData, name)) continue;
            const op = operatorsData[name] || {};

            const cn = normalize(name);
            const en = normalize(op.englishName);
            const pAll = normalize(op.pinyinAll);
            const pAllNoSpace = pAll.replace(/\s+/g, '');
            const pFirst = normalize(op.pinyinFirst);

            let score = 0;
            let bestPos = Infinity;

            // 1) 精确匹配：直接给最高分
            if (cn === term) { score = Math.max(score, 100); bestPos = 0; }
            if (en && en === term) { score = Math.max(score, 98); bestPos = 0; }
            if (pFirst && pFirst === term) { score = Math.max(score, 97); bestPos = 0; }
            if (pAll && pAllNoSpace === termNoSpace) { score = Math.max(score, 96); bestPos = 0; }

            // 2) 前缀匹配：次高分
            if (!score) {
                if (cn.startsWith(term)) { score = Math.max(score, 90); bestPos = 0; }
                if (en && en.startsWith(term)) { score = Math.max(score, 88); bestPos = 0; }
                if (pFirst && pFirst.startsWith(term)) { score = Math.max(score, 87); bestPos = 0; }
                if (pAll && pAllNoSpace.startsWith(termNoSpace)) { score = Math.max(score, 86); bestPos = 0; }
            }

            // 3) 子串匹配：最低分；同时记录“最早命中位置”用于同分排序
            if (!score) {
                const posCN = cn.indexOf(term);
                const posEN = en ? en.indexOf(term) : -1;
                const posPF = pFirst ? pFirst.indexOf(term) : -1;
                const posPA = pAllNoSpace ? pAllNoSpace.indexOf(termNoSpace) : -1;

                if (posCN >= 0) { score = Math.max(score, 80); bestPos = Math.min(bestPos, posCN); }
                if (posEN >= 0) { score = Math.max(score, 78); bestPos = Math.min(bestPos, posEN); }
                if (posPF >= 0) { score = Math.max(score, 77); bestPos = Math.min(bestPos, posPF); }
                if (posPA >= 0) { score = Math.max(score, 76); bestPos = Math.min(bestPos, posPA); }
            }

            if (score > 0) {
                results.push({ name, score, pos: bestPos, len: name.length });
            }
        }

        // 排序：分数高 -> 位置早 -> 名称短 -> 字典序
        results.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (a.pos !== b.pos) return a.pos - b.pos;
            if (a.len !== b.len) return a.len - b.len;
            return a.name.localeCompare(b.name, 'zh');
        });

        return results.map(r => r.name);
    }

    window.ArkdleFuzzySearchEngine = {
        searchOperators,
    };
})();

