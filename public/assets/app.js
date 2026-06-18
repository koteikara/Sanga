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
    states={};
    document.querySelectorAll('.manual-schedule .match').forEach(btn=>{
      btn.dataset.state='0';
      btn.setAttribute('aria-pressed','false');
    });
    setScheduleLayout('2');
    if(storageClearNote){
      storageClearNote.textContent='このページの保存内容を削除しました。';
    }
  });


  const jsonPreviewList=document.querySelector('[data-json-preview-list]');
  const jsonPreviewStatus=document.querySelector('[data-json-preview-status]');
  const weekdayLabels=['SUN','MON','TUE','WED','THU','FRI','SAT'];

  function setJsonPreviewStatus(message){
    if(jsonPreviewStatus) jsonPreviewStatus.textContent=message;
  }

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

  function createJsonMatchCard(match){
    const homeAway=match.home_away==='H' ? 'home' : 'away';
    const haText=match.home_away==='H' ? 'HOME' : 'AWAY';
    const button=document.createElement('article');
    button.className=`match json-preview-match ${homeAway} logo-${match.opponent_code || 'unknown'}`;
    button.dataset.jsonId=match.id || '';
    button.dataset.previewOnly='true';
    button.setAttribute('aria-label',`${match.round || '節未定'} ${match.home_away_label || haText} ${match.opponent || '対戦相手未定'} ${match.venue || '会場未定'} JSON表示テスト`);

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
      button.append(note);
    }
    return button;
  }

  async function renderJsonPreview(){
    if(!jsonPreviewList) return;
    try{
      const response=await fetch('data/matches.sample.json');
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const data=await response.json();
      const matches=Array.isArray(data.matches) ? data.matches : [];
      jsonPreviewList.replaceChildren(...matches.map(createJsonMatchCard));
      setJsonPreviewStatus(`${matches.length}件のJSON由来カードを表示しています。`);
    }catch(error){
      jsonPreviewList.replaceChildren();
      setJsonPreviewStatus('JSONの読み込みに失敗しました。既存の日程表示はそのまま利用できます。');
      console.warn('JSON preview rendering failed:', error);
    }
  }

  renderJsonPreview();

})();
