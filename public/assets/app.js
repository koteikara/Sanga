import { domToPng } from 'https://esm.sh/modern-screenshot@4.6.5';

// =========================================================
// Imports and initialization
// =========================================================

(function(){
  // =========================================================
  // LocalStorage keys and state
  // =========================================================

  const CARD_STATE_STORAGE_KEY='sanga-schedule-button-states-v1';
  let isStorageAvailable=true;
  let states={};
  const FILTER_SETTINGS_STORAGE_KEY='sanga-schedule-filter-settings-v1';
  const DISPLAY_MODE_STORAGE_KEY='sanga-schedule-display-mode-v1';
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

  // =========================================================
  // LocalStorage helpers
  // =========================================================

  function showStorageUnavailableMessage(){
    const message='LocalStorageを利用できないため、タップ状態は保存されません。表示中の見た目のみ切り替わります。';
    const liveNote=document.querySelector('.storage-clear-note');
    if(liveNote) liveNote.textContent=message;
  }

  function readStoredStates(){
    try{
      return JSON.parse(localStorage.getItem(CARD_STATE_STORAGE_KEY)||'{}') || {};
    }catch(e){
      isStorageAvailable=false;
      showStorageUnavailableMessage();
      return {};
    }
  }

  function writeStoredStates(){
    if(!isStorageAvailable) return false;
    try{
      localStorage.setItem(CARD_STATE_STORAGE_KEY,JSON.stringify(states));
      return true;
    }catch(e){
      isStorageAvailable=false;
      showStorageUnavailableMessage();
      return false;
    }
  }

  function readStorageValue(storageKey, fallback=''){
    if(!isStorageAvailable) return fallback;
    try{
      return localStorage.getItem(storageKey) || fallback;
    }catch(e){
      isStorageAvailable=false;
      showStorageUnavailableMessage();
      return fallback;
    }
  }

  function writeStorageValue(storageKey, value){
    if(!isStorageAvailable) return false;
    try{
      localStorage.setItem(storageKey, value);
      return true;
    }catch(e){
      isStorageAvailable=false;
      showStorageUnavailableMessage();
      return false;
    }
  }

  function removeStorageValue(storageKey){
    if(!isStorageAvailable) return false;
    try{
      localStorage.removeItem(storageKey);
      return true;
    }catch(e){
      isStorageAvailable=false;
      showStorageUnavailableMessage();
      return false;
    }
  }

  // =========================================================
  // Match card state handling
  // =========================================================

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

  // =========================================================
  // Help dialog, settings panel, and share image controls
  // =========================================================

  const helpButton=document.querySelector('.help-button');
  const helpPanel=document.querySelector('.help-panel');
  const helpOverlay=document.querySelector('.help-overlay');
  const helpClose=document.querySelector('.help-close');
  const settingsButton=document.querySelector('.settings-button');
  const settingsPanel=document.querySelector('.settings-panel');
  const settingsClose=document.querySelector('.settings-close');
  const settingsTitle=document.querySelector('#settings-title');
  const screenshotExitButton=document.querySelector('.screenshot-exit-button');
  const screenshotShareNote=document.querySelector('.screenshot-share-note');
  const screenshotModeLive=document.querySelector('.screenshot-mode-live');
  const shareActions=document.querySelector('.share-image-actions');
  const shareGenerateButtons=Array.from(document.querySelectorAll('.share-generate-button'));
  const shareSaveLink=document.querySelector('.share-save-link');
  const shareSaveHelp=document.querySelector('.share-save-help');
  const shareStatus=document.querySelector('.share-status');
  const shareProgress=document.querySelector('.share-progress');
  const sharePreview=document.querySelector('.share-preview');
  const sharePreviewImage=document.querySelector('.share-preview-image');
  const shareCaptureTarget=document.querySelector('[data-share-capture-target]');
  let isScreenshotMode=false;
  let isGeneratingShareImage=false;
  let shareGenerationState='idle';
  const PANEL_CLOSE_DELAY_MS=240;

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
    }, PANEL_CLOSE_DELAY_MS);
  }

  function openSettings(){
    if(!settingsPanel || !helpOverlay || !settingsButton) return;
    closeHelp(false);
    helpOverlay.hidden=false;
    settingsPanel.hidden=false;
    requestAnimationFrame(()=>settingsPanel.classList.add('is-open'));
    settingsButton.setAttribute('aria-expanded','true');
    (settingsTitle || settingsClose || settingsPanel).focus();
  }

  function closeSettings(returnFocus=true){
    if(!settingsPanel || !helpOverlay || !settingsButton) return;
    settingsPanel.classList.remove('is-open');
    settingsButton.setAttribute('aria-expanded','false');
    window.setTimeout(()=>{
      settingsPanel.hidden=true;
      if(!helpPanel || helpPanel.hidden) helpOverlay.hidden=true;
      if(returnFocus) settingsButton.focus();
    }, PANEL_CLOSE_DELAY_MS);
  }

  function prefersReducedMotion(){
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function waitForLayout(){
    return new Promise(resolve=>{
      requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    });
  }

  function scrollToShareTop(){
    const behavior=prefersReducedMotion() ? 'auto' : 'smooth';
    if(phoneEl && typeof phoneEl.scrollIntoView === 'function'){
      phoneEl.scrollIntoView({block:'start', behavior});
      return;
    }
    window.scrollTo({top:0, behavior});
  }

  function forceClosePanels(){
    if(helpPanel){
      helpPanel.classList.remove('is-open');
      helpPanel.hidden=true;
    }
    if(settingsPanel){
      settingsPanel.classList.remove('is-open');
      settingsPanel.hidden=true;
    }
    if(helpButton) helpButton.setAttribute('aria-expanded','false');
    if(settingsButton) settingsButton.setAttribute('aria-expanded','false');
    if(helpOverlay) helpOverlay.hidden=true;
  }

  function enterScreenshotMode(){
    if(isScreenshotMode) return;
    isScreenshotMode=true;
    forceClosePanels();
    phoneEl && phoneEl.classList.add('is-screenshot-mode');
    setShareGenerationState(shareGenerationState);
    if(screenshotShareNote) screenshotShareNote.hidden=false;
    if(shareActions) shareActions.hidden=false;
    if(screenshotExitButton) screenshotExitButton.hidden=false;
    if(screenshotModeLive) screenshotModeLive.textContent='画像生成・保存画面に切り替えました。';
  }

  function exitScreenshotMode(returnFocus=false){
    if(!isScreenshotMode) return;
    isScreenshotMode=false;
    phoneEl && phoneEl.classList.remove('is-screenshot-mode','is-share-loading','is-share-success','is-share-error');
    if(screenshotShareNote) screenshotShareNote.hidden=true;
    if(shareActions) shareActions.hidden=true;
    if(screenshotExitButton) screenshotExitButton.hidden=true;
    setShareGenerationState('idle');
    if(screenshotModeLive) screenshotModeLive.textContent='通常表示に戻りました。';
    if(returnFocus){
      const focusTarget=shareGenerateButtons.find(button=>!button.hidden && button.offsetParent !== null) || settingsButton || document.querySelector('.settings-button');
      focusTarget && focusTarget.focus();
    }
  }

  helpButton && helpButton.addEventListener('click',openHelp);
  helpClose && helpClose.addEventListener('click',()=>closeHelp());
  settingsButton && settingsButton.addEventListener('click',openSettings);
  settingsClose && settingsClose.addEventListener('click',()=>closeSettings());
  screenshotExitButton && screenshotExitButton.addEventListener('click',()=>exitScreenshotMode(true));

  // =========================================================
  // Share image mode
  // =========================================================

  function setShareGenerationState(state){
    shareGenerationState=['idle','loading','success','error'].includes(state) ? state : 'idle';
    isGeneratingShareImage=shareGenerationState==='loading';
    if(phoneEl){
      phoneEl.setAttribute('data-share-generation-state', shareGenerationState);
      phoneEl.classList.toggle('is-share-loading', shareGenerationState==='loading');
      phoneEl.classList.toggle('is-share-success', shareGenerationState==='success');
      phoneEl.classList.toggle('is-share-error', shareGenerationState==='error');
      if(shareGenerationState==='idle') phoneEl.classList.remove('is-share-loading','is-share-success','is-share-error');
    }
    shareGenerateButtons.forEach(button=>{
      button.disabled=isGeneratingShareImage;
      button.setAttribute('aria-busy', isGeneratingShareImage ? 'true' : 'false');
    });
    if(shareProgress) shareProgress.hidden=shareGenerationState!=='loading';
    if(shareSaveLink) shareSaveLink.hidden=shareGenerationState!=='success';
    if(shareSaveHelp) shareSaveHelp.hidden=shareGenerationState!=='success';
    if(sharePreview) sharePreview.hidden=shareGenerationState!=='success';
    if(screenshotShareNote) screenshotShareNote.hidden=!isScreenshotMode;
  }

  function formatShareImageFileName(){
    const now=new Date();
    const year=String(now.getFullYear());
    const month=String(now.getMonth()+1).padStart(2,'0');
    const day=String(now.getDate()).padStart(2,'0');
    return `sanga-schedule-share-${year}${month}${day}.png`;
  }

  function resetShareImageResult(){
    if(shareSaveLink){
      shareSaveLink.hidden=true;
      shareSaveLink.removeAttribute('href');
    }
    if(shareSaveHelp) shareSaveHelp.hidden=true;
    if(sharePreview) sharePreview.hidden=true;
    if(shareProgress) shareProgress.hidden=true;
    if(sharePreviewImage) sharePreviewImage.removeAttribute('src');
  }

  async function generateShareImage(){
    if(isGeneratingShareImage) return;
    if(!shareCaptureTarget){
      if(shareStatus) shareStatus.textContent='画像生成に失敗しました。通常表示に戻って、表示列や絞り込みを変えて再度お試しください。';
      setShareGenerationState('error');
      return;
    }
    if(!isScreenshotMode) enterScreenshotMode();
    else forceClosePanels();
    scrollToShareTop();
    resetShareImageResult();
    setShareGenerationState('loading');
    if(shareStatus) shareStatus.textContent='画像を生成しています…';
    try{
      await waitForLayout();
      if(document.fonts && document.fonts.ready) await document.fonts.ready;
      await waitForLayout();
      // modern-screenshot is loaded from a pinned esm.sh CDN URL for this initial static-site implementation.
      // It renders the DOM in the browser and does not send the page DOM or generated image to an external API.
      const dataUrl=await domToPng(shareCaptureTarget, {
        scale:2,
        backgroundColor:'#5b0045'
      });
      const fileName=formatShareImageFileName();
      if(sharePreviewImage) sharePreviewImage.src=dataUrl;
      if(shareSaveLink){
        shareSaveLink.href=dataUrl;
        shareSaveLink.download=fileName;
      }
      setShareGenerationState('success');
      if(shareStatus) shareStatus.textContent='画像を保存できます。';
    }catch(error){
      console.warn('Share image generation failed:', error);
      resetShareImageResult();
      setShareGenerationState('error');
      if(shareStatus) shareStatus.textContent='画像生成に失敗しました。通常表示に戻って、表示列や絞り込みを変えて再度お試しください。';
    }
  }

  shareGenerateButtons.forEach(button=>{
    button.addEventListener('click',generateShareImage);
  });
  helpOverlay && helpOverlay.addEventListener('click',()=>{
    if(helpPanel && !helpPanel.hidden) closeHelp(false);
    if(settingsPanel && !settingsPanel.hidden) closeSettings(false);
  });
  document.addEventListener('keydown',(e)=>{
    if(e.key !== 'Escape') return;
    if(isScreenshotMode) exitScreenshotMode(true);
    else if(settingsPanel && !settingsPanel.hidden) closeSettings();
    else if(helpPanel && !helpPanel.hidden) closeHelp();
  });

  // =========================================================
  // Layout, display mode, and filters
  // =========================================================

  // layout switcher: 1 / 2 / 3 / 4 columns
  const LAYOUT_STORAGE_KEY='sanga-schedule-layout-v1';
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

  setScheduleLayout(readStorageValue(LAYOUT_STORAGE_KEY, '2'));

  layoutButtons.forEach(button=>{
    button.addEventListener('click',(event)=>{
      event.preventDefault();
      event.stopPropagation();
      const selected=button.dataset.layout || '2';
      writeStorageValue(LAYOUT_STORAGE_KEY, selected);
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
    const raw=readStorageValue(DISPLAY_MODE_STORAGE_KEY, '');
    if(!raw) return 'card';
    try{
      const parsed=JSON.parse(raw);
      return normalizeDisplayMode(parsed && parsed.mode);
    }catch(e){
      return 'card';
    }
  }

  function writeDisplayModeSettings(){
    writeStorageValue(DISPLAY_MODE_STORAGE_KEY, JSON.stringify({mode:activeDisplayMode}));
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
    const raw=readStorageValue(FILTER_SETTINGS_STORAGE_KEY, '');
    if(!raw) return 'all';
    try{
      const parsed=JSON.parse(raw);
      return normalizeFilter(parsed && parsed.activeFilter);
    }catch(e){
      return 'all';
    }
  }

  function writeFilterSettings(){
    writeStorageValue(FILTER_SETTINGS_STORAGE_KEY, JSON.stringify({activeFilter}));
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

  // =========================================================
  // LocalStorage reset
  // =========================================================

  const storageClearButton=document.querySelector('.storage-clear');
  const storageClearNote=document.querySelector('.storage-clear-note');

  storageClearButton && storageClearButton.addEventListener('click',()=>{
    removeStorageValue(CARD_STATE_STORAGE_KEY);
    removeStorageValue(LAYOUT_STORAGE_KEY);
    removeStorageValue(FILTER_SETTINGS_STORAGE_KEY);
    removeStorageValue(DISPLAY_MODE_STORAGE_KEY);
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


  // =========================================================
  // JSON loading and match card rendering
  // =========================================================

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
    const homeAway=match.home_away==='H' ? 'home' : match.home_away==='A' ? 'away' : '';
    const haText=match.home_away==='H' ? 'HOME' : match.home_away==='A' ? 'AWAY' : '';
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
    const dataPath='data/matches.json?v=20260622-1';
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
