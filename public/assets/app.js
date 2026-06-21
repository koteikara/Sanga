(function(){
  const key='sanga-schedule-button-states-v1';
  let storageAvailable=true;
  let states={};
  const filterKey='sanga-schedule-filter-settings-v1';
  const displayModeKey='sanga-schedule-display-mode-v1';
  const validDisplayModes=['card','compact'];
  const validFilters=['all','home','away','year-2026','year-2027','tentative','marked','state-1','state-2'];
  const filterLabels={
    all:'すべて',
    home:'HOME',
    away:'AWAY',
    'year-2026':'2026',
    'year-2027':'2027',
    tentative:'未確定',
    marked:'枠線あり',
    'state-1':'赤色枠',
    'state-2':'水色枠'
  };
  let activeFilter='all';

  function showStorageUnavailableMessage(){
    const message='LocalStorageを利用できないため、タップ状態は保存されません。表示中の見た目のみ切り替わります。';
    const liveNote=document.querySelector('.storage-clear-note');
    if(liveNote) liveNote.textContent=message;
  }

  function readStoredStates(){
    try{
      return JSON.parse(localStorage.getItem(key)||'{}') || {};
    }catch(e){
      storageAvailable=false;
      showStorageUnavailableMessage();
      return {};
    }
  }

  function writeStoredStates(){
    if(!storageAvailable) return false;
    try{
      localStorage.setItem(key,JSON.stringify(states));
      return true;
    }catch(e){
      storageAvailable=false;
      showStorageUnavailableMessage();
      return false;
    }
  }

  function readStorageValue(storageKey, fallback=''){
    if(!storageAvailable) return fallback;
    try{
      return localStorage.getItem(storageKey) || fallback;
    }catch(e){
      storageAvailable=false;
      showStorageUnavailableMessage();
      return fallback;
    }
  }

  function writeStorageValue(storageKey, value){
    if(!storageAvailable) return false;
    try{
      localStorage.setItem(storageKey, value);
      return true;
    }catch(e){
      storageAvailable=false;
      showStorageUnavailableMessage();
      return false;
    }
  }

  function removeStorageValue(storageKey){
    if(!storageAvailable) return false;
    try{
      localStorage.removeItem(storageKey);
      return true;
    }catch(e){
      storageAvailable=false;
      showStorageUnavailableMessage();
      return false;
    }
  }

  function normalizeMatchState(value){
    const state=Number(value || 0);
    return [0,1,2].includes(state) ? state : 0;
  }

  function applyMatchState(button, state){
    const normalized=normalizeMatchState(state);
    button.dataset.state=String(normalized);
    button.setAttribute('aria-pressed', normalized ? 'true' : 'false');
  }

  function escapeSelectorValue(value){
    if(window.CSS && typeof window.CSS.escape==='function') return CSS.escape(value);
    return String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"');
  }

  function syncMatchState(id, state){
    document.querySelectorAll(`.match[data-id="${escapeSelectorValue(id)}"]`).forEach(button=>{
      applyMatchState(button, state);
    });
  }

  function initializeMatchStates(root=document){
    root.querySelectorAll('.match[data-id]').forEach(button=>{
      applyMatchState(button, states[button.dataset.id]);
    });
  }

  states=readStoredStates();
  initializeMatchStates();

  document.addEventListener('click',(event)=>{
    const button=event.target.closest('.match[data-id]');
    if(!button) return;
    const id=button.dataset.id;
    const next=(normalizeMatchState(button.dataset.state)+1)%3;
    states[id]=next;
    syncMatchState(id, next);
    writeStoredStates();
    applyScheduleFilter();
  });
  const helpButton=document.querySelector('.help-button');
  const helpPanel=document.querySelector('.help-panel');
  const helpOverlay=document.querySelector('.help-overlay');
  const helpClose=document.querySelector('.help-close');
  const settingsButton=document.querySelector('.settings-button');
  const settingsPanel=document.querySelector('.settings-panel');
  const settingsClose=document.querySelector('.settings-close');
  const settingsTitle=document.querySelector('#settings-title');

  function shouldReduceMotion(){
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function canUseViewTransition(){
    return !shouldReduceMotion() && typeof document.startViewTransition === 'function';
  }

  function withViewTransition(update){
    if(!canUseViewTransition()){
      update();
      return null;
    }
    return document.startViewTransition(update);
  }

  function openHelp(){
    if(!helpPanel || !helpOverlay || !helpButton) return;
    closeSettings(false);
    helpOverlay.hidden=false;
    helpPanel.hidden=false;
    requestAnimationFrame(()=>helpPanel.classList.add('is-open'));
    helpButton.setAttribute('aria-expanded','true');
    helpClose && helpClose.focus();
  }

  function closeHelp(returnFocus=true){
    if(!helpPanel || !helpOverlay || !helpButton) return;
    helpPanel.classList.remove('is-open');
    helpButton.setAttribute('aria-expanded','false');
    window.setTimeout(()=>{
      helpPanel.hidden=true;
      if(!settingsPanel || settingsPanel.hidden) helpOverlay.hidden=true;
      if(returnFocus) helpButton.focus();
    }, 240);
  }

  function openSettings(){
    if(!settingsPanel || !helpOverlay || !settingsButton) return;
    closeHelp(false);
    helpOverlay.hidden=false;
    settingsPanel.hidden=false;
    const focusSettingsPanel=()=>{
      (settingsTitle || settingsClose || settingsPanel).focus();
    };
    if(canUseViewTransition()){
      withViewTransition(()=>{
        settingsPanel.classList.add('is-open');
        settingsButton.setAttribute('aria-expanded','true');
      });
      requestAnimationFrame(focusSettingsPanel);
      return;
    }
    requestAnimationFrame(()=>settingsPanel.classList.add('is-open'));
    settingsButton.setAttribute('aria-expanded','true');
    focusSettingsPanel();
  }

  function closeSettings(returnFocus=true){
    if(!settingsPanel || !helpOverlay || !settingsButton) return;
    if(canUseViewTransition()){
      withViewTransition(()=>{
        settingsPanel.classList.remove('is-open');
        settingsButton.setAttribute('aria-expanded','false');
        settingsPanel.hidden=true;
        if(!helpPanel || helpPanel.hidden) helpOverlay.hidden=true;
      });
      if(returnFocus) requestAnimationFrame(()=>settingsButton.focus());
      return;
    }
    settingsPanel.classList.remove('is-open');
    settingsButton.setAttribute('aria-expanded','false');
    window.setTimeout(()=>{
      settingsPanel.hidden=true;
      if(!helpPanel || helpPanel.hidden) helpOverlay.hidden=true;
      if(returnFocus) settingsButton.focus();
    }, shouldReduceMotion() ? 0 : 240);
  }

  helpButton && helpButton.addEventListener('click',openHelp);
  helpClose && helpClose.addEventListener('click',()=>closeHelp());
  settingsButton && settingsButton.addEventListener('click',openSettings);
  settingsClose && settingsClose.addEventListener('click',()=>closeSettings());
  helpOverlay && helpOverlay.addEventListener('click',()=>{
    if(helpPanel && !helpPanel.hidden) closeHelp(false);
    if(settingsPanel && !settingsPanel.hidden) closeSettings(false);
  });
  document.addEventListener('keydown',(e)=>{
    if(e.key !== 'Escape') return;
    if(settingsPanel && !settingsPanel.hidden) closeSettings();
    else if(helpPanel && !helpPanel.hidden) closeHelp();
  });

  // layout switcher: 1 / 2 / 3 / 4 columns
  const layoutKey='sanga-schedule-layout-v1';
  const phoneEl=document.querySelector('.phone');
  const layoutButtons=Array.from(document.querySelectorAll('.layout-option'));

  function setScheduleLayout(mode){
    const selected=['1','2','3','4'].includes(String(mode)) ? String(mode) : '2';
    if(phoneEl){
      phoneEl.classList.remove('layout-1','layout-3','layout-4');
      if(selected==='1') phoneEl.classList.add('layout-1');
      if(selected==='3') phoneEl.classList.add('layout-3');
      if(selected==='4') phoneEl.classList.add('layout-4');
    }
    layoutButtons.forEach(button=>{
      const active=button.dataset.layout===selected;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  setScheduleLayout(readStorageValue(layoutKey, '2'));

  layoutButtons.forEach(button=>{
    button.addEventListener('click',(event)=>{
      event.preventDefault();
      event.stopPropagation();
      const selected=button.dataset.layout || '2';
      writeStorageValue(layoutKey, selected);
      setScheduleLayout(selected);
    });
  });


  const jsonPreviewList=document.querySelector('[data-json-preview-list]');
  const displayModeButtons=Array.from(document.querySelectorAll('.display-mode-option'));
  let activeDisplayMode='card';

  function normalizeDisplayMode(value){
    return validDisplayModes.includes(String(value)) ? String(value) : 'card';
  }

  function readDisplayModeSettings(){
    const raw=readStorageValue(displayModeKey, '');
    if(!raw) return 'card';
    try{
      const parsed=JSON.parse(raw);
      return normalizeDisplayMode(parsed && parsed.mode);
    }catch(e){
      return 'card';
    }
  }

  function writeDisplayModeSettings(){
    writeStorageValue(displayModeKey, JSON.stringify({mode:activeDisplayMode}));
  }

  function applyDisplayMode(mode){
    activeDisplayMode=normalizeDisplayMode(mode);
    if(phoneEl){
      phoneEl.classList.remove('mode-card','mode-compact');
      phoneEl.classList.add(`mode-${activeDisplayMode}`);
    }
    if(jsonPreviewList){
      jsonPreviewList.classList.remove('display-mode-card','display-mode-compact');
      jsonPreviewList.classList.add(`display-mode-${activeDisplayMode}`);
    }
    displayModeButtons.forEach(button=>{
      const active=button.dataset.displayMode===activeDisplayMode;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  activeDisplayMode=readDisplayModeSettings();
  applyDisplayMode(activeDisplayMode);

  displayModeButtons.forEach(button=>{
    button.addEventListener('click',(event)=>{
      event.preventDefault();
      event.stopPropagation();
      applyDisplayMode(button.dataset.displayMode);
      writeDisplayModeSettings();
    });
  });

  const filterButtons=Array.from(document.querySelectorAll('.filter-option'));
  const filterResult=document.querySelector('.filter-result');
  const emptyFilterMessage=document.querySelector('.empty-filter-message');

  function normalizeFilter(value){
    return validFilters.includes(String(value)) ? String(value) : 'all';
  }

  function readFilterSettings(){
    const raw=readStorageValue(filterKey, '');
    if(!raw) return 'all';
    try{
      const parsed=JSON.parse(raw);
      return normalizeFilter(parsed && parsed.activeFilter);
    }catch(e){
      return 'all';
    }
  }

  function writeFilterSettings(){
    writeStorageValue(filterKey, JSON.stringify({activeFilter}));
  }

  function getCardState(card){
    if(!card || !card.dataset.id) return 0;
    return normalizeMatchState(states[card.dataset.id]);
  }

  function doesCardMatchFilter(card){
    if(!card) return false;
    const state=getCardState(card);
    switch(activeFilter){
      case 'home': return card.dataset.homeAway === 'H';
      case 'away': return card.dataset.homeAway === 'A';
      case 'year-2026': return card.dataset.year === '2026';
      case 'year-2027': return card.dataset.year === '2027';
      case 'tentative': return card.dataset.status === 'tentative' || card.dataset.hasCandidates === 'true';
      case 'marked': return state === 1 || state === 2;
      case 'state-1': return state === 1;
      case 'state-2': return state === 2;
      default: return true;
    }
  }

  function updateYearHeadingVisibility(){
    if(!jsonPreviewList) return;
    const children=Array.from(jsonPreviewList.children);
    children.forEach((child, index)=>{
      if(!child.classList.contains('json-preview-year')) return;
      let hasVisibleCard=false;
      for(let i=index+1;i<children.length;i+=1){
        const next=children[i];
        if(next.classList.contains('json-preview-year')) break;
        if(next.classList.contains('json-preview-match') && !next.hidden && next.matches(':not([hidden])')){
          hasVisibleCard=true;
          break;
        }
      }
      child.hidden=!hasVisibleCard;
    });
  }

  function updateFilterResult(count){
    if(filterResult){
      filterResult.textContent=count === 0
        ? '該当する試合はありません。'
        : `${activeFilter === 'all' ? '' : `${filterLabels[activeFilter]}：`}${count}件を表示しています。`;
    }
    if(emptyFilterMessage){
      emptyFilterMessage.hidden=count !== 0;
    }
  }

  function applyScheduleFilter(){
    const cards=Array.from(document.querySelectorAll('.json-preview-match'));
    let visibleCount=0;
    cards.forEach(card=>{
      const visible=doesCardMatchFilter(card);
      card.hidden=!visible;
      if(visible) visibleCount+=1;
    });
    updateYearHeadingVisibility();
    filterButtons.forEach(button=>{
      button.setAttribute('aria-pressed', button.dataset.filter === activeFilter ? 'true' : 'false');
    });
    updateFilterResult(visibleCount);
  }

  activeFilter=readFilterSettings();
  applyScheduleFilter();

  filterButtons.forEach(button=>{
    button.addEventListener('click',(event)=>{
      event.preventDefault();
      event.stopPropagation();
      activeFilter=normalizeFilter(button.dataset.filter);
      writeFilterSettings();
      applyScheduleFilter();
    });
  });

  const storageClearButton=document.querySelector('.storage-clear');
  const storageClearNote=document.querySelector('.storage-clear-note');

  storageClearButton && storageClearButton.addEventListener('click',()=>{
    removeStorageValue(key);
    removeStorageValue(layoutKey);
    removeStorageValue(filterKey);
    removeStorageValue(displayModeKey);
    states={};
    initializeMatchStates();
    setScheduleLayout('2');
    applyDisplayMode('card');
    activeFilter='all';
    applyScheduleFilter();
    if(storageClearNote){
      storageClearNote.textContent='このページの保存内容、表示列、表示モード、絞り込み条件を削除しました。';
    }
  });


  const weekdayLabels=['SUN','MON','TUE','WED','THU','FRI','SAT'];

  function formatDateParts(value){
    if(!value) return null;
    const date=new Date(`${value}T00:00:00+09:00`);
    if(Number.isNaN(date.getTime())) return null;
    return {
      main:`${date.getMonth()+1}.${date.getDate()}`,
      weekday:weekdayLabels[date.getDay()],
      weekdayClass:date.getDay()===0 ? 'sun' : date.getDay()===6 ? 'sat' : ''
    };
  }

  function createHaLabel(label){
    const ha=document.createElement('span');
    ha.className='ha';
    ha.setAttribute('aria-hidden','true');
    label.split('').forEach(letter=>{
      const span=document.createElement('span');
      span.textContent=letter;
      ha.append(span);
    });
    return ha;
  }

  function applyCompactDateClass(main, parts){
    if(parts && parts.main.length >= 5){
      main.classList.add('compact-date');
    }
  }

  function createDateContent(match){
    const date=document.createElement('span');
    date.className='date';
    const candidates=Array.isArray(match.date_candidates) ? match.date_candidates : [];
    const dateValues=match.match_date ? [match.match_date] : candidates;
    if(match.status==='tentative' || candidates.length){
      date.classList.add('tentative-date');
    }
    if(dateValues.length > 1){
      const range=document.createElement('span');
      range.className='range';
      dateValues.forEach(value=>{
        const parts=formatDateParts(value);
        if(!parts) return;
        const item=document.createElement('span');
        const main=document.createElement('b');
        main.className='main';
        main.textContent=parts.main;
        applyCompactDateClass(main, parts);
        const sub=document.createElement('i');
        sub.className=parts.weekdayClass ? `sub ${parts.weekdayClass}` : 'sub';
        sub.textContent=parts.weekday;
        item.append(main, sub);
        range.append(item);
      });
      if(range.children.length){
        date.append(range);
        return date;
      }
    }
    const parts=formatDateParts(dateValues[0]);
    const main=document.createElement('b');
    main.className='main';
    main.textContent=parts ? parts.main : '未定';
    applyCompactDateClass(main, parts);
    date.append(main);
    if(parts){
      const sub=document.createElement('i');
      sub.className=parts.weekdayClass ? `sub ${parts.weekdayClass}` : 'sub';
      sub.textContent=parts.weekday;
      date.append(sub);
    }else{
      main.classList.add('small');
    }
    return date;
  }

  function getMatchDateYear(match){
    if(match.match_date){
      return match.match_date.slice(0, 4);
    }
    if(Array.isArray(match.date_candidates) && match.date_candidates.length > 0){
      return match.date_candidates[0].slice(0, 4);
    }
    const roundNumber=String(match.round || '').match(/\d+/);
    if(roundNumber){
      return Number(roundNumber[0]) <= 20 ? '2026' : '2027';
    }
    return '';
  }

  function createYearHeading(year){
    const heading=document.createElement('div');
    heading.className='year json-preview-year';
    heading.dataset.year=year;
    const label=document.createElement('span');
    label.textContent=year;
    heading.append(label);
    return heading;
  }

  function createJsonPreviewItems(matches){
    const items=[];
    let currentYear='';
    matches.forEach(match=>{
      const year=getMatchDateYear(match);
      if(year && year !== currentYear){
        items.push(createYearHeading(year));
        currentYear=year;
      }
      items.push(createJsonMatchCard(match));
    });
    return items;
  }

  function createJsonMatchCard(match){
    const homeAway=match.home_away==='H' ? 'home' : 'away';
    const haText=match.home_away==='H' ? 'HOME' : 'AWAY';
    const button=document.createElement('button');
    button.type='button';
    button.className=`match json-preview-match ${homeAway} logo-${match.opponent_code || 'unknown'}`;
    button.dataset.id=match.id || '';
    button.dataset.jsonId=match.id || '';
    button.dataset.homeAway=match.home_away || '';
    button.dataset.year=getMatchDateYear(match);
    button.dataset.status=match.status || '';
    button.dataset.hasCandidates=Array.isArray(match.date_candidates) && match.date_candidates.length > 0 ? 'true' : 'false';
    applyMatchState(button, states[button.dataset.id]);
    button.setAttribute('aria-label',`${match.round || '節未定'} ${match.home_away_label || haText} ${match.opponent || '対戦相手未定'} ${match.venue || '会場未定'} 日程カード`);

    const inner=document.createElement('span');
    inner.className='match-inner';

    const meta=document.createElement('span');
    meta.className='meta';
    const sec=document.createElement('span');
    sec.className='sec';
    sec.textContent=match.round || '節未定';
    const team=document.createElement('span');
    team.className='team';
    team.textContent=match.opponent || '対戦相手未定';
    const place=document.createElement('span');
    place.className='place';
    place.textContent=match.venue || '会場未定';
    meta.append(sec, team, place);

    inner.append(createHaLabel(haText), meta, createDateContent(match));
    button.append(inner);
    if(match.note){
      const note=document.createElement('span');
      note.className='note';
      note.textContent=match.note.split(':')[0] || '※';
      note.title=match.note;
      note.setAttribute('aria-label', match.note);
      button.append(note);
    }
    return button;
  }

  async function fetchJsonPreviewData(){
    const dataPath='data/matches.json?v=20260619-1';
    const response=await fetch(dataPath);
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    return {data, dataPath};
  }

  async function renderJsonPreview(){
    if(!jsonPreviewList) return;
    try{
      const {data, dataPath}=await fetchJsonPreviewData();
      const matches=Array.isArray(data.matches) ? data.matches : [];
      jsonPreviewList.replaceChildren(...createJsonPreviewItems(matches));
      initializeMatchStates(jsonPreviewList);
      applyScheduleFilter();
    }catch(error){
      jsonPreviewList.replaceChildren();
      console.warn('JSON schedule rendering failed:', error);
    }
  }

  renderJsonPreview();

})();
