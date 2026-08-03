(() => {
  const quiz = document.getElementById('energyQuiz');
  if (!quiz) return;

  const axisKeys = ['stability', 'abundance', 'action', 'harmony', 'protection', 'focus'];
  const axisLabels = {
    stability: '心神安定',
    abundance: '豐盛安全',
    action: '行動推進',
    harmony: '關係和合',
    protection: '環境防護',
    focus: '願力聚焦'
  };

  const questions = [
    {
      question: '最近一個月，哪一種狀態最容易消耗你？',
      options: [
        { label: '心緒散亂、睡前仍停不下來', key: 'spirit', boost: [20, 2, 1, 4, 15, 8] },
        { label: '常擔心金錢、資源或生活不夠穩定', key: 'wealth', boost: [3, 20, 5, 1, 9, 4] },
        { label: '知道要做什麼，卻遲遲無法推進', key: 'career', boost: [4, 3, 20, 1, 3, 16] },
        { label: '人際或感情互動讓我反覆內耗', key: 'love', boost: [7, 1, 2, 20, 5, 4] }
      ]
    },
    {
      question: '此刻，你最希望增加哪一種力量？',
      options: [
        { label: '清明、安定，以及不受外界牽動的中心', key: 'spirit', boost: [19, 1, 2, 3, 12, 13] },
        { label: '豐盛、踏實，以及承接資源的能力', key: 'wealth', boost: [4, 19, 7, 1, 8, 5] },
        { label: '方向、決斷，以及持續完成事情的動能', key: 'career', boost: [5, 4, 19, 1, 3, 17] },
        { label: '理解、信任，以及關係中的柔軟與界線', key: 'love', boost: [8, 1, 3, 19, 4, 5] }
      ]
    },
    {
      question: '面對壓力時，你最常出現哪一種反應？',
      options: [
        { label: '感受變得敏銳，容易受空間與他人情緒影響', key: 'spirit', boost: [17, 1, 2, 5, 19, 7] },
        { label: '立刻縮減支出，腦中反覆計算是否足夠', key: 'wealth', boost: [4, 19, 4, 1, 10, 5] },
        { label: '拖延、猶豫，原本的節奏被打亂', key: 'career', boost: [6, 3, 19, 1, 4, 15] },
        { label: '過度在意別人的反應，很難回到自己', key: 'love', boost: [9, 1, 2, 18, 7, 4] }
      ]
    },
    {
      question: '目前最想改善的生活領域是哪一個？',
      options: [
        { label: '靜心、睡眠、修持與內在穩定', key: 'spirit', boost: [20, 1, 2, 3, 14, 12] },
        { label: '收入、金錢流動與生活安全感', key: 'wealth', boost: [3, 20, 6, 1, 7, 5] },
        { label: '工作、志業、計畫與執行效率', key: 'career', boost: [4, 4, 20, 1, 3, 17] },
        { label: '感情、家人、人際與善緣互動', key: 'love', boost: [7, 1, 3, 20, 4, 5] }
      ]
    },
    {
      question: '當你終於有空休息時，最難放下的是什麼？',
      options: [
        { label: '腦中的聲音與對環境的警覺', key: 'spirit', boost: [18, 1, 2, 4, 18, 9] },
        { label: '對未來支出與資源不足的擔心', key: 'wealth', boost: [5, 19, 4, 1, 9, 5] },
        { label: '尚未完成的工作，以及落後進度的不安', key: 'career', boost: [5, 4, 18, 1, 3, 18] },
        { label: '某個人的態度、訊息或一句話', key: 'love', boost: [8, 1, 2, 19, 5, 5] }
      ]
    },
    {
      question: '你最想為接下來的生活祈願什麼？',
      options: [
        { label: '心神安住，在變動之中仍保持清明', key: 'spirit', boost: [20, 2, 2, 3, 14, 13] },
        { label: '財務順流，生活更加寬裕與踏實', key: 'wealth', boost: [4, 20, 7, 1, 7, 6] },
        { label: '志業突破，所想能逐步化為所行', key: 'career', boost: [5, 4, 20, 1, 3, 18] },
        { label: '善緣和合，關係得到理解與修復', key: 'love', boost: [8, 1, 3, 20, 4, 5] }
      ]
    }
  ];

  const results = {
    spirit: {
      energy: '清明與安定',
      name: '元神光彩御守',
      lead: '你此刻最需要的，是先讓內在重新安住。',
      copy: '你的能量輪廓顯示，心神安定與環境防護的需求較為突出。這款御守的祈願方向，是提醒自己穩住念頭、守護元神，在變動之中保持清明。',
      target: 'product-spirit'
    },
    wealth: {
      energy: '豐盛與安全感',
      name: '財富滿堂御守',
      lead: '你此刻最需要的，是重新建立對資源的信任。',
      copy: '你的能量輪廓顯示，豐盛安全與生活承接力需要更多支持。這款御守的祈願方向，是讓財氣與心念穩定流轉，減少匱乏感帶來的緊縮。',
      target: 'product-wealth'
    },
    career: {
      energy: '方向與行動',
      name: '事業成就御守',
      lead: '你此刻最需要的，是讓力量重新回到行動。',
      copy: '你的能量輪廓顯示，行動推進與願力聚焦的需求最為明顯。這款御守的祈願方向，是護持志業、決策與持續推進，讓所想逐步化為所行。',
      target: 'product-career'
    },
    love: {
      energy: '善緣與和合',
      name: '感情緣滿御守',
      lead: '你此刻最需要的，是在關係中找回柔軟與界線。',
      copy: '你的能量輪廓顯示，關係和合與內在安定需要被共同照顧。這款御守的祈願方向，是祈願善緣和合，也提醒自己在理解別人的同時，不失去內在中心。',
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
    if (radarShape) radarShape.setAttribute('points', center);
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

    nextButton.textContent = questionIndex === questions.length - 1 ? '生成能量圖' : '下一題';
  }

  function calculateRadarValues() {
    const values = axisKeys.map(key => Math.min(96, Math.round(axisScores[key])));
    return values;
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
    const values = calculateRadarValues();
    animateRadar(values);
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
    document.getElementById('resultEnergy').textContent = `此刻需要｜${result.energy}`;
    document.getElementById('resultName').textContent = result.name;
    document.getElementById('resultLead').textContent = result.lead;
    document.getElementById('resultCopy').textContent = result.copy;

    const target = document.getElementById(result.target);
    const productSvg = target?.querySelector('.product-visual svg');
    resultVisual.innerHTML = '';
    if (productSvg) {
      const clone = productSvg.cloneNode(true);
      clone.removeAttribute('role');
      clone.removeAttribute('aria-label');
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
      axisScores[key] += selectedOption.boost[index] / questions.length;
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
