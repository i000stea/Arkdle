(function () {
  'use strict';

  const API = 'api.php';
  const SHARE_KEY_MIN_LEN = 4;
  const params = new URLSearchParams(location.search);
  const editMode = params.get('edit') === 'true';
  const $ = (id) => document.getElementById(id);

  function validateCustomShareKey(key) {
    if (!key) return null;
    const len = [...key].length;
    if (len < SHARE_KEY_MIN_LEN) {
      return '分享 Key 自定义时至少需要 ' + SHARE_KEY_MIN_LEN + ' 个字符';
    }
    return null;
  }

  let questionSeq = 0;
  let hasModified = false;

  function showResult(el, ok, html) {
    el.className = 'result show ' + (ok ? 'ok' : 'err');
    el.innerHTML = html;
    el.style.display = 'block';
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function formatError(msg) {
    return escapeHtml(msg).replace(/\n/g, '<br>');
  }

  function hintToText(hints) {
    if (Array.isArray(hints)) return hints[0] != null ? String(hints[0]) : '';
    return hints != null ? String(hints) : '';
  }

  function clampGuesses(n) {
    const v = parseInt(n, 10);
    if (Number.isNaN(v)) return 6;
    return Math.min(12, Math.max(2, v));
  }

  function syncHintRevealSelect(card, preferred) {
    const slider = card.querySelector('.q-guesses-range');
    const select = card.querySelector('.q-hint-count');
    const maxGuesses = clampGuesses(slider.value);
    slider.value = String(maxGuesses);
    card.querySelector('.q-guesses-val').textContent = String(maxGuesses);

    const hintMax = maxGuesses - 1;
    const prev = preferred != null ? parseInt(preferred, 10) : parseInt(select.value, 10);
    let next = Number.isNaN(prev) ? 1 : prev;
    if (next < 1) next = 1;
    if (next > hintMax) next = hintMax;

    select.innerHTML = '';
    for (let i = 1; i <= hintMax; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = String(i);
      if (i === next) opt.selected = true;
      select.appendChild(opt);
    }
  }

  function createQuestionCard(data) {
    const id = ++questionSeq;
    const card = document.createElement('div');
    card.className = 'q-card';
    card.dataset.qid = String(id);
    const guesses = clampGuesses(data && data.maxGuesses != null ? data.maxGuesses : 6);
    card.innerHTML =
      '<div class="q-card-head">' +
      '<span>题目 #' + id + '</span>' +
      '<label class="check-row"><input type="checkbox" class="q-rabbit"> 允许兔头</label>' +
      '<button type="button" class="danger btn-remove-q">删除</button>' +
      '</div>' +
      '<label>目标干员</label>' +
      '<div class="target-input-wrap input-with-suggestions">' +
      '<input type="text" class="q-target" placeholder="输入干员名称（支持中/英/拼音）" autocomplete="off">' +
      '<div class="suggestions-container"></div>' +
      '</div>' +
      '<div class="form-row-2 q-settings-row">' +
      '<div class="field-group range-row">' +
      '<label>可猜测次数 <span class="range-val q-guesses-val">' + guesses + '</span></label>' +
      '<input type="range" class="q-guesses-range" min="2" max="12" step="1" value="' + guesses + '">' +
      '</div>' +
      '<div class="field-group">' +
      '<label>提示出现时间 <span class="hint">（第几次尝试之后）</span></label>' +
      '<select class="q-hint-count"></select>' +
      '</div>' +
      '</div>' +
      '<label>提示</label>' +
      '<input type="text" class="q-hints" placeholder="提示内容（提示词不输入则默认为不进行提示）">';

    if (data) {
      card.querySelector('.q-target').value = data.targetText || '';
      card.querySelector('.q-rabbit').checked = !!data.allowRabbitHead;
      card.querySelector('.q-hints').value = hintToText(data.hints);
      const revealAt = data.hintRevealAfterAttempt != null
        ? data.hintRevealAfterAttempt
        : data.hintRevealCount;
      syncHintRevealSelect(card, revealAt != null ? revealAt : 1);
    } else {
      syncHintRevealSelect(card, 1);
    }

    card.querySelector('.q-guesses-range').addEventListener('input', () => {
      syncHintRevealSelect(card);
    });

    card.querySelector('.btn-remove-q').addEventListener('click', () => {
      const container = $('questionsContainer');
      if (container.children.length <= 1) {
        alert('至少保留一题');
        return;
      }
      card.remove();
      renumberQuestions();
    });

    $('questionsContainer').appendChild(card);

    const targetInput = card.querySelector('.q-target');
    if (window.SetQuestionOperators && window.SetQuestionOperators.isReady()) {
      window.SetQuestionOperators.bindTargetInput(targetInput);
    }

    return card;
  }

  function ensureAllTargetsValid() {
    if (!window.SetQuestionOperators || !window.SetQuestionOperators.isReady()) {
      throw new Error('干员数据尚未加载，请刷新页面后重试');
    }
    const result = window.SetQuestionOperators.validateAll($('questionsContainer'));
    if (!result.ok) {
      const lines = result.invalid.map((item) =>
        '题目 #' + item.index + '：' + (item.text || '（空）') + ' — ' + item.message
      );
      const first = result.invalid[0];
      if (first && first.card) {
        first.card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      throw new Error('请修正以下目标干员（须为干员库中的角色）：\n' + lines.join('\n'));
    }
    return true;
  }

  function renumberQuestions() {
    $('questionsContainer').querySelectorAll('.q-card').forEach((card, i) => {
      card.querySelector('.q-card-head span').textContent = '题目 #' + (i + 1);
    });
  }

  function collectPack() {
    hasModified = true;
    const questions = [];
    $('questionsContainer').querySelectorAll('.q-card').forEach((card) => {
      questions.push({
        targetText: card.querySelector('.q-target').value.trim(),
        maxGuesses: clampGuesses(card.querySelector('.q-guesses-range').value),
        hints: card.querySelector('.q-hints').value.trim(),
        hintRevealAfterAttempt: parseInt(card.querySelector('.q-hint-count').value, 10) || 1,
        allowRabbitHead: card.querySelector('.q-rabbit').checked,
      });
    });
    return {
      authorNickname: $('authorNickname').value.trim(),
      authorMessage: $('authorMessage').value.trim(),
      shareKey: $('shareKey').value.trim(),
      questions,
    };
  }

  function fillFormFromPack(source) {
    const p = source.pack || source;
    if (!p || !Array.isArray(p.questions)) {
      throw new Error('JSON 格式无效，需包含 questions 数组');
    }
    $('authorNickname').value = p.authorNickname || '';
    $('authorMessage').value = p.authorMessage || '';
    const sk = p.shareKey || '';
    const md5 = source.md5 || p.md5 || '';
    $('shareKey').value = (sk && sk !== md5) ? sk : '';
    $('questionsContainer').innerHTML = '';
    questionSeq = 0;
    p.questions.forEach((q) => createQuestionCard(q));
    if (!p.questions.length) createQuestionCard();
    hasModified = true;
    setKeyCheckHint(null, '');
    if (window.SetQuestionOperators && window.SetQuestionOperators.isReady()) {
      window.SetQuestionOperators.validateAll($('questionsContainer'));
    }
  }

  function formatPackSummary(d) {
    if (d.legacy) {
      return '<strong>（旧版文本）</strong> ' + escapeHtml(d.text);
    }
    let html =
      '<strong>分享 Key：</strong><span class="mono">' + escapeHtml(d.shareKey) + '</span><br>' +
      '<strong>出题人：</strong>' + escapeHtml(d.authorNickname || '—') + '<br>' +
      '<strong>寄语：</strong>' + escapeHtml(d.authorMessage || '—') + '<br>' +
      '<strong>题目数：</strong>' + (d.questions ? d.questions.length : 0);
    return html;
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      alert('已复制到剪贴板');
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert('已复制到剪贴板');
    });
  }

  async function postJson(action, payload) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.status !== 'success') {
      let msg = data.message || '请求失败';
      if (data.hint) msg += '\n' + data.hint;
      throw new Error(msg);
    }
    return data;
  }

  async function getList() {
    const q = editMode ? '?action=list&edit=true' : '?action=list';
    const res = await fetch(API + q);
    const data = await res.json().catch(() => ({}));
    if (data.status !== 'success') throw new Error(data.message || '加载列表失败');
    return data.data;
  }

  function setKeyCheckHint(ok, message) {
    const el = $('keyCheckHint');
    el.className = 'key-check-hint ' + (ok === null ? 'muted' : (ok ? 'ok' : 'err'));
    el.textContent = message || '';
  }

  async function checkShareKey() {
    const key = $('shareKey').value.trim();
    console.log('checkShareKey', key);
    if (!key) {
      setKeyCheckHint(true, '分享 Key 为空则使用随机MD5码作为分享码');
      return;
    }
    const keyErr = validateCustomShareKey(key);
    if (keyErr) {
      setKeyCheckHint(false, keyErr);
      return;
    }
    $('btnCheckKey').disabled = true;
    setKeyCheckHint(null, '检测中…');
    try {
      const url = API + '?action=checkKey&key=' + encodeURIComponent(key);
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (data.status !== 'success') {
        console.log('检测失败');
        throw new Error(data.message || '检测失败');
      }
      const d = data.data;
      let msg = d.message || (d.available ? '可用' : '不可用');
      if (!d.available && d.occupiedBy && d.occupiedBy.authorNickname) {
        msg += '（占用者：' + d.occupiedBy.authorNickname + '）';
      }
      setKeyCheckHint(d.available, msg);
    } catch (e) {
      setKeyCheckHint(false, e.message);
    } finally {
      $('btnCheckKey').disabled = false;
    }
  }

  async function downloadFromServer() {
    const key = $('loadKey').value.trim();
    const el = $('opResult');
    if (!key) {
      showResult(el, false, '请输入要下载的 Key 或 MD5');
      return;
    }
    if (hasModified) {
      if (!confirm('当前信息已被修改，读取将覆盖现有内容，是否继续？')) {
        return;
      }
    }
    $('btnReadToEdit').disabled = true;
    try {
      const data = await postJson('lookup', { key });
      fillFormFromPack(data.data);
      hasModified = true;
      let html = '已从服务器载入 ' + (data.data.questions ? data.data.questions.length : 0) + ' 题';
      if (data.data.shareKey) {
        html += '<br><span class="mono">' + escapeHtml(data.data.shareKey) + '</span>';
      }
      showResult(el, true, html);
    } catch (e) {
      showResult(el, false, formatError(e.message));
    } finally {
      $('btnReadToEdit').disabled = false;
    }
  }

  async function loadAllRecords() {
    const box = $('listContainer');
    try {
      const data = await getList();
      if (!data.items.length) {
        box.innerHTML = '<p class="empty">暂无记录</p>';
        return;
      }
      const ipCol = editMode ? '<th>IP</th>' : '';
      let html = '<table><thead><tr><th>#</th><th>昵称</th><th>分享Key</th><th>MD5</th><th>题数</th>' + ipCol + '<th>时间</th></tr></thead><tbody>';
      data.items.forEach((row) => {
        const qCount = row.legacy ? '—' : (row.questions ? row.questions.length : 0);
        const ipCell = editMode
          ? '<td class="mono">' + escapeHtml(row.clientIp || '—') + '</td>'
          : '';
        html += '<tr><td>' + escapeHtml(String(row.id)) + '</td>' +
          '<td>' + escapeHtml(row.authorNickname || '') + '</td>' +
          '<td class="mono">' + escapeHtml(row.shareKey || '') + '</td>' +
          '<td class="mono">' + escapeHtml(row.md5 || '') + '</td>' +
          '<td>' + qCount + '</td>' + ipCell +
          '<td>' + escapeHtml(row.created_at || '') + '</td></tr>';
      });
      html += '</tbody></table>';
      html += '<p class="list-footnote">点击分享 Key 可快速载入（编辑模式）</p>';
      box.innerHTML = html;
      if (editMode) {
        box.querySelectorAll('tbody tr').forEach((tr, i) => {
          const row = data.items[i];
          if (!row || row.legacy || !tr.cells[2]) return;
          const keyCell = tr.cells[2];
          keyCell.classList.add('share-key-clickable');
          keyCell.title = '点击载入到编辑器';
          keyCell.addEventListener('click', () => {
            $('loadKey').value = row.shareKey || '';
            downloadFromServer();
          });
        });
      }
    } catch (e) {
      box.innerHTML = '<p class="empty" style="color:var(--error)">' + formatError(e.message) + '</p>';
    }
  }

  function bindEvents() {
    $('btnCheckKey').addEventListener('click', checkShareKey);
    $('shareKey').addEventListener('input', () => setKeyCheckHint(null, ''));
    $('btnAddQuestion').addEventListener('click', () => { hasModified = true; createQuestionCard(); });
    $('btnReadToEdit').addEventListener('click', downloadFromServer);

    $('btnSample').addEventListener('click', () => {
      if (hasModified) {
        if (!confirm('当前信息已被修改，填入示例将覆盖现有内容，是否继续？')) {
          return;
        }
      }
      $('authorNickname').value = '博士';
      $('authorMessage').value = '祝你今日猜题顺利！';
      $('shareKey').value = '';
      $('questionsContainer').innerHTML = '';
      questionSeq = 0;
      createQuestionCard({
        targetText: '能天使',
        maxGuesses: 8,
        hints: '六星干员',
        hintRevealAfterAttempt: 2,
        allowRabbitHead: true,
      });
      createQuestionCard({
        targetText: '银灰',
        maxGuesses: 6,
        hints: '谢拉格领袖',
        hintRevealAfterAttempt: 1,
        allowRabbitHead: false,
      });
      hasModified = true;
      showResult($('opResult'), true, '已填入示例');
    });

    $('btnCreate').addEventListener('click', async () => {
      const el = $('opResult');
      const keyErr = validateCustomShareKey($('shareKey').value.trim());
      if (keyErr) {
        showResult(el, false, formatError(keyErr));
        return;
      }
      try {
        ensureAllTargetsValid();
      } catch (e) {
        showResult(el, false, formatError(e.message));
        return;
      }
      $('btnCreate').disabled = true;
      try {
        const pack = collectPack();
        const data = await postJson('create', { pack });
        const d = data.data;
        const note = d.existed ? '（库中已存在相同内容）' : '';
        const summaryHtml = formatPackSummary(d) + note;
        
        const shareUrl = 'https://arkdle.milletea.top/?question=' + encodeURIComponent(d.shareKey);
        
        let html = summaryHtml + '<br><br>';
        html += '<div class="btn-group" style="margin-top:0.5rem">';
        html += '<button type="button" class="block" id="btnCopyFullInfo">复制完整分享信息</button>';
        html += '<button type="button" class="block secondary" id="btnCopyAddress">复制地址</button>';
        html += '</div>';
        html += '<div id="addressDisplay" class="mono" style="margin-top:0.5rem;word-break:break-all">' + escapeHtml(shareUrl) + '</div>';
        
        showResult(el, true, html);
        
        setTimeout(() => {
          const btnCopyFull = $('opResult').querySelector('#btnCopyFullInfo');
          const btnCopyAddr = $('opResult').querySelector('#btnCopyAddress');
          if (btnCopyFull) {
            btnCopyFull.addEventListener('click', () => {
              const fullInfo = '分享链接：' + shareUrl + '\n出题人：' + (d.authorNickname || '—') + '\n寄语：' + (d.authorMessage || '—') + '\n题目数：' + (d.questions ? d.questions.length : 0);
              copyToClipboard(fullInfo);
            });
          }
          if (btnCopyAddr) {
            btnCopyAddr.addEventListener('click', () => {
              copyToClipboard(shareUrl);
            });
          }
        }, 0);
        
        if (d.shareKey) $('loadKey').value = d.shareKey;
      } catch (e) {
        showResult(el, false, formatError(e.message));
      } finally {
        $('btnCreate').disabled = false;
        if (editMode) loadAllRecords();
      }
    });

    if (editMode) {
      $('btnRefreshList').addEventListener('click', loadAllRecords);
    }
  }

  async function init() {
    bindEvents();
    const opEl = $('opResult');
    try {
      await window.SetQuestionOperators.init();
    } catch (e) {
      showResult(opEl, false, formatError('干员数据加载失败：' + e.message));
    }
    createQuestionCard();
    if (editMode) {
      $('editBadge').classList.add('visible');
      $('editPanel').classList.add('visible');
      loadAllRecords();
    }
  }

  init();
})();
