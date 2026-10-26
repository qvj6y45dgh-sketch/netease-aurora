(() => {
  'use strict';
  if(location.href !== 'orpheus://orpheus/app.html') return {error:'Unexpected target'};
  if(!navigator.userAgent.includes('NeteaseMusicDesktop/3.1.13.3451')) return {error:'Unverified client version'};
  window.__aurora?.destroy();
  const {DomLyricPlayer,buildLyrics,createClock} = AuroraAMLL;
  const style = document.createElement('style');
  style.id='aurora-internal-style'; style.textContent=__AMLL_CSS__+'\n'+__AURORA_CSS__;
  document.head.append(style);
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const clock=createClock();
  let enabled=true,destroyed=false,page,boundRoot,background,button,art='',scheduled;
  let native,unsubscribeStore,subscriptions=[],nativeAttempts=0,error='';
  let host,area,originalList,originalAria,player,dataSignature,mode='none',lyricLines=[];
  let frameId=0,lastFrame=0,lastTime=0,pendingSeek=true,isPlaying=false,dragging=false,buffering=false;
  let frames=0,progressSamples=0,songId='',seekCount=0,wordCount=0;
  const frameGaps=[];
  function schedule() {
    if(!scheduled&&!destroyed) scheduled=setTimeout(()=>{scheduled=null;sync();},100);
  }
  function acquireNative() {
    let req;
    const id='aurora-clock-'+Math.random().toString(36).slice(2);
    const queue=window.webpackJsonp;
    if(!queue?.push) throw new Error('Native modules not ready');
    const entry=[[],{[id]:(m,e,r)=>{req=r;}},[[id]]];
    queue.push(entry);
    if(!req) throw new Error('Native module resolver unavailable');
    delete req.c[id]; delete req.m[id];
    const index=queue.indexOf(entry);if(index>=0)Array.prototype.splice.call(queue,index,1);
    const app=req(8).a,progress=req(131),states=req(6).k;
    if(!app.inited||!app.app?._store||typeof progress.e?.subscribe!=='function') throw new Error('Native player not ready');
    return {store:app.app._store,progress,drag:req(85).c,states,read:()=>app.getStore()};
  }
  function currentTime(now=performance.now()) {
    const state=native?.read(),duration=(state?.playing?.resourceDuration||0)*1000;
    const offset=Number(state?.['async:lyric']?.offset)||0;
    return Math.max(0,Math.min(duration||Infinity,clock.read(now)+offset));
  }
  function updateClockState() {
    if(!native)return;
    const state=native.read().playing;
    const playing=state.playingState===native.states.Playing && !buffering && !dragging;
    clock.state(performance.now(),playing,Number(state.playingSpeed)||1);
    if(playing!==isPlaying) {
      isPlaying=playing;
      if(player)playing?player.resume():player.pause();
    }
  }
  function sampleProgress(sample,force=false) {
    if(!sample||!native)return;
    const id=String(native.read().playing.resourceTrackId||'');
    if(sample.playId && String(sample.playId).split('_')[0]!==id)return;
    const seconds=Number(sample.current);
    if(!Number.isFinite(seconds))return;
    progressSamples++;
    const seek=clock.sample(seconds*1000,performance.now(),force||!!sample.force);
    if(seek){pendingSeek=true;seekCount++;}
    ensureFrame();
  }
  function ensureNative() {
    if(native)return true;
    try {
      native=acquireNative();error='';
      updateClockState();sampleProgress(native.progress.b());
      subscriptions.push(native.progress.e.subscribe(value=>sampleProgress(value)));
      subscriptions.push(native.progress.g.subscribe(value=>{
        pendingSeek=true;
        if(Number.isFinite(Number(value?.current)))sampleProgress(value,true);
      }));
      subscriptions.push(native.progress.c.subscribe(value=>{
        buffering=typeof value==='boolean'?value:!!value?.buffering;
        updateClockState();ensureFrame();
      }));
      subscriptions.push(native.drag.subscribe(value=>{
        dragging=!!value?.inSeek;
        if(Number.isFinite(value?.time)){clock.sample(value.time*1000,performance.now(),true);pendingSeek=true;}
        updateClockState();ensureFrame();
      }));
      unsubscribeStore=native.store.subscribe(()=>{
        if(destroyed)return;
        updateClockState();refreshData();ensureFrame();schedule();
      });
      return true;
    }catch(e){if(nativeAttempts++<40){error='';schedule();}else error=e.message;return false;}
  }
  function restoreOriginal() {
    if(!originalList)return;
    originalList.removeAttribute('data-aurora-native-hidden');
    if(originalAria===null)originalList.removeAttribute('aria-hidden');
    else originalList.setAttribute('aria-hidden',originalAria);
  }
  function setPresentation() {
    const ready=enabled&&!!player&&lyricLines.length>0;
    if(host)host.hidden=!ready;
    if(ready&&originalList){originalList.setAttribute('data-aurora-native-hidden','1');originalList.setAttribute('aria-hidden','true');}
    else restoreOriginal();
    if(button)button.title=mode==='word'?'逐词跟唱 · ⌘⇧A 切换美化':'行级歌词 · ⌘⇧A 切换美化';
    if(!ready){cancelAnimationFrame(frameId);frameId=0;lastFrame=0;player?.pause();}
    else {isPlaying?player.resume():player.pause();ensureFrame();}
  }
  function disposeLyrics() {
    cancelAnimationFrame(frameId);frameId=0;lastFrame=0;
    restoreOriginal();player?.dispose();host?.remove();
    player=undefined;host=undefined;area=undefined;originalList=undefined;
    dataSignature=undefined;lyricLines=[];wordCount=0;mode='none';
  }
  function motionPreferenceChanged() {
    player?.setEnableSpring(!reduceMotion.matches);
    player?.setEnableScale(!reduceMotion.matches);
    player?.setEnableBlur(!reduceMotion.matches);
    if(player){player.setCurrentTime(Math.round(currentTime()),true);player.update(0);}
  }
  function mountLyrics(root) {
    if(!enabled||native?.read()?.['page:vinylPage']?.pageState!=='opened'){disposeLyrics();return;}
    const nextArea=root?.querySelector('.area.lyric-mode');
    const list=nextArea?.querySelector('[data-testid="tid_lyricdisplay_list"]');
    if(nextArea===area&&list===originalList&&host?.isConnected)return;
    disposeLyrics();
    if(!nextArea||!list||!native)return;
    area=nextArea;originalList=list;originalAria=list.getAttribute('aria-hidden');
    host=document.createElement('div');host.className='aurora-lyrics-host';area.append(host);
    try {
      player=new DomLyricPlayer();host.append(player.getElement());
      player.setAlignPosition(.32);player.setAlignAnchor('center');
      player.setWordFadeWidth(.5);player.setEnableAutoSeekDetection(false);
      player.setLinePosYSpringParams({mass:1,damping:28,stiffness:170});
      player.addEventListener('line-click',event=>{
        const target=event.line.getLine().startTime/1000;
        const trial=Number(native.read().playing.freeTrialInfo?.start)||0;
        native.store.dispatch({type:'playing/setPlayingPosition',payload:{duration:Math.max(0,target-trial)}});
        clock.sample(target*1000,performance.now(),true);pendingSeek=true;ensureFrame();
      });
      motionPreferenceChanged();refreshData();
    }catch(e){error='Lyric renderer: '+e.message;disposeLyrics();}
  }
  function refreshData() {
    if(!player||!native)return;
    const state=native.read(),p=state.playing,l=state['async:lyric'];
    if(!l)return;
    const id=String(p.resourceTrackId||'');
    const signature=[id,l.isLoading,l.isLyricFetchFailed,l.yrcInfo?.yrc,l.yrcInfo?.yrcTrans,l.yrcInfo?.yrcRoma,l.lyricLines,l.tlyricLines,l.romaLyricLines,l.translationEnable,l.romaEnable];
    if(dataSignature&&signature.every((x,i)=>x===dataSignature[i]))return;
    const songChanged=id!==songId;songId=id;dataSignature=signature;
    try {
      // Keep original lyrics without changing the client's translation preference.
      const data=l.isLoading||l.isLyricFetchFailed?{mode:'none',lines:[]}:buildLyrics({...l,translationEnable:false},(p.resourceDuration||0)*1000);
      mode=data.mode;lyricLines=data.lines;wordCount=lyricLines.reduce((n,line)=>n+line.words.length,0);
      if(songChanged)sampleProgress(native.progress.b());
      const time=Math.round(currentTime());
      player.setLyricLines(lyricLines,time);player.setCurrentTime(time,true);player.update(0);
      pendingSeek=true;lastTime=time;setPresentation();
    }catch(e){error='Lyric data: '+e.message;lyricLines=[];setPresentation();}
  }
  function visible() {
    return enabled&&host?.isConnected&&!host.hidden&&!document.hidden&&native?.read()?.['page:vinylPage']?.pageState==='opened';
  }
  function ensureFrame() {
    if(!frameId&&!destroyed&&visible())frameId=requestAnimationFrame(frame);
  }
  function frame(now) {
    frameId=0;if(destroyed||!visible()||!player){lastFrame=0;return;}
    try {
      const gap=lastFrame?now-lastFrame:0;
      if(gap>0){frameGaps.push(gap);if(frameGaps.length>600)frameGaps.shift();}
      let time=Math.round(currentTime(now));
      if(!pendingSeek&&isPlaying)time=Math.max(lastTime,time);
      player.setCurrentTime(time,pendingSeek);pendingSeek=false;lastTime=time;
      player.update(Math.min(gap,50));lastFrame=now;frames++;
    }catch(e){error='Lyric frame: '+e.message;restoreOriginal();host.hidden=true;return;}
    ensureFrame();
  }
  function toggle(){enabled=!enabled;if(!enabled)disposeLyrics();sync();setPresentation();}
  function sync() {
    if(destroyed)return;
    ensureNative();
    const root=document.getElementById('VINYL_COVER_ELEMENT_ID');
    const next=root?.closest('[class^="VinylPageContainer"]');
    if(next!==page||root!==boundRoot) {
      disposeLyrics();page?.removeAttribute('data-aurora-page');boundRoot?.style.removeProperty('--aurora-cover');boundRoot?.style.removeProperty('--aurora-tint');tintToken++;background?.remove();button?.remove();art='';
      page=next;boundRoot=root;
      if(root&&page) {
        background=document.createElement('div');background.className='aurora-atmosphere';background.setAttribute('aria-hidden','true');
        const veil=document.createElement('div');veil.className='aurora-veil';background.append(veil);root.prepend(background);
        button=document.createElement('button');button.className='aurora-switch';button.textContent='AURORA';button.addEventListener('click',toggle);page.append(button);
      }
    }
    if(!page)return;
    if(enabled)page.setAttribute('data-aurora-page','1');else page.removeAttribute('data-aurora-page');
    button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',enabled?'关闭 Aurora 播放页美化':'开启 Aurora 播放页美化');
    const image=root.querySelector('[data-testid="tid_vinylcover_cover"] img');
    const nextArt=image?.currentSrc||image?.src;
    if(nextArt&&nextArt!==art){
      art=nextArt;background.style.setProperty('--aurora-art',`url(${JSON.stringify(art)})`);extractTint(art,root);
      // Native art may be wrapped as orpheus://cache/?https://...; keep the wrapper so the client cache still serves it.
      const cache='orpheus://cache/?',inner=art.startsWith(cache)?art.slice(cache.length):art;
      let full;try{full=new URL(inner);}catch{}
      if(full&&/\.music\.126\.net$/.test(full.hostname)){
        full.search='?param=1024y1024';
        const hiRes=(art.startsWith(cache)?cache:'')+full.href;
        root.style.setProperty('--aurora-cover',`url(${JSON.stringify(hiRes)})`);
      }else root.style.removeProperty('--aurora-cover');
    }
    mountLyrics(root);setPresentation();
  }
  // Average the cover's saturated hues into one light tint for the inactive lyric lines.
  let tintToken=0;
  function extractTint(src,root) {
    const token=++tintToken,image=new Image();
    image.onload=()=>{
      if(token!==tintToken||destroyed)return;
      try {
        const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
        const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,32,32);
        const data=ctx.getImageData(0,0,32,32).data;
        let x=0,y=0,total=0;
        for(let i=0;i<data.length;i+=4) {
          const r=data[i]/255,g=data[i+1]/255,b=data[i+2]/255,max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
          if(d<.12)continue;
          const l=(max+min)/2,s=d/(1-Math.abs(2*l-1)),w=s*d;
          const h=max===r?((g-b)/d+6)%6:max===g?(b-r)/d+2:(r-g)/d+4;
          x+=Math.cos(h*Math.PI/3)*w;y+=Math.sin(h*Math.PI/3)*w;total+=w;
        }
        if(total<12||Math.hypot(x,y)/total<.3){root.style.removeProperty('--aurora-tint');return;}
        const hue=Math.round((Math.atan2(y,x)*180/Math.PI+360)%360);
        root.style.setProperty('--aurora-tint',`hsl(${hue} 40% 84%)`);
      }catch{root.style.removeProperty('--aurora-tint');}
    };
    image.onerror=()=>{if(token===tintToken)root.style.removeProperty('--aurora-tint');};
    image.src=src;
  }
  function key(event) {
    if(event.metaKey&&event.shiftKey&&event.code==='KeyA'&&!/INPUT|TEXTAREA/.test(event.target.tagName)&&!event.target.isContentEditable){event.preventDefault();toggle();}
  }
  function visibilityChanged(){if(document.hidden){cancelAnimationFrame(frameId);frameId=0;lastFrame=0;}else{pendingSeek=true;ensureFrame();}}
  const observer=new MutationObserver(records=>{
    if(records.some(r=>!r.target.closest?.('.aurora-lyrics-host')))schedule();
  });
  observer.observe(document.getElementById('root')||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
  document.addEventListener('keydown',key);document.addEventListener('visibilitychange',visibilityChanged);
  reduceMotion.addEventListener('change',motionPreferenceChanged);
  window.__aurora={toggle,status(){
    const gaps=[...frameGaps].sort((a,b)=>a-b);
    return {version:'0.3.0',enabled,loading:!native&&nativeAttempts<=40,nativeReady:!!native,pageFound:!!page,styled:!!page?.hasAttribute('data-aurora-page'),artLoaded:!!art,
      lyrics:{renderer:player?'AMLL DOM 0.6.0':'native',maskEngine:CSS.supports('mask-image','none')?'web-animations':'webkit-calc',mode,lines:lyricLines.length,words:wordCount,playing:isPlaying,timeMs:Math.round(currentTime()),nativeSamples:progressSamples,frames,seeks:seekCount,reducedMotion:reduceMotion.matches,medianFrameMs:gaps[Math.floor(gaps.length*.5)]||null,p95FrameMs:gaps[Math.floor(gaps.length*.95)]||null},error:error||null,url:location.href};
  },destroy(){
    destroyed=true;observer.disconnect();clearTimeout(scheduled);unsubscribeStore?.();subscriptions.forEach(s=>s.unsubscribe());subscriptions=[];
    disposeLyrics();document.removeEventListener('keydown',key);document.removeEventListener('visibilitychange',visibilityChanged);reduceMotion.removeEventListener('change',motionPreferenceChanged);
    page?.removeAttribute('data-aurora-page');boundRoot?.style.removeProperty('--aurora-cover');boundRoot?.style.removeProperty('--aurora-tint');tintToken++;background?.remove();button?.remove();style.remove();delete window.__aurora;
  }};
  sync();return window.__aurora.status();
})()
