(() => {
  const quiz = document.getElementById('energyQuiz');
  if (!quiz) return;

  const axisKeys = ['stability', 'abundance', 'action', 'harmony', 'protection', 'focus'];
  const axisLabels = {
    stability: '元神安定',
    abundance: '福祿承接',
    action: '願行開展',
    harmony: '因緣和合',
    protection: '護身結界',
    focus: '天命願力'
  };

  const questions = [
    {
      question: '最近一個月，你感覺哪一處運勢最容易受阻？',
      options: [
        { label: '心神不寧，容易受外境與他人情緒牽動', key: 'spirit', boost: [20, 2, 1, 4, 15, 8] },
        { label: '對金錢、資源與生活安定常有不足感', key: 'wealth', boost: [3, 20, 5, 1, 9, 4] },
        { label: '心中有願有志，行動卻反覆停滯', key: 'career', boost: [4, 3, 20, 1, 3, 16] },
        { label: '感情、人際或家庭因緣讓我反覆心耗', key: 'love', boost: [7, 1, 2, 20, 5, 4] }
      ]
    },
    {
      question: '若能請一份神明護持，此刻最希望加強哪一方面？',
      options: [
        { label: '元神清明、心念安定，不再受外界牽動', key: 'spirit', boost: [19, 1, 2, 3, 12, 13] },
        { label: '福祿充足、財氣順流，生活更加踏實', key: 'wealth', boost: [4, 19, 7, 1, 8, 5] },
        { label: '志業有路、行動有力，把心願逐步完成', key: 'career', boost: [5, 4, 19, 1, 3, 17] },
        { label: '善緣和合、關係清明，彼此多一分理解', key: 'love', boost: [8, 1, 3, 19, 4, 5] }
      ]
    },
    {
      question: '當運勢低迷或事情不順時，你最常出現哪一種反應？',
      options: [
        { label: '感受格外敏銳，容易受到空間與他人氣場影響', key: 'spirit', boost: [17, 1, 2, 5, 19, 7] },
        { label: '開始擔心財務，反覆盤算未來是否足夠', key: 'wealth', boost: [4, 19, 4, 1, 10, 5] },
        { label: '猶豫、拖延，原本想做的事失去節奏', key: 'career', boost: [6, 3, 19, 1, 4, 15] },
        { label: '過度在意他人的回應，很難回到自己的心', key: 'love', boost: [9, 1, 2, 18, 7, 4] }
      ]
    },
    {
      question: '此刻生命中，你最想轉動哪一部分的氣運？',
      options: [
        { label: '靜心、睡眠、修持與元神安定', key: 'spirit', boost: [20, 1, 2, 3, 14, 12] },
        { label: '收入、財氣、福祿與生活安穩', key: 'wealth', boost: [3, 20, 6, 1, 7, 5] },
        { label: '工作、志業、機會與行動突破', key: 'career', boost: [4, 4, 20, 1, 3, 17] },
        { label: '感情、家人、人際與善緣圓滿', key: 'love', boost: [7, 1, 3, 20, 4, 5] }
      ]
    },
    {
      question: '最近，你的內在最常出現哪一種訊號？',
      options: [
        { label: '心浮、夢多，總覺得精神沒有真正安住', key: 'spirit', boost: [18, 1, 2, 4, 18, 9] },
        { label: '對未來支出與資源不足有揮之不去的擔心', key: 'wealth', boost: [5, 19, 4, 1, 9, 5] },
        { label: '知道時機正在靠近，卻還沒有跨出關鍵一步', key: 'career', boost: [5, 4, 18, 1, 3, 18] },
        { label: '某段關係、某個人或一句話一直停留在心裡', key: 'love', boost: [8, 1, 2, 19, 5, 5] }
      ]
    },
    {
      question: '接下來，你最想向神明祈願什麼？',
      options: [
        { label: '願元神安住，在變動之中仍保持清明', key: 'spirit', boost: [20, 2, 2, 3, 14, 13] },
        { label: '願福祿增長，財務順流，生活安穩無虞', key: 'wealth', boost: [4, 20, 7, 1, 7, 6] },
        { label: '願志業開展，貴人相助，所行有所成', key: 'career', boost: [5, 4, 20, 1, 3, 18] },
        { label: '願善緣和合，關係得到理解、修復與圓滿', key: 'love', boost: [8, 1, 3, 20, 4, 5] }
      ]
    }
  ];

  const results = {
    spirit: {
      energy: '元神安定・靈光護持',
      name: '元神光彩御守',
      lead: '你的靈運正在提醒你：先安元神，才能定住命運的方向。',
      copy: '此刻的氣運並非沒有力量，而是元神較容易受外境擾動。心念一散，福運、感應與判斷也難以聚集。元神光彩御守所承載的祈願，是護持元神清明、收攝散亂之氣，使你在變動與雜訊之中，仍能守住自身的靈光與正念。',
      target: 'product-spirit'
    },
    wealth: {
      energy: '福祿承接・財氣聚合',
      name: '財富滿堂御守',
      lead: '你的靈運正在提醒你：財運要進來，內在先要有承接福祿的位置。',
      copy: '目前並非單純缺少財運，而是安全感與承接資源的氣場較弱，容易因憂慮而讓財氣停滯。財富滿堂御守的祈願方向，是聚福納財、穩定心念，護持正財、機緣與生活資源循序流入。',
      target: 'product-wealth'
    },
    career: {
      energy: '天命願行・志業開展',
      name: '事業成就御守',
      lead: '你的靈運正在提醒你：命運已走到需要把願力化為行動的階段。',
      copy: '你並非沒有方向，而是願力與行動尚未完全合一。事業成就御守的祈願，是護持志業、決斷與機緣，讓你在該前進時不再遲疑，使所願有所行、所行有所成。',
      target: 'product-career'
    },
    love: {
      energy: '因緣和合・善緣護持',
      name: '感情緣滿御守',
      lead: '你的靈運正在提醒你：這段時間最重要的功課，是整理因緣，也守住自己的心。',
      copy: '近期的氣運較容易被感情、人際或家庭因緣牽動。感情緣滿御守的祈願，是調和善緣、減少誤解與糾結，同時護持你在關係中保有界線與清明，讓適合的緣分得以靠近。',
      target: 'product-love'
    }
  };

  const panels = [...quiz.querySelectorAll('.quiz-panel')];
  const resultStages = [...quiz.querySelectorAll('.result-stage')];
  const startButton = document.getElementById('quizStart');
  const nextButton = document.getElementById('quizNext');
  const revealButton = document.getElementById('quizReveal');
  const restartButtons = [...quiz.querySelectorAll('[data-quiz-restart]')];
  const chartBackButton = document.getElementById('resultChartBack');
  const resultButton = document.getElementById('resultProduct');
  const questionText = document.getElementById('quizQuestion');
  const optionsBox = document.getElementById('quizOptions');
  const stepText = document.getElementById('quizStep');
  const progress = document.getElementById('quizProgress');
  const beads = [...quiz.querySelectorAll('.quiz-beads i')];
  const radarShape = document.getElementById('radarShape');
  const radarPoints = [...quiz.querySelectorAll('.radar-point')];
  const axisSummary = document.getElementById('axisSummary');
  const resultVisual = document.getElementById('resultVisual');
  const filters = [...document.querySelectorAll('.filter-btn')];
  const productCards = [...document.querySelectorAll('.product-card')];

  let questionIndex = 0;
  let selectedOption = null;
  let finalKey = 'spirit';
  let productScores = { spirit: 0, wealth: 0, career: 0, love: 0 };
  let axisScores = { stability: 18, abundance: 18, action: 18, harmony: 18, protection: 18, focus: 18 };

  const radarVertices = [
    [160, 45],
    [259.6, 102.5],
    [259.6, 217.5],
    [160, 275],
    [60.4, 217.5],
    [60.4, 102.5]
  ];

  function showPanel(name) {
    panels.forEach(panel => panel.classList.toggle('active', panel.dataset.panel === name));
  }

  function showResultStage(name) {
    resultStages.forEach(stage => stage.classList.toggle('active', stage.dataset.resultStage === name));
  }

  function resetRadar() {
    const center = '160,160 160,160 160,160 160,160 160,160 160,160';
    radarShape?.setAttribute('points', center);
    radarPoints.forEach(point => {
      point.setAttribute('cx', '160');
      point.setAttribute('cy', '160');
    });
    if (axisSummary) axisSummary.innerHTML = '';
  }

  function resetQuiz() {
    questionIndex = 0;
    selectedOption = null;
    finalKey = 'spirit';
    productScores = { spirit: 0, wealth: 0, career: 0, love: 0 };
    axisScores = { stability: 18, abundance: 18, action: 18, harmony: 18, protection: 18, focus: 18 };
    productCards.forEach(card => card.classList.remove('recommended'));
    revealButton?.classList.remove('ready');
    if (revealButton) revealButton.disabled = true;
    if (resultVisual) resultVisual.innerHTML = '';
    resetRadar();
    showResultStage('radar');
    showPanel('start');
  }

  function addRipple(button, event) {
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.className = 'option-ripple';
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
    button.appendChild(ripple);
    window.setTimeout(() => ripple.remove(), 650);
  }

  function renderQuestion() {
    selectedOption = null;
    nextButton.disabled = true;
    stepText.textContent = `第 ${questionIndex + 1} 題`;
    progress.style.width = `${((questionIndex + 1) / questions.length) * 100}%`;
    beads.forEach((bead, index) => bead.classList.toggle('on', index <= questionIndex));
    questionText.textContent = questions[questionIndex].question;
    optionsBox.innerHTML = '';

    questions[questionIndex].options.forEach((option, optionIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quiz-option';
      button.dataset.mark = String.fromCharCode(65 + optionIndex);
      button.textContent = option.label;
      button.addEventListener('click', event => {
        selectedOption = option;
        optionsBox.querySelectorAll('.quiz-option').forEach(item => item.classList.remove('selected'));
        button.classList.add('selected');
        addRipple(button, event);
        nextButton.disabled = false;
      });
      optionsBox.appendChild(button);
    });

    nextButton.textContent = questionIndex === questions.length - 1 ? '生成靈運圖' : '下一題';
  }

  function calculateRadarValues() {
    const rawValues = axisKeys.map(key => axisScores[key]);
    const minValue = Math.min(...rawValues);
    const maxValue = Math.max(...rawValues);
    if (maxValue === minValue) return rawValues.map(() => 62);
    return rawValues.map(value => Math.round(34 + ((value - minValue) / (maxValue - minValue)) * 62));
  }

  function radarPoint(vertex, value) {
    const ratio = Math.max(0.18, value / 100);
    return [
      160 + (vertex[0] - 160) * ratio,
      160 + (vertex[1] - 160) * ratio
    ];
  }

  function animateRadar(values) {
    resetRadar();
    const points = values.map((value, index) => radarPoint(radarVertices[index], value));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        radarShape?.setAttribute('points', points.map(point => point.join(',')).join(' '));
        radarPoints.forEach((point, index) => {
          point.setAttribute('cx', points[index][0].toFixed(1));
          point.setAttribute('cy', points[index][1].toFixed(1));
        });
      });
    });

    const ranked = axisKeys
      .map((key, index) => ({ key, value: values[index] }))
      .sort((a, b) => b.value - a.value);

    axisSummary.innerHTML = axisKeys.map(key => {
      const item = ranked.find(axis => axis.key === key);
      const strong = ranked.slice(0, 2).some(axis => axis.key === key) ? ' strong' : '';
      return `<span class="axis-pill${strong}">${axisLabels[key]} ${item.value}</span>`;
    }).join('');
  }

  function resolveFinalKey() {
    const order = ['spirit', 'wealth', 'career', 'love'];
    return order.reduce((best, key) => productScores[key] > productScores[best] ? key : best, order[0]);
  }

  function showRadarResult() {
    finalKey = resolveFinalKey();
    showPanel('result');
    showResultStage('radar');
    animateRadar(calculateRadarValues());
    revealButton.classList.remove('ready');
    revealButton.disabled = true;
    window.setTimeout(() => {
      revealButton.disabled = false;
      revealButton.classList.add('ready');
    }, 1150);
  }

  function createSparks(container) {
    container.querySelectorAll('.result-spark').forEach(item => item.remove());
    for (let index = 0; index < 12; index += 1) {
      const spark = document.createElement('i');
      const angle = (Math.PI * 2 * index) / 12 + Math.random() * 0.18;
      const distance = 72 + Math.random() * 42;
      spark.className = 'result-spark';
      spark.style.left = '50%';
      spark.style.top = '50%';
      spark.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
      spark.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
      spark.style.animationDelay = `${Math.random() * 0.28}s`;
      container.appendChild(spark);
    }
  }

  function revealOmamori() {
    const result = results[finalKey];
    document.getElementById('resultEnergy').textContent = `此刻靈運｜${result.energy}`;
    document.getElementById('resultName').textContent = result.name;
    document.getElementById('resultLead').textContent = result.lead;
    document.getElementById('resultCopy').textContent = result.copy;

    const target = document.getElementById(result.target);
    const productVisual = target?.querySelector('.product-visual img.product-photo, .product-visual img, .product-visual svg');
    resultVisual.innerHTML = '';
    if (productVisual) {
      const clone = productVisual.cloneNode(true);
      clone.removeAttribute('role');
      clone.removeAttribute('aria-label');
      if (clone.tagName === 'IMG') {
        clone.classList.add('product-photo');
        clone.loading = 'eager';
      }
      resultVisual.appendChild(clone);
    } else {
      resultVisual.textContent = result.name;
    }

    showResultStage('omamori');
    const visualWrap = quiz.querySelector('.result-visual-wrap');
    if (visualWrap) createSparks(visualWrap);
  }

  startButton.addEventListener('click', () => {
    showPanel('question');
    renderQuestion();
  });

  nextButton.addEventListener('click', () => {
    if (!selectedOption) return;
    productScores[selectedOption.key] += 1;
    axisKeys.forEach((key, index) => {
      axisScores[key] += selectedOption.boost[index];
    });

    if (questionIndex < questions.length - 1) {
      questionIndex += 1;
      renderQuestion();
    } else {
      showRadarResult();
    }
  });

  revealButton.addEventListener('click', revealOmamori);
  restartButtons.forEach(button => button.addEventListener('click', resetQuiz));
  chartBackButton?.addEventListener('click', () => showResultStage('radar'));

  resultButton.addEventListener('click', () => {
    filters.forEach(button => button.classList.toggle('active', button.dataset.filter === 'all'));
    productCards.forEach(card => {
      card.classList.remove('hidden', 'recommended');
      card.style.transform = '';
    });
    const target = document.getElementById(results[finalKey].target);
    if (!target) return;
    target.classList.add('recommended');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => target.classList.remove('recommended'), 7000);
  });
})();