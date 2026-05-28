(function () {
    'use strict';

    var QUIZ_API_BASE = (function () {
        try {
            return new URL('/SetQuestion/api.php', window.location.origin).toString();
        } catch (e) {
            return '/SetQuestion/api.php';
        }
    })();

    var _pack = null;
    var _questionIndex = 0;
    var _overlayEl = null;
    var _hintBarEl = null;
    var _questionKey = null;
    var GLOBAL_INIT_PROMISE_KEY = '__arkdle_question_mode_init_promise__';
    var _initPromise = window[GLOBAL_INIT_PROMISE_KEY] || null;

    function getQuestionParam() {
        var params = new URLSearchParams(window.location.search);
        return params.get('question') || params.get('tiquestion') || '';
    }

    function escHtml(s) {
        var d = document.createElement('div');
        d.textContent = s == null ? '' : String(s);
        return d.innerHTML;
    }

    function applyQuestionTheme() {
        document.body.classList.remove('topic-mode-random');
        document.body.classList.add('topic-mode-question');
        document.documentElement.style.setProperty('--ark-theme-t', '0');
    }

    function buildOverlay() {
        var existing = document.getElementById('arkdle-question-overlay');
        if (existing) {
            _overlayEl = existing;
            return;
        }

        var el = document.createElement('div');
        el.className = 'arkdle-question-overlay';
        el.id = 'arkdle-question-overlay';
        el.setAttribute('hidden', '');
        el.innerHTML =
            '<div class="arkdle-question-overlay__backdrop"></div>' +
            '<div class="arkdle-question-overlay__panel">' +
            '<div class="arkdle-question-overlay__avatar">🎯</div>' +
            '<div class="arkdle-question-overlay__badge">粥友出题</div>' +
            '<p class="arkdle-question-overlay__nickname" id="aqo-nickname"></p>' +
            '<p class="arkdle-question-overlay__message" id="aqo-message"></p>' +
            '<hr class="arkdle-question-overlay__divider">' +
            '<p class="arkdle-question-overlay__topic-label">第 <span id="aqo-q-index">1</span> 题 / 共 <span id="aqo-q-total">1</span> 题</p>' +
            '<p class="arkdle-question-overlay__topic" id="aqo-q-title">猜猜这位干员是谁？</p>' +
            '<button type="button" class="arkdle-question-overlay__btn" id="aqo-start-btn">开始答题</button>' +
            '<p class="arkdle-question-overlay__progress" id="aqo-progress-hint"></p>' +
            '</div>';
        document.body.appendChild(el);
        _overlayEl = el;
    }

    function buildHintBar() {
        var existing = document.getElementById('arkdle-question-hint-bar');
        if (existing) {
            _hintBarEl = existing;
            return;
        }

        var bar = document.createElement('div');
        bar.className = 'arkdle-question-hint-bar';
        bar.id = 'arkdle-question-hint-bar';
        var inputSection = document.querySelector('.input-section');
        if (inputSection && inputSection.parentNode) {
            inputSection.parentNode.insertBefore(bar, inputSection);
        } else {
            var container = document.querySelector('.container');
            if (container) container.insertBefore(bar, container.firstChild);
        }
        _hintBarEl = bar;
    }

    function showOverlay(questionIdx, isFirst) {
        if (!_overlayEl || !_pack) return;

        var q = _pack.questions[questionIdx];
        var total = _pack.questions.length;

        document.getElementById('aqo-nickname').textContent = _pack.authorNickname || '匿名粥友';
        document.getElementById('aqo-message').textContent = _pack.authorMessage || '祝你答题顺利！';
        document.getElementById('aqo-q-index').textContent = String(questionIdx + 1);
        document.getElementById('aqo-q-total').textContent = String(total);

        var titleEl = document.getElementById('aqo-q-title');
        if (q && q.hints && (Array.isArray(q.hints) ? q.hints.length > 0 : String(q.hints).trim() !== '')) {
            titleEl.textContent = '猜猜这位干员是谁？';
        } else {
            titleEl.textContent = '猜猜这位干员是谁？';
        }

        var progressEl = document.getElementById('aqo-progress-hint');
        if (questionIdx > 0) {
            progressEl.textContent = '已完成 ' + questionIdx + ' / ' + total + ' 题';
        } else {
            progressEl.textContent = '';
        }

        var startBtn = document.getElementById('aqo-start-btn');
        startBtn.textContent = isFirst ? '开始答题' : '开始第 ' + (questionIdx + 1) + ' 题';

        _overlayEl.removeAttribute('hidden');

        var panel = _overlayEl.querySelector('.arkdle-question-overlay__panel');
        if (panel) {
            panel.style.animation = 'none';
            void panel.offsetWidth;
            panel.style.animation = '';
        }
    }

    function hideOverlay() {
        if (_overlayEl) _overlayEl.setAttribute('hidden', '');
    }

    function showCompletionOverlay() {
        if (!_overlayEl) return;

        var total = _pack.questions.length;
        document.getElementById('aqo-nickname').textContent = _pack.authorNickname || '匿名粥友';
        document.getElementById('aqo-message').textContent = '你已完成全部 ' + total + ' 道题目，太棒了！';
        document.getElementById('aqo-q-index').textContent = String(total);
        document.getElementById('aqo-q-total').textContent = String(total);
        document.getElementById('aqo-q-title').textContent = '🎉 完成题目！';

        var progressEl = document.getElementById('aqo-progress-hint');
        progressEl.textContent = '全部 ' + total + ' 题已完成';

        var startBtn = document.getElementById('aqo-start-btn');
        startBtn.textContent = '再来一遍';
        startBtn.onclick = function () {
            hideOverlay();
            startQuestion(0);
        };

        _overlayEl.removeAttribute('hidden');

        var panel = _overlayEl.querySelector('.arkdle-question-overlay__panel');
        if (panel) {
            panel.style.animation = 'none';
            void panel.offsetWidth;
            panel.style.animation = '';
        }
    }

    function resetGameForQuestion(q) {
        if (typeof window.hideArkdleDailyScreenshotShareButton === 'function') {
            window.hideArkdleDailyScreenshotShareButton();
        }

        var guessingItems = document.getElementById('guessing-items');
        if (guessingItems) guessingItems.innerHTML = '';

        var inputName = document.getElementById('input-name');
        if (inputName) {
            inputName.value = '';
            inputName.disabled = false;
        }

        var btnConfirm = document.getElementById('btn-confirm');
        if (btnConfirm) btnConfirm.disabled = false;

        var btnRandom = document.getElementById('btn-random-select');
        if (btnRandom) btnRandom.disabled = false;

        var btnShowAnswer = document.getElementById('btn-show-answer');
        if (btnShowAnswer) btnShowAnswer.hidden = true;

        var btnRandomTopic = document.getElementById('btn-random-topic');
        if (btnRandomTopic) {
            btnRandomTopic.classList.remove('btn-question-mode-next');
            btnRandomTopic.hidden = true;
        }

        window.isOver = false;
        window.remainingAttempts = q.maxGuesses != null ? q.maxGuesses : 8;
        window.attemptsExhaustedAlertShown = false;

        var attemptsDisplay = document.getElementById('attempts');
        if (attemptsDisplay) {
            var span = attemptsDisplay.querySelector('span');
            if (span) span.textContent = '0';
        }

        if (_hintBarEl) {
            _hintBarEl.textContent = '';
            _hintBarEl.classList.remove('visible');
        }

        window.nowGuessing = null;
        window.beforeGuessing = [];
        window.arkdleGuessCacheMode = 'question';

        if (typeof window.saveLocalCache === 'function') {
            window.saveLocalCache();
        }
    }

    function applyQuestionTarget(q) {
        var name = q.targetText || '';
        if (typeof window.searchOperatorByName === 'function') {
            window.targetData = window.searchOperatorByName(name);
        }

        var topicSource = document.getElementById('topic-source');
        if (topicSource) {
            topicSource.textContent = '粥友出题 · 第 ' + (_questionIndex + 1) + ' / ' + _pack.questions.length + ' 题';
            topicSource.style.color = '';
            topicSource.style.fontWeight = '';
        }

        var editinfo = document.getElementById('editinfo');
        if (editinfo) {
            editinfo.textContent = '出题人：' + (_pack.authorNickname || '匿名粥友');
        }

        var btnRabbit = document.getElementById('btn-rabbit-mode');
        if (btnRabbit) {
            if (q.allowRabbitHead === false) {
                if (typeof window.setRabbitModeOn === 'function') window.setRabbitModeOn(false);
            }
        }

        if (_hintBarEl) {
            var hintText = '';
            if (Array.isArray(q.hints) && q.hints.length > 0) {
                hintText = q.hints[0];
            } else if (typeof q.hints === 'string' && q.hints.trim() !== '') {
                hintText = q.hints.trim();
            }
            if (hintText && q.hintRevealAfterAttempt != null) {
                _hintBarEl.dataset.hintText = hintText;
                _hintBarEl.dataset.hintReveal = String(q.hintRevealAfterAttempt);
                _hintBarEl.textContent = '';
                _hintBarEl.classList.remove('visible');
            } else {
                _hintBarEl.dataset.hintText = '';
                _hintBarEl.dataset.hintReveal = '0';
                _hintBarEl.classList.remove('visible');
            }
        }
    }

    function patchShowAttemptsExhaustedAlert() {
        var origAlert = window.showAttemptsExhaustedAlertOnce;
        if (!origAlert || origAlert.__arkdleQuestionModePatched === true) return;

        window.showAttemptsExhaustedAlertOnce = function () {
            if (window.arkdleGuessCacheMode !== 'question') {
                return origAlert.apply(this, arguments);
            }
            if (window.attemptsExhaustedAlertShown) return;
            window.attemptsExhaustedAlertShown = true;
        };
        window.showAttemptsExhaustedAlertOnce.__arkdleQuestionModePatched = true;
    }

    function patchUpdateGuessedAttemptsDisplay() {
        var origUpdate = window.updateGuessedAttemptsDisplay;
        if (!origUpdate || origUpdate.__arkdleQuestionModePatched === true) return;

        window.updateGuessedAttemptsDisplay = function () {
            if (window.arkdleGuessCacheMode !== 'question') {
                return origUpdate.apply(this, arguments);
            }
            var q = _pack && _pack.questions && _pack.questions[_questionIndex];
            var maxGuesses = (q && q.maxGuesses != null) ? q.maxGuesses : 8;
            var attDisp = document.getElementById('attempts');
            if (attDisp) {
                var span = attDisp.querySelector('span');
                if (span) span.textContent = String(maxGuesses - window.remainingAttempts);
            }
        };
        window.updateGuessedAttemptsDisplay.__arkdleQuestionModePatched = true;
    }

    function patchProcessGuessForQuestion() {
        var origProcessGuess = window.processGuess;
        if (!origProcessGuess) return;
        if (origProcessGuess.__arkdleQuestionModePatched === true) return;

        window.processGuess = function (inputValue) {
            if (window.arkdleGuessCacheMode !== 'question') {
                return origProcessGuess.apply(this, arguments);
            }

            var inputName = document.getElementById('input-name');
            var rawInput = (inputValue == null)
                ? (inputName ? inputName.value.trim() : '')
                : (inputName ? inputName.value.trim() : '');

            var getData = typeof window.searchOperatorByName === 'function'
                ? window.searchOperatorByName(rawInput)
                : null;

            if (!getData) {
                return origProcessGuess.apply(this, arguments);
            }

            var wasOver = !!window.isOver;

            origProcessGuess.apply(this, arguments);

            if (wasOver) return;

            var guessedCount = Array.isArray(window.beforeGuessing) ? window.beforeGuessing.length : 0;

            if (_hintBarEl && _hintBarEl.dataset.hintText) {
                var revealAt = parseInt(_hintBarEl.dataset.hintReveal, 10) || 1;
                if (guessedCount >= revealAt && !_hintBarEl.classList.contains('visible')) {
                    _hintBarEl.textContent = '💡 提示：' + _hintBarEl.dataset.hintText;
                    _hintBarEl.classList.add('visible');
                }
            }

            if (window.isOver) {
                var nextIndex = _questionIndex + 1;
                var btnRandomTopic = document.getElementById('btn-random-topic');

                if (nextIndex >= _pack.questions.length) {
                    if (btnRandomTopic) {
                        btnRandomTopic.hidden = false;
                        btnRandomTopic.classList.add('btn-question-mode-next');
                        btnRandomTopic.textContent = '完成题目！';
                        btnRandomTopic.onclick = function () {
                            btnRandomTopic.onclick = null;
                            showCompletionOverlay();
                        };
                    }
                } else {
                    if (btnRandomTopic) {
                        btnRandomTopic.hidden = false;
                        btnRandomTopic.classList.add('btn-question-mode-next');
                        btnRandomTopic.textContent = '进入下一题';
                        btnRandomTopic.onclick = function () {
                            btnRandomTopic.onclick = null;
                            startQuestion(nextIndex);
                        };
                    }
                }
            }
        };
        window.processGuess.__arkdleQuestionModePatched = true;
    }

    function startQuestion(idx) {
        _questionIndex = idx;
        var q = _pack.questions[idx];

        resetGameForQuestion(q);
        applyQuestionTarget(q);

        var inputName = document.getElementById('input-name');
        if (inputName) inputName.focus();

        if (typeof window.syncRabbitModeGrid === 'function') {
            window.syncRabbitModeGrid();
        }
    }

    function bindOverlayStart() {
        var startBtn = document.getElementById('aqo-start-btn');
        if (!startBtn) return;
        if (startBtn.dataset.bound === '1') return;
        startBtn.dataset.bound = '1';
        startBtn.addEventListener('click', function () {
            hideOverlay();
            startQuestion(_questionIndex);
        });
    }

    async function fetchQuizPack(key) {
        var url = QUIZ_API_BASE;
        console.log('[粥友出题] 请求 URL:', url, 'key=', key);
        try {
            var res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'lookup', key: key }),
            });
            console.log('[粥友出题] 响应状态:', res.status, res.statusText);
            var rawText = await res.text();
            var data = null;
            try {
                data = JSON.parse(rawText);
            } catch (parseErr) {
                console.error('[粥友出题] JSON 解析失败，响应前 200 字符:', rawText.slice(0, 200));
                throw new Error('题包加载失败：接口返回非 JSON（可能路径不对或 404/500）');
            }
            console.log('[粥友出题] 响应数据:', JSON.stringify(data));
            if (!data || data.status !== 'success') {
                throw new Error((data && data.message ? data.message : '题包加载失败（服务器返回失败）') + ' [HTTP ' + res.status + ']');
            }
            if (data.data && data.data.legacy) {
                throw new Error('该 Key 为旧版文本记录，无法用于粥友出题');
            }
            return data.data;
        } catch (err) {
            console.error('[粥友出题] 请求失败:', err.message);
            throw new Error(err.message || '题包加载失败（网络错误）');
        }
    }

    function showLoadError(msg) {
        console.error('[粥友出题] 加载失败:', msg);
        var topicSource = document.getElementById('topic-source');
        if (topicSource) {
            topicSource.textContent = '粥友出题加载失败：' + msg;
            topicSource.style.color = 'red';
            topicSource.style.fontWeight = 'bold';
        }
        if (_overlayEl) {
            var panel = _overlayEl.querySelector('.arkdle-question-overlay__panel');
            if (panel) {
                panel.innerHTML = '<p style="color:#dc2626;padding:20px;">❌ 加载失败</p><p style="font-size:0.85rem;color:#666;margin:8px 0;">' + escHtml(msg) + '</p>';
            }
        }
    }

    async function initQuestionMode() {
        if (_initPromise) return _initPromise;

        var key = getQuestionParam();
        if (!key) return;
        _questionKey = key;

        _initPromise = (async function () {
            applyQuestionTheme();

            var btnRandomTopic = document.getElementById('btn-random-topic');
            if (btnRandomTopic) btnRandomTopic.hidden = true;

            var topicSource = document.getElementById('topic-source');
            if (topicSource) {
                topicSource.textContent = '粥友出题 · 加载中…';
                topicSource.style.color = '';
                topicSource.style.fontWeight = '';
            }

            buildOverlay();
            buildHintBar();
            bindOverlayStart();

            try {
                _pack = await fetchQuizPack(_questionKey);
            } catch (e) {
                showLoadError(e.message);
                if (_overlayEl) _overlayEl.setAttribute('hidden', '');
                return;
            }

            if (!_pack || !Array.isArray(_pack.questions) || _pack.questions.length === 0) {
                showLoadError('题包为空或格式无效');
                if (_overlayEl) _overlayEl.setAttribute('hidden', '');
                return;
            }

            _questionIndex = 0;
            showOverlay(0, true);

            patchShowAttemptsExhaustedAlert();
            patchUpdateGuessedAttemptsDisplay();
            patchProcessGuessForQuestion();
        })();
        window[GLOBAL_INIT_PROMISE_KEY] = _initPromise;

        return _initPromise;
    }

    window.arkdleQuestionMode = {
        init: initQuestionMode,
        isActive: function () { return !!_questionKey && !!_pack; },
    };
})();
