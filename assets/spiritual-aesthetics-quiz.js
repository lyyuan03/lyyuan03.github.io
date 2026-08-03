(() => {
  const quiz = document.getElementById('energyQuiz');
  if (!quiz) return;

  const questions = [
    {
      question: '最近一個月，哪一種狀態最常消耗你？',
      options: [
        ['心緒容易散亂，很難回到安定', 'spirit'],
        ['常擔心金錢、資源或生活安全感', 'wealth'],
        ['有目標，卻遲遲無法推進', 'career'],
        ['人際或感情互動讓我反覆內耗', 'love']
      ]
    },
    {
      question: '此刻，你最希望增加哪一種力量？',
      options: [
        ['清明、安定與內在中心', 'spirit'],
        ['豐盛、穩定與承接資源的能力', 'wealth'],
        ['方向、決斷與持續行動', 'career'],
        ['理解、信任與關係中的柔軟', 'love']
      ]
    },
    {
      question: '面對壓力時，你最常出現什麼反應？',
      options: [
        ['想很多、睡不安穩，容易受環境影響', 'spirit'],
        ['害怕不夠用，難以放鬆享受當下', 'wealth'],
        ['拖延或猶豫，做事容易失去節奏', 'career'],
        ['過度在意他人的反應，難以做自己', 'love']
      ]
    },
    {
      question: '你最想為接下來的生活祈願什麼？',
      options: [
        ['找回穩定的心與清楚的感受', 'spirit'],
        ['財務流動順暢，生活更加踏實', 'wealth'],
        ['工作與志業突破，所行有所成', 'career'],
        ['善緣和合，關係得到理解與修復', 'love']
      ]
    }
  ];

  const results = {
    spirit: {
      energy: '清明與安定',
      name: '元神光彩御守',
      lead: '你此刻最需要的，是先讓內在重新安住。',
      copy: '近期的耗損較像來自心緒分散、環境影響與精神疲憊。這款御守所代表的祈願方向，是提醒自己穩住念頭、守護元神，在變動之中保持清明。',
      target: 'product-spirit'
    },
    wealth: {
      energy: '豐盛與安全感',
      name: '財富滿堂御守',
      lead: '你此刻最需要的，是重新建立對資源的信任。',
      copy: '近期的壓力較集中在金錢、生活安全感與「是否足夠」的焦慮。這款御守所代表的祈願方向，是讓財氣與心念都能穩定流轉，減少匱乏感帶來的緊縮。',
      target: 'product-wealth'
    },
    career: {
      energy: '方向與行動',
      name: '事業成就御守',
      lead: '你此刻最需要的，是讓力量重新回到行動。',
      copy: '你並非沒有目標，而是容易停在猶豫、拖延或節奏失衡之中。這款御守所代表的祈願方向，是護持志業、決策與持續推進，讓所想逐步化為所行。',
      target: 'product-career'
    },
    love: {
      energy: '善緣與和合',
      name: '感情緣滿御守',
      lead: '你此刻最需要的，是在關係中找回柔軟與界線。',
      copy: '近期的耗損較多來自人際、情感與他人反應。這款御守所代表的祈願方向，是祈願善緣和合，也提醒自己在理解別人的同時，不失去內在的安定。',
      target: 'product-love'
    }
  };

  const panels = [...quiz.querySelectorAll('.quiz-panel')];
  const startButton = document.getElementById('quizStart');
  const nextButton = document.getElementById('quizNext');
  const restartButton = document.getElementById('quizRestart');
  const resultButton = document.getElementById('resultProduct');
  const questionText = document.getElementById('quizQuestion');
  const optionsBox = document.getElementById('quizOptions');
  const stepText = document.getElementById('quizStep');
  const progress = document.getElementById('quizProgress');
  const filters = [...document.querySelectorAll('.filter-btn')];
  const productCards = [...document.querySelectorAll('.product-card')];

  let questionIndex = 0;
  let selectedKey = null;
  let finalKey = 'spirit';
  let scores = { spirit: 0, wealth: 0, career: 0, love: 0 };

  function showPanel(name) {
    panels.forEach(panel => panel.classList.toggle('active', panel.dataset.panel === name));
  }

  function resetQuiz() {
    questionIndex = 0;
    selectedKey = null;
    finalKey = 'spirit';
    scores = { spirit: 0, wealth: 0, career: 0, love: 0 };
    productCards.forEach(card => card.classList.remove('recommended'));
    showPanel('start');
  }

  function renderQuestion() {
    selectedKey = null;
    nextButton.disabled = true;
    stepText.textContent = `第 ${questionIndex + 1} 題`;
    progress.style.width = `${((questionIndex + 1) / questions.length) * 100}%`;
    questionText.textContent = questions[questionIndex].question;
    optionsBox.innerHTML = '';

    questions[questionIndex].options.forEach(([label, key]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quiz-option';
      button.textContent = label;
      button.addEventListener('click', () => {
        selectedKey = key;
        optionsBox.querySelectorAll('.quiz-option').forEach(item => item.classList.remove('selected'));
        button.classList.add('selected');
        nextButton.disabled = false;
      });
      optionsBox.appendChild(button);
    });

    nextButton.textContent = questionIndex === questions.length - 1 ? '查看結果' : '下一題';
  }

  function showResult() {
    const order = ['spirit', 'wealth', 'career', 'love'];
    finalKey = order.reduce((best, key) => scores[key] > scores[best] ? key : best, order[0]);
    const result = results[finalKey];
    document.getElementById('resultEnergy').textContent = `此刻需要｜${result.energy}`;
    document.getElementById('resultName').textContent = result.name;
    document.getElementById('resultLead').textContent = result.lead;
    document.getElementById('resultCopy').textContent = result.copy;
    showPanel('result');
  }

  startButton.addEventListener('click', () => {
    showPanel('question');
    renderQuestion();
  });

  nextButton.addEventListener('click', () => {
    if (!selectedKey) return;
    scores[selectedKey] += 1;
    if (questionIndex < questions.length - 1) {
      questionIndex += 1;
      renderQuestion();
    } else {
      showResult();
    }
  });

  restartButton.addEventListener('click', resetQuiz);

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
