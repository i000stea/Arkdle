/**
 * class_RoleRow  - 用于在Canvas上绘制各种线条
 */
class class_RoleRow {
    /**
     * 构造函数
     * @param {HTMLCanvasElement} canvas - Canvas元素
     */
    constructor(data, parent) {
        let createDiv = document.createElement('div');
        createDiv.classList.add('guessing-info');
        this.block = createDiv;
        parent.appendChild(createDiv);

        this.SubItems = [];
        this.refreshData(data);
    }

    /** 兔头模式关闭时需隐藏的数值列（与表头 rabbit-stat 一致） */
    static RABBIT_STAT_KEYS = new Set([
        'oper-hp', 'oper-atk', 'oper-def', 'oper-res', 'oper-reDeploy', 'oper-cost', 'oper-block'
    ]);

    static OPER_STAT_KEYS = new Set([
        'oper-hp', 'oper-atk', 'oper-def', 'oper-res', 'oper-reDeploy', 'oper-cost', 'oper-block'
    ]);

    static OPER_FUZZY_TEXT_KEYS = new Set([
        'oper-Campus', 'oper-Origin', 'oper-Race',
    ]);

    getSubItem(key) {
        if (!this.SubItems[key]) {
            let subItem = document.createElement('div');
            subItem.classList.add(`oper-item`);
            if (class_RoleRow.OPER_STAT_KEYS.has(key)) {
                subItem.classList.add('oper-col-stat');
            } else {
                subItem.classList.add('oper-col-text');
                if (class_RoleRow.OPER_FUZZY_TEXT_KEYS.has(key)) {
                    subItem.classList.add('oper-col-fuzzy-text');
                }
            }
            if (class_RoleRow.RABBIT_STAT_KEYS.has(key)) {
                subItem.classList.add('rabbit-stat');
            }
            this.block.appendChild(subItem);
            this.SubItems[key] = subItem;
        }

        return this.SubItems[key];
    }

    refreshData(data) {
        this.data = data;
        this.getSubItem("oper-name").textContent = data.name;
        this.getSubItem("oper-profession").textContent = data.profession;
        this.getSubItem("oper-hp").textContent = data.hp;
        this.getSubItem("oper-atk").textContent = data.atk;
        this.getSubItem("oper-def").textContent = data.def;
        this.getSubItem("oper-res").textContent = data.res;
        this.getSubItem("oper-reDeploy").textContent = data.reDeploy;
        this.getSubItem("oper-cost").textContent = data.cost;
        this.getSubItem("oper-block").textContent = data.block;
        // this.getSubItem("oper-interval").textContent = data.interval;   
        this.getSubItem("oper-position").textContent = data.position;
        this.getSubItem("oper-Campus").textContent = data.Campus;
        this.getSubItem("oper-Origin").textContent = data.Origin;
        this.getSubItem("oper-Race").textContent = data.Race;

        if (typeof window.syncRabbitModeGrid === 'function') {
            window.syncRabbitModeGrid();
        }
    }

    // 辅助函数：去除非中文字符
    removeNonChinese(str) {
        // 保留中文、数字、小数点和负号
        return String(str).replace(/[^一-龥0-9.-]/g, '');
    }

    // 辅助函数：比较数值并添加相应的类
    // 新增参数：tolerance（差值范围，默认为0）。当两数不相等但绝对差小于该范围时标记为“近似”。
    compareAndAddClass(key, inputValue, actualValue, tolerance = 0) {
        // 去非中文字符后转换为数字
        const cleanInput = parseFloat(this.removeNonChinese(inputValue));
        const cleanActual = parseFloat(this.removeNonChinese(actualValue));

        const element = this.getSubItem(`oper-${key}`);

        // 移除之前可能存在的类
        element.classList.remove('oper-equal', 'oper-different', 'oper-more', 'oper-less', 'oper-approximate');
        element.removeAttribute('data-approx-detail');
        element.removeAttribute('data-approx-tolerance');

        if (isNaN(cleanInput) || isNaN(cleanActual)) {
            // 如果转换失败，回退到简单的字符串比较
            element.classList.add(inputValue === actualValue ? 'oper-equal' : 'oper-different');
        } else if (cleanInput === cleanActual) {
            element.classList.add('oper-equal');
        } else if (Math.abs(cleanInput - cleanActual) < tolerance) {
            // 不相等但在差值范围内
            element.classList.add('oper-approximate');
            element.setAttribute('data-approx-detail', '1');
            element.setAttribute('data-approx-tolerance', String(tolerance));
        } else if (cleanInput > cleanActual) {
            element.classList.add('oper-more');
        } else {
            element.classList.add('oper-less');
        }
    }

    // 使用模糊词典比较分类（势力/出身地/种族），若父集相同则标记为近似
    compareFuzzyCategoryAndAddClass(key, inputValue, actualValue, topLevelKey) {
        const element = this.getSubItem(`oper-${key}`);
        if (!element) return;

        element.classList.remove('oper-equal', 'oper-different', 'oper-more', 'oper-less', 'oper-approximate', 'oper-fuzzy');
        element.removeAttribute('data-fuzzy-detail');
        element.removeAttribute('data-fuzzy-select');
        element.removeAttribute('data-fuzzy-parent');
        element.removeAttribute('data-fuzzy-members');

        if (inputValue === actualValue) {
            element.classList.add('oper-equal');
            return;
        }

        const dictGroup = fuzzyItemData && fuzzyItemData[topLevelKey];
        if (!dictGroup || typeof dictGroup !== 'object' || Object.keys(dictGroup).length === 0) {
            element.classList.add('oper-different');
            return;
        }

        const findParent = (val) => {
            for (const parent in dictGroup) {
                const items = dictGroup[parent];
                if (Array.isArray(items) && items.includes(val)) return parent;
            }
            return null;
        };

        const parentInput = findParent(inputValue);
        const parentActual = findParent(actualValue);

        if (parentInput && parentActual && parentInput === parentActual) {
            element.classList.add('oper-fuzzy');
            element.setAttribute('data-fuzzy-detail', '1');
            element.setAttribute('data-fuzzy-select', String(actualValue ?? ''));
            element.setAttribute('data-fuzzy-parent', String(parentInput));
            const members = dictGroup[parentInput];
            element.setAttribute('data-fuzzy-members', JSON.stringify(Array.isArray(members) ? members : []));
        } else {
            element.classList.add('oper-different');
        }
    }

    async verify(inputData) {
        let delay = 50; // 初始延迟时间为200ms

        const rabbitStatsHidden = typeof document !== 'undefined'
            && document.body.classList.contains('rabbit-mode-off');

        // 辅助函数：创建带延迟的操作；skipDelayAfter 为 true 时不等待（用于被隐藏的兔头列）
        const delayOperation = async (callback, skipDelayAfter = false) => {
            callback();
            if (!skipDelayAfter) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        };

        await delayOperation(() => {
            this.getSubItem("oper-name").classList.add(inputData.name != this.data.name ? "oper-different" : "oper-equal");
        });

        await delayOperation(() => {
            this.getSubItem("oper-profession").classList.add(inputData.profession != this.data.profession ? "oper-different" : "oper-equal");
        });

        await delayOperation(() => {
            this.compareAndAddClass('hp', inputData.hp, this.data.hp, 100);
        }, rabbitStatsHidden);

        await delayOperation(() => {
            this.compareAndAddClass('atk', inputData.atk, this.data.atk, 10);
        }, rabbitStatsHidden);

        await delayOperation(() => {
            this.compareAndAddClass('def', inputData.def, this.data.def, 10);
        }, rabbitStatsHidden);

        await delayOperation(() => {
            this.compareAndAddClass('res', inputData.res, this.data.res);
        }, rabbitStatsHidden);

        await delayOperation(() => {
            this.compareAndAddClass('reDeploy', inputData.reDeploy, this.data.reDeploy, 5);
        }, rabbitStatsHidden);

        await delayOperation(() => {
            this.compareAndAddClass('cost', inputData.cost, this.data.cost, 1);
        }, rabbitStatsHidden);

        await delayOperation(() => {
            this.compareAndAddClass('block', inputData.block, this.data.block);
        }, rabbitStatsHidden);

        await delayOperation(() => {
            this.getSubItem("oper-position").classList.add(inputData.position != this.data.position ? "oper-different" : "oper-equal");
        });

        await delayOperation(() => {
            this.compareFuzzyCategoryAndAddClass('Campus', inputData.Campus, this.data.Campus, 'CampusVague');
        });

        await delayOperation(() => {
            this.compareFuzzyCategoryAndAddClass('Origin', inputData.Origin, this.data.Origin, 'OriginVague');
        });

        await delayOperation(() => {
            this.compareFuzzyCategoryAndAddClass('Race', inputData.Race, this.data.Race, 'RaceVague');
        });

        if (typeof scrollGuessingToLatest === 'function') {
            scrollGuessingToLatest();
        }
    }

    getBlock() {
        return this.block;
    }

}
