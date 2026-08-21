(() => {
  if (document.documentElement.dataset.aestheticsCopyPolished === 'true') return;
  document.documentElement.dataset.aestheticsCopyPolished = 'true';

  const assignText = (element, text) => {
    if (element && element.textContent !== text) element.textContent = text;
  };
  const setText = (selector, text) => assignText(document.querySelector(selector), text);

  function installFullVideoNavigation() {
    const videoItem = [...document.querySelectorAll('.nav-links > li')].find(item => {
      const trigger = item.querySelector(':scope > .has-dropdown');
      return trigger?.textContent.replace('▾', '').trim() === '影像';
    });
    const menu = videoItem?.querySelector(':scope > .dropdown');
    if (!menu) return;

    menu.classList.add('video-dropdown-full');
    menu.innerHTML = `
      <li class="nav-group-label"><span>靈元院官方</span></li>
      <li><a href="https://www.youtube.com/@lyyuan03" target="_blank" rel="noopener noreferrer">YT ｜ 靈元院</a></li>
      <li class="nav-group-label"><span>宇色老師</span></li>
      <li><a href="https://www.youtube.com/KINKIOSEL" target="_blank" rel="noopener noreferrer">YT ｜ 宇色心養生</a></li>
      <li><a href="https://open.spotify.com/show/1DFFziubhLI9VqnpoPfidf" target="_blank" rel="noopener noreferrer">Podcast ｜ 宇色人間書影</a></li>
      <li><a href="https://podcasts.apple.com/podcast/%E5%AE%87%E8%89%B2%E5%BF%83%E9%A4%8A%E7%94%9F/id1556418378" target="_blank" rel="noopener noreferrer">Podcast ｜ 宇色心養生</a></li>`;

    if (!document.getElementById('aesthetics-video-nav-style')) {
      const style = document.createElement('style');
      style.id = 'aesthetics-video-nav-style';
      style.textContent = `
        .dropdown.video-dropdown-full{min-width:268px;padding:8px 0}
        .dropdown.video-dropdown-full .nav-group-label{padding:10px 20px 5px;border-top:1px solid rgba(165,130,84,.16);pointer-events:none}
        .dropdown.video-dropdown-full .nav-group-label:first-child{padding-top:8px;border-top:0}
        .dropdown.video-dropdown-full .nav-group-label span{display:block;color:rgba(165,130,84,.82);font-family:var(--sans);font-size:10px;letter-spacing:.16em;white-space:nowrap}
        .dropdown.video-dropdown-full .nav-group-label+li a{padding-top:7px}
        .dropdown.video-dropdown-full a{white-space:nowrap}
      `;
      document.head.appendChild(style);
    }
  }

  function setProductCopy(key, badge, description, cta) {
    const card = document.querySelector(`[data-product="${key}"]`);
    if (!card) return;
    assignText(card.querySelector('.badge'), badge);
    assignText(card.querySelector('.product-desc'), description);
    assignText(card.querySelector('.product-cta span'), cta);
  }

  function applyStaticCopy() {
    const meta = document.querySelector('meta[name="description"]');
    const metaCopy = '靈元院靈性美學館，收錄祈願御守與鎮煞護安香粉，讓虔敬、守護與日常修持安住於生活之中。';
    if (meta && meta.content !== metaCopy) meta.content = metaCopy;

    const heroLead = document.querySelector('.hero-copy .hero-lead');
    const heroLeadCopy = '讓祈願有所依止，<br>讓守護安住於日常。';
    if (heroLead && heroLead.innerHTML !== heroLeadCopy) heroLead.innerHTML = heroLeadCopy;
    setText('.hero-copy .hero-desc', '靈性美學館收錄靈元院祈願御守與護安香品。每一件選物皆以虔敬之心承載願念，提醒我們在日常起心動念之間，守住正念、善念與行願之心。');
    setText('.hero-actions .primary-btn', '瀏覽祈願選物');
    setText('.hero-actions .ghost-btn', '前往綠界選購');

    setText('.intro .section-head h2', '一念虔誠，讓守護回到日常');
    assignText(document.querySelector('.intro .section-head p:not(.section-en)'), '靈性美學館所選之物，並非單純裝飾，而是承接祈願、提醒修持的日常助緣。願每一次看見、佩戴與使用，都能讓人收攝心念，記得自己所發的願，也記得以正念行於人間。');

    const promiseCopy = [
      ['一念祈願', '每一款御守皆承載不同的祈願方向，提醒佩戴者守心、正念，並以實際行動回應自己的願。'],
      ['靈運六象觀照', '從元神、福祿、願行、因緣、護身與天命六個面向，觀照近期狀態，作為選擇御守的祈願參考。'],
      ['敬慎安奉', '御守與護安香品是修持與祈願的助緣，請以恭敬心請回、安放與使用，讓守護落實於日常起心動念。']
    ];
    [...document.querySelectorAll('.promise')].slice(0, 3).forEach((item, index) => {
      assignText(item.querySelector('b'), promiseCopy[index][0]);
      assignText(item.querySelector('span'), promiseCopy[index][1]);
    });

    setText('.products .section-head h2', '靈元院祈願選物');
    assignText(document.querySelector('.products .section-head p:not(.section-en)'), '收錄四款祈願御守與鎮煞護安香粉。請先閱讀各品項的祈願方向，再依此刻所願與實際需要選擇；點選商品即可前往綠界選購。');
    setText('.filter-btn[data-filter="incense"]', '護安香品');

    setProductCopy('spirit', '元神光明', '祈願元神清明、心念安定，在修持、環境轉換與人生起伏之中，不失本心。', '查看御守與選購');
    setProductCopy('wealth', '福祿財運', '祈願福祿具足、正財順行，提醒自己以正念、勤勉與穩健之心承接豐盛。', '查看御守與選購');
    setProductCopy('career', '志業開展', '祈願志業開展、貴人助緣，護持判斷、行動與願心相應，所行有所成。', '查看御守與選購');
    setProductCopy('love', '善緣和合', '祈願善緣和合、情分圓滿，在人際與情感之中保有理解、珍惜與分寸。', '查看御守與選購');
    setProductCopy('incense', '家宅護安', '供日常淨香、家宅護安與祈福之用。請依靈元院說明敬慎使用；一般與會員方案以綠界表單為準。', '查看香品套組與選購');

    assignText(document.querySelector('.note-box'), '御守與香品皆為祈願與日常修持之助緣，並非取代個人的判斷、行動與責任。商品價格、會員方案、庫存、使用方式與出貨規範，請以綠界表單當下內容為準。');

    setText('.experience .vertical-title', '以一念祈願，請回日常守護');
    const stepCopy = [
      ['靜心觀照', '先讓心安定下來，觀照此刻最需要護持的面向，也確認自己願意為這份祈願付出什麼行動。'],
      ['選擇護持', '閱讀各款御守與護安香品的用途，選定相應品項後，前往綠界完成數量、方案與訂購資料。'],
      ['敬慎安奉', '請回之後，以恭敬心佩戴、安放或使用；讓它成為守心、正念與持續行願的日常提醒。']
    ];
    [...document.querySelectorAll('.experience .step')].slice(0, 3).forEach((step, index) => {
      assignText(step.querySelector('h3'), stepCopy[index][0]);
      assignText(step.querySelector('p'), stepCopy[index][1]);
    });

    setText('.quiz-kicker', 'LING YUAN · PRAYER · OMAMORI');
    setText('.energy-quiz .quiz-title', '此刻，你的靈運最需要哪一種護持？');
    setText('.energy-quiz .quiz-sub', '透過六個生命面向，靜心觀照元神、福祿、願行、因緣、護身與天命的近況，作為選擇御守的祈願參考。');
    setText('.radar-heading', '你的靈運六象與願力輪廓');
    setText('.radar-copy', '圖形越向外延伸，表示該面向此刻越需要收心、行願與守護。');
    setText('#quizReveal', '查看相應的祈願御守');
    setText('#resultProduct', '前往查看此款御守');
    setText('.quiz-disclaimer', '本測驗為靈性自我觀照與祈願選物參考，不作為神諭、問事、命理定論、醫療或心理診斷。祈願仍須配合自身正念、行動與責任。');
    document.querySelectorAll('.radar-label').forEach(label => {
      if (label.textContent.trim() === '護身結界') label.textContent = '護身守正';
    });
  }

  const textMap = new Map([
    ['最近一個月，你感覺哪一處運勢最容易受阻？', '最近一個月，你最希望哪一處運勢得到護持？'],
    ['心神不寧，容易受外境與他人情緒牽動', '心神容易浮動，常受外境與他人情緒牽引'],
    ['對金錢、資源與生活安定常有不足感', '對財務、資源與生活安穩較缺乏踏實感'],
    ['心中有願有志，行動卻反覆停滯', '心中有願，卻遲遲難以聚力前行'],
    ['感情、人際或家庭因緣讓我反覆心耗', '感情、人際或家庭因緣反覆牽動心緒'],
    ['若能請一份神明護持，此刻最希望加強哪一方面？', '若向堂上眾仙佛虔心祈願，此刻最希望獲得哪一方面的護持？'],
    ['元神清明、心念安定，不再受外界牽動', '元神清明、心念安定，在變動中不失本心'],
    ['福祿充足、財氣順流，生活更加踏實', '福祿具足、正財順行，生活更加安穩'],
    ['志業有路、行動有力，把心願逐步完成', '志業有路、願行合一，把心願逐步完成'],
    ['當運勢低迷或事情不順時，你最常出現哪一種反應？', '當事情不順、心念不定時，你最常落入哪一種狀態？'],
    ['感受格外敏銳，容易受到空間與他人氣場影響', '感受格外敏銳，容易受環境氛圍與他人情緒影響'],
    ['此刻生命中，你最想轉動哪一部分的氣運？', '此刻，你最希望哪一部分的命運重新轉動？'],
    ['最近，你的內在最常出現哪一種訊號？', '最近，內在最常浮現哪一種提醒？'],
    ['心浮、夢多，總覺得精神沒有真正安住', '心浮、夢多，精神始終沒有真正安住'],
    ['知道時機正在靠近，卻還沒有跨出關鍵一步', '知道時機正在靠近，卻尚未跨出關鍵一步'],
    ['某段關係、某個人或一句話一直停留在心裡', '某段關係、某個人或一句話仍停留在心裡'],
    ['接下來，你最想向神明祈願什麼？', '完成觀照後，你最想向堂上眾仙佛發下哪一個願？'],
    ['願福祿增長，財務順流，生活安穩無虞', '願福祿增長，正財順行，生活安穩無虞'],
    ['願志業開展，貴人相助，所行有所成', '願志業開展，貴人助緣，所行有所成'],
    ['元神安定・靈光護持', '元神安定・守正清明'],
    ['福祿承接・財氣聚合', '福祿承接・正財順行'],
    ['天命願行・志業開展', '願行合一・志業開展'],
    ['你的靈運正在提醒你：先安元神，才能定住命運的方向。', '此刻先安元神、定心念，命運的方向才會逐漸清楚。'],
    ['你的靈運正在提醒你：財運要進來，內在先要有承接福祿的位置。', '此刻需要的，不只是一份財運，更是承接福祿的安定與分寸。'],
    ['你的靈運正在提醒你：命運已走到需要把願力化為行動的階段。', '心中的願已經成形，接下來要讓願力與行動合一。'],
    ['你的靈運正在提醒你：這段時間最重要的功課，是整理因緣，也守住自己的心。', '此刻的功課，是整理因緣，也在關係中守住自己的心。'],
    ['此刻的氣運並非沒有力量，而是元神較容易受外境擾動。心念一散，福運、感應與判斷也難以聚集。元神光彩御守所承載的祈願，是護持元神清明、收攝散亂之氣，使你在變動與雜訊之中，仍能守住自身的靈光與正念。', '六象結果顯示，近期較需要護持的是元神安定與護身守正。當心念散亂，判斷、感應與行動也容易失去準心。元神光彩御守所承載的願，是提醒自己收攝心神、守住正念，在環境變動與修持過程中，不失本心與靈光。'],
    ['目前並非單純缺少財運，而是安全感與承接資源的氣場較弱，容易因憂慮而讓財氣停滯。財富滿堂御守的祈願方向，是聚福納財、穩定心念，護持正財、機緣與生活資源循序流入。', '六象結果顯示，近期較需要護持的是福祿承接與生活安穩。財富滿堂御守所承載的願，是祈求正財順行、福祿具足，也提醒自己以正念、勤勉與穩健的選擇承接資源，讓豐盛有可安住之處。'],
    ['你並非沒有方向，而是願力與行動尚未完全合一。事業成就御守的祈願，是護持志業、決斷與機緣，讓你在該前進時不再遲疑，使所願有所行、所行有所成。', '六象結果顯示，近期較需要護持的是願行開展與天命願力。事業成就御守所承載的願，是祈求志業有路、貴人助緣、判斷清楚，也提醒自己在該前進時勇於承擔，使所願有所行、所行有所成。'],
    ['近期的氣運較容易被感情、人際或家庭因緣牽動。感情緣滿御守的祈願，是調和善緣、減少誤解與糾結，同時護持你在關係中保有界線與清明，讓適合的緣分得以靠近。', '六象結果顯示，近期較需要護持的是因緣和合與元神安定。感情緣滿御守所承載的願，是祈求善緣靠近、誤解消融、情分圓滿，也提醒自己在關係中保有理解、珍惜與分寸。']
  ]);

  function patchGeneratedQuizCopy() {
    document.querySelectorAll('#quizQuestion,.quiz-option,#resultEnergy,#resultLead,#resultCopy,.axis-pill,.radar-label').forEach(element => {
      let value = element.textContent.trim();
      textMap.forEach((replacement, original) => {
        if (value === original) value = replacement;
        else if (value.includes(original)) value = value.replace(original, replacement);
      });
      value = value.replace('護身結界', '護身守正');
      assignText(element, value);
    });
  }

  function installInvocation() {
    const startPanel = document.querySelector('#energyQuiz [data-panel="start"]');
    const startButton = document.getElementById('quizStart');
    if (!startPanel || !startButton || startPanel.querySelector('.quiz-invocation')) return;
    const invocation = document.createElement('div');
    invocation.className = 'quiz-invocation';
    invocation.innerHTML = `
      <p>請專心合掌，收攝心念，恭念</p>
      <strong>「無極瑤池金母大天尊」</strong>
      <span>三稱</span>
      <p>祈請靈元院堂上眾仙佛指點迷津。</p>`;
    startPanel.insertBefore(invocation, startButton);
    assignText(startPanel.querySelector('.quiz-notice'), '念誦完成後，請依照最近一個月最常出現的狀態作答。');
  }

  function refreshCopy() {
    installFullVideoNavigation();
    applyStaticCopy();
    installInvocation();
    patchGeneratedQuizCopy();
  }

  refreshCopy();
  document.addEventListener('click', event => {
    if (!event.target.closest('#energyQuiz')) return;
    window.setTimeout(refreshCopy, 0);
    window.setTimeout(refreshCopy, 1200);
  });

  if (!document.querySelector('script[data-result-interaction-loader]')) {
    const interaction = document.createElement('script');
    interaction.src = 'assets/spiritual-aesthetics-result-interaction.js?v=1';
    interaction.async = false;
    interaction.dataset.resultInteractionLoader = 'true';
    document.body.appendChild(interaction);
  }
})();