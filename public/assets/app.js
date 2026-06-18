(function(){
  const key='sanga-schedule-button-states-v1';
  let states={};
  try{states=JSON.parse(localStorage.getItem(key)||'{}')}catch(e){states={}}
  document.querySelectorAll('.manual-schedule .match').forEach(btn=>{
    const id=btn.dataset.id;
    const current=Number(states[id]||0);
    btn.dataset.state=String(current);
    btn.setAttribute('aria-pressed', current ? 'true' : 'false');
    btn.addEventListener('click',()=>{
      const next=(Number(btn.dataset.state||0)+1)%3;
      btn.dataset.state=String(next);
      btn.setAttribute('aria-pressed', next ? 'true' : 'false');
      states[id]=next;
      localStorage.setItem(key,JSON.stringify(states));
    });
  });
  const helpButton=document.querySelector('.help-button');
  const helpPanel=document.querySelector('.help-panel');
  const helpOverlay=document.querySelector('.help-overlay');
  const helpClose=document.querySelector('.help-close');

  function openHelp(){
    if(!helpPanel || !helpOverlay || !helpButton) return;
    helpOverlay.hidden=false;
    helpPanel.hidden=false;
    requestAnimationFrame(()=>helpPanel.classList.add('is-open'));
    helpButton.setAttribute('aria-expanded','true');
    helpClose && helpClose.focus();
  }

  function closeHelp(){
    if(!helpPanel || !helpOverlay || !helpButton) return;
    helpPanel.classList.remove('is-open');
    helpButton.setAttribute('aria-expanded','false');
    window.setTimeout(()=>{
      helpPanel.hidden=true;
      helpOverlay.hidden=true;
      helpButton.focus();
    }, 240);
  }

  helpButton && helpButton.addEventListener('click',openHelp);
  helpClose && helpClose.addEventListener('click',closeHelp);
  helpOverlay && helpOverlay.addEventListener('click',closeHelp);
  document.addEventListener('keydown',(e)=>{
    if(e.key==='Escape' && helpPanel && !helpPanel.hidden) closeHelp();
  });

  // layout switcher: 2 / 3 / 4 columns
  const layoutKey='sanga-schedule-layout-v1';
  const phoneEl=document.querySelector('.phone');
  const layoutButtons=Array.from(document.querySelectorAll('.layout-option'));

  function setScheduleLayout(mode){
    const selected=['2','3','4'].includes(String(mode)) ? String(mode) : '2';
    if(phoneEl){
      phoneEl.classList.remove('layout-3','layout-4');
      if(selected==='3') phoneEl.classList.add('layout-3');
      if(selected==='4') phoneEl.classList.add('layout-4');
    }
    layoutButtons.forEach(button=>{
      const active=button.dataset.layout===selected;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  setScheduleLayout(localStorage.getItem(layoutKey) || '2');

  layoutButtons.forEach(button=>{
    button.addEventListener('click',(event)=>{
      event.preventDefault();
      event.stopPropagation();
      const selected=button.dataset.layout || '2';
      localStorage.setItem(layoutKey, selected);
      setScheduleLayout(selected);
    });
  });

  const storageClearButton=document.querySelector('.storage-clear');
  const storageClearNote=document.querySelector('.storage-clear-note');

  storageClearButton && storageClearButton.addEventListener('click',()=>{
    localStorage.removeItem(key);
    localStorage.removeItem(layoutKey);
    localStorage.removeItem(dataModeKey);
    states={};
    document.querySelectorAll('.manual-schedule .match').forEach(btn=>{
      btn.dataset.state='0';
      btn.setAttribute('aria-pressed','false');
    });
    setScheduleLayout('2');
    setScheduleDataMode('manual');
    if(storageClearNote){
      storageClearNote.textContent='このページの保存内容を削除しました。';
    }
  });


  const dataModeKey='sanga-schedule-data-mode-v1';
  const dataModeButtons=Array.from(document.querySelectorAll('.data-mode-option'));
  const dataModeStatus=document.querySelector('[data-data-mode-status]');
  const manualSchedules=Array.from(document.querySelectorAll('.manual-schedule'));
  const jsonPreviewSection=document.querySelector('.json-preview');
  const jsonPreviewList=document.querySelector('[data-json-preview-list]');
  const jsonPreviewStatus=document.querySelector('[data-json-preview-status]');
  let jsonPreviewReady=false;
  let jsonPreviewFailed=false;
  const weekdayLabels=['SUN','MON','TUE','WED','THU','FRI','SAT'];

  function setJsonPreviewStatus(message){
    if(jsonPreviewStatus) jsonPreviewStatus.textContent=message;
  }

  function setDataModeStatus(message){
    if(dataModeStatus) dataModeStatus.textContent=message;
  }

  function isValidDataMode(mode){
    return mode==='manual' || mode==='json';
  }

  function setScheduleDataMode(mode, options={}){
    const requested=isValidDataMode(mode) ? mode : 'manual';
    const jsonUsable=jsonPreviewReady && !jsonPreviewFailed;
    const selected=requested==='json' && jsonUsable ? 'json' : 'manual';

    manualSchedules.forEach(section=>{
      section.hidden=selected !== 'manual';
    });
    if(jsonPreviewSection){
      jsonPreviewSection.hidden=selected !== 'json';
    }
    dataModeButtons.forEach(button=>{
      const active=button.dataset.scheduleMode===selected;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    if(options.persist){
      localStorage.setItem(dataModeKey, selected);
    }

    if(requested==='json' && !jsonUsable){
      setDataModeStatus('JSON表示は読み込み完了後に選択できます。現在は手書き表示です。');
      return;
    }

    setDataModeStatus(selected==='json' ? '現在はJSON表示です。手書き表示へいつでも戻せます。' : '現在は手書き表示です。');
  }

  setScheduleDataMode('manual');

  dataModeButtons.forEach(button=>{
    button.addEventListener('click',()=>{
      setScheduleDataMode(button.dataset.scheduleMode || 'manual', {persist:true});
    });
  });

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
    heading.textContent=year;
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
    button.dataset.previewOnly='true';
    button.dataset.state='0';
    button.setAttribute('aria-pressed','false');
    button.setAttribute('aria-label',`${match.round || '節未定'} ${match.home_away_label || haText} ${match.opponent || '対戦相手未定'} ${match.venue || '会場未定'} JSON由来の日程表示候補`);

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
    const dataPaths=['data/matches.json','data/matches.sample.json'];
    let lastError=null;
    for(const dataPath of dataPaths){
      try{
        const response=await fetch(dataPath);
        if(!response.ok) throw new Error(`HTTP ${response.status}`);
        const data=await response.json();
        return {data, dataPath};
      }catch(error){
        lastError=error;
        console.warn(`JSON preview data loading failed: ${dataPath}`, error);
      }
    }
    throw lastError || new Error('JSON preview data loading failed.');
  }

  async function renderJsonPreview(){
    if(!jsonPreviewList) return;
    try{
      const {data, dataPath}=await fetchJsonPreviewData();
      const matches=Array.isArray(data.matches) ? data.matches : [];
      const sourceLabel=data.meta && data.meta.source ? ` / 元データ: ${data.meta.source}` : '';
      const updatedLabel=data.meta && data.meta.updated_at ? ` / 更新日時: ${data.meta.updated_at}` : '';
      jsonPreviewList.replaceChildren(...createJsonPreviewItems(matches));
      jsonPreviewReady=true;
      jsonPreviewFailed=false;
      setJsonPreviewStatus(`${matches.length}件のJSON由来カードを表示できます。読み込み元: ${dataPath}${sourceLabel}${updatedLabel}`);
      setScheduleDataMode(localStorage.getItem(dataModeKey) || 'manual');
    }catch(error){
      jsonPreviewList.replaceChildren();
      jsonPreviewReady=false;
      jsonPreviewFailed=true;
      setScheduleDataMode('manual', {persist:true});
      setJsonPreviewStatus('JSONの読み込みに失敗しました。手書き表示へ戻しているため、既存の日程表示はそのまま利用できます。');
      console.warn('JSON preview rendering failed:', error);
    }
  }

  renderJsonPreview();

})();
