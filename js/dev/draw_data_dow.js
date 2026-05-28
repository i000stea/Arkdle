/**
 * drawDataDow  - 用于在Canvas上绘制各种线条
 */
class drawDataDow {
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

    getSubItem(key) {
        if (!this.SubItems[key]) {
            let subItem = document.createElement('div');
            subItem.classList.add(`oper-item`);
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

        if (isNaN(cleanInput) || isNaN(cleanActual)) {
            // 如果转换失败，回退到简单的字符串比较
            element.classList.add(inputValue === actualValue ? 'oper-equal' : 'oper-different');
        } else if (cleanInput === cleanActual) {
            element.classList.add('oper-equal');
        } else if (Math.abs(cleanInput - cleanActual) < tolerance) {
            // 不相等但在差值范围内
            element.classList.add('oper-approximate');
        } else if (cleanInput > cleanActual) {
            element.classList.add('oper-more');
        } else {
            element.classList.add('oper-less');
        }
    }

    // 使用模糊词典比较分类（Campus/Race），若父集相同则标记为近似（去除日志，简化判断）
    compareFuzzyCategoryAndAddClass(key, inputValue, actualValue, topLevelKey) {
        const element = this.getSubItem(`oper-${key}`);
        if (!element) return;

        element.classList.remove('oper-equal', 'oper-different', 'oper-more', 'oper-less', 'oper-approximate');

        if (inputValue === actualValue) {
            element.classList.add('oper-equal');
            return;
        }

        const dictGroup = fuzzyItemData && fuzzyItemData[topLevelKey];
        if (!dictGroup) {
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

        element.classList.add(
            parentInput && parentActual && parentInput === parentActual
                ? 'oper-fuzzy'
                : 'oper-different'
        );
    }



    async verify(inputData) {
        let delay = 50; // 初始延迟时间为200ms

        // 辅助函数：创建带延迟的操作
        const delayOperation = async (callback) => {
            callback();
            await new Promise(resolve => setTimeout(resolve, delay));
        };

        await delayOperation(() => {
            this.getSubItem("oper-name").classList.add(inputData.name != this.data.name ? "oper-different" : "oper-equal");
        });

        await delayOperation(() => {
            this.getSubItem("oper-profession").classList.add(inputData.profession != this.data.profession ? "oper-different" : "oper-equal");
        });

        await delayOperation(() => {
            this.compareAndAddClass('hp', inputData.hp, this.data.hp, 100);
        });

        await delayOperation(() => {
            this.compareAndAddClass('atk', inputData.atk, this.data.atk, 10);
        });

        await delayOperation(() => {
            this.compareAndAddClass('def', inputData.def, this.data.def, 10);
        });

        await delayOperation(() => {
            this.compareAndAddClass('res', inputData.res, this.data.res);
        });

        await delayOperation(() => {
            this.compareAndAddClass('reDeploy', inputData.reDeploy, this.data.reDeploy, 5);
        });

        await delayOperation(() => {
            this.compareAndAddClass('cost', inputData.cost, this.data.cost, 1);
        });

        await delayOperation(() => {
            this.compareAndAddClass('block', inputData.block, this.data.block);
        });

        await delayOperation(() => {
            this.getSubItem("oper-position").classList.add(inputData.position != this.data.position ? "oper-different" : "oper-equal");
        });

        await delayOperation(() => {
            this.compareFuzzyCategoryAndAddClass('Campus', inputData.Campus, this.data.Campus, 'CampusVague');
        });

        await delayOperation(() => {
            this.getSubItem("oper-Origin").classList.add(inputData.Origin != this.data.Origin ? "oper-different" : "oper-equal");
        });

        await delayOperation(() => {
            this.compareFuzzyCategoryAndAddClass('Race', inputData.Race, this.data.Race, 'RaceVague');
        });
    }

    getBlock() {
        return this.block;
    }
}
