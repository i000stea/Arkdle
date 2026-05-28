/**
 * 出题页干员输入：加载 data_Operators.json、模糊建议、失焦校验
 */
(function (global) {
  'use strict';

  const OPERATORS_JSON_URL = '../resource/data_Operators.json';
  let operatorsData = null;

  function normalize(s) {
    return (s || '').toString().toLowerCase();
  }

  function loadOperatorsData() {
    if (operatorsData) return Promise.resolve(operatorsData);
    return fetch(OPERATORS_JSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then((data) => {
        operatorsData = data;
        return operatorsData;
      });
  }

  function searchOperators(searchTerm) {
    if (!operatorsData || !searchTerm) return [];
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

      if (cn === term) { score = Math.max(score, 100); bestPos = 0; }
      if (en && en === term) { score = Math.max(score, 98); bestPos = 0; }
      if (pFirst && pFirst === term) { score = Math.max(score, 97); bestPos = 0; }
      if (pAll && pAllNoSpace === termNoSpace) { score = Math.max(score, 96); bestPos = 0; }

      if (!score) {
        if (cn.startsWith(term)) { score = Math.max(score, 90); bestPos = 0; }
        if (en && en.startsWith(term)) { score = Math.max(score, 88); bestPos = 0; }
        if (pFirst && pFirst.startsWith(term)) { score = Math.max(score, 87); bestPos = 0; }
        if (pAll && pAllNoSpace.startsWith(termNoSpace)) { score = Math.max(score, 86); bestPos = 0; }
      }

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

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.pos !== b.pos) return a.pos - b.pos;
      if (a.len !== b.len) return a.len - b.len;
      return a.name.localeCompare(b.name, 'zh');
    });

    return results.map((r) => r.name);
  }

  /** 与主站 searchOperatorByName 一致：中文名或英文名精确匹配 */
  function resolveOperator(raw) {
    const name = (raw || '').trim();
    if (!name || !operatorsData) return null;

    const lower = name.toLowerCase();
    for (const operatorName in operatorsData) {
      if (!Object.prototype.hasOwnProperty.call(operatorsData, operatorName)) continue;
      const operator = operatorsData[operatorName];
      if (operatorName.toLowerCase() === lower ||
          (operator.englishName && operator.englishName.toLowerCase() === lower)) {
        return { canonicalName: operatorName, operator };
      }
    }
    return null;
  }

  function setTargetVisual(input, state, message) {
    input.classList.remove('q-target--valid', 'q-target--invalid', 'q-target--pending');

    if (state === 'valid') {
      input.classList.add('q-target--valid');
    } else if (state === 'invalid') {
      input.classList.add('q-target--invalid');
    } else {
      input.classList.add('q-target--pending');
    }
  }

  function hideSuggestions(container) {
    if (!container) return;
    container.innerHTML = '';
    container.style.display = 'none';
  }

  function showSuggestions(input, container) {
    const term = input.value.trim();
    hideSuggestions(container);
    if (!term) return;

    const matches = searchOperators(term);
    if (!matches.length) return;

    container.style.display = 'block';
    const displayCount = Math.min(matches.length, 10);
    for (let i = 0; i < displayCount; i++) {
      const operatorName = matches[i];
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.textContent = operatorName;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        input.value = operatorName;
        hideSuggestions(container);
        validateTargetInput(input, true);
      });
      container.appendChild(item);
    }
  }

  function validateTargetInput(input, normalizeOnSuccess) {
    const raw = input.value.trim();
    if (!raw) {
      setTargetVisual(input, 'invalid');
      return { ok: false, canonicalName: '', message: '目标干员不能为空' };
    }
    const resolved = resolveOperator(raw);
    if (!resolved) {
      setTargetVisual(input, 'invalid');
      return { ok: false, canonicalName: raw, message: '「' + raw + '」不是有效干员' };
    }
    if (normalizeOnSuccess) {
      input.value = resolved.canonicalName;
    }
    setTargetVisual(input, 'valid');
    return { ok: true, canonicalName: resolved.canonicalName, message: '' };
  }

  function bindTargetInput(input) {
    const wrap = input.closest('.target-input-wrap');
    const suggestions = wrap ? wrap.querySelector('.suggestions-container') : null;
    if (!suggestions) return;

    let inputTimer = null;

    input.addEventListener('input', () => {
      setTargetVisual(input, 'pending', '');
      if (inputTimer) clearTimeout(inputTimer);
      inputTimer = setTimeout(() => showSuggestions(input, suggestions), 200);
    });

    input.addEventListener('focus', () => {
      if (input.value.trim()) showSuggestions(input, suggestions);
    });

    input.addEventListener('blur', () => {
      setTimeout(() => {
        hideSuggestions(suggestions);
        validateTargetInput(input, true);
      }, 150);
    });

    if (input.value.trim()) {
      validateTargetInput(input, true);
    }
  }

  function validateAll(container) {
    const cards = container.querySelectorAll('.q-card');
    const invalid = [];
    let index = 0;

    cards.forEach((card) => {
      index += 1;
      const input = card.querySelector('.q-target');
      if (!input) return;
      const result = validateTargetInput(input, true);
      if (!result.ok) {
        invalid.push({
          index,
          text: input.value.trim(),
          message: result.message,
          card,
        });
        card.classList.add('q-card--invalid-target');
      } else {
        card.classList.remove('q-card--invalid-target');
      }
    });

    return {
      ok: invalid.length === 0,
      invalid,
      total: cards.length,
    };
  }

  global.SetQuestionOperators = {
    init: loadOperatorsData,
    isReady: () => !!operatorsData,
    searchOperators,
    resolveOperator,
    bindTargetInput,
    validateTargetInput,
    validateAll,
  };
})(window);
