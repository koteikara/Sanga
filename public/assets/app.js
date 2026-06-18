(function(){
  const key='sanga-schedule-button-states-v1';
  let states={};
  try{states=JSON.parse(localStorage.getItem(key)||'{}')}catch(e){states={}}
  document.querySelectorAll('.match').forEach(btn=>{
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
    document.querySelectorAll('.match').forEach(btn=>{
      btn.dataset.state='0';
      btn.setAttribute('aria-pressed','false');
    });
    setScheduleLayout('2');
    if(storageClearNote){
      storageClearNote.textContent='このページの保存内容を削除しました。';
    }
  });

})();
