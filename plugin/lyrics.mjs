// Timing conversion only. Never infer syllable timing from character counts.
export function parseLrc(text = '') {
  const lines = [];
  for (const row of String(text).split(/\r?\n/)) {
    const tags = [...row.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    const value = row.replace(/\[[^\]]*\]/g, '').trim();
    for (const tag of tags) lines.push({startTime:Math.round((+tag[1]*60 + +tag[2])*1000),text:value});
  }
  return lines.sort((a,b)=>a.startTime-b.startTime);
}
export function parseYrc(text = '') {
  const result = [];
  for (const row of String(text).split(/\r?\n/)) {
    const head = row.match(/^\[(\d+),(\d+)\]/);
    if(!head) continue;
    const words = [...row.slice(head[0].length).matchAll(/\((\d+),(\d+),\d+\)([^]*?)(?=\(\d+,\d+,\d+\)|$)/g)]
      .map(m=>({startTime:+m[1],endTime:+m[1]+ +m[2],word:m[3]}));
    if(!words.length) continue;
    const startTime = +head[1], endTime = Math.max(startTime + +head[2],...words.map(w=>w.endTime));
    result.push({startTime,endTime,words,translatedLyric:'',romanLyric:'',isBG:false,isDuet:false});
  }
  return result.sort((a,b)=>a.startTime-b.startTime);
}
export function buildLyrics(lyric, durationMs) {
  const yrc = parseYrc(lyric?.yrcInfo?.yrc);
  const mode = yrc.length ? 'word' : 'line';
  const lines = yrc.length ? yrc : (lyric?.lyricLines||[]).map((l,i,all)=>{
    const startTime = Math.max(0,Math.round(l.time*1000));
    const endTime = Math.max(startTime,Math.round((all[i+1]?.time ?? durationMs/1000)*1000));
    return {startTime,endTime,words:[{word:l.lyric,startTime,endTime}],translatedLyric:'',romanLyric:'',isBG:false,isDuet:false};
  });
  const translations = mode==='word' && lyric.yrcInfo?.yrcTrans
    ? parseLrc(lyric.yrcInfo.yrcTrans) : (lyric?.tlyricLines||[]).map(l=>({startTime:Math.round(l.time*1000),text:l.lyric}));
  const roman = mode==='word' && lyric.yrcInfo?.yrcRoma
    ? parseLrc(lyric.yrcInfo.yrcRoma) : (lyric?.romaLyricLines||[]).map(l=>({startTime:Math.round(l.time*1000),text:l.lyric}));
  const nearest = (items,t)=>{
    let best, error=mode==='word'?1600:100;
    for(const row of items) { const distance=Math.abs(row.startTime-t);if(distance<error){error=distance;best=row;} }
    return best?.text||'';
  };
  for(const l of lines) {
    if(lyric.translationEnable) l.translatedLyric=nearest(translations,l.startTime);
    if(lyric.romaEnable) l.romanLyric=nearest(roman,l.startTime);
  }
  return {mode,lines};
}
export function createClock() {
  let media=0,stamp=0,running=false,speed=1,initialized=false;
  return {
    read(now) {return media + (running ? Math.min(1500,Math.max(0,now-stamp))*speed : 0);},
    state(now,play,rate=1) {media=this.read(now);stamp=now;running=play;speed=Number(rate)||1;},
    sample(ms,now,force=false) {
      if(!Number.isFinite(ms)||ms<0) return false;
      const predicted=this.read(now),error=ms-predicted;
      const seek=initialized && (force || Math.abs(error)>700);
      if(!initialized || seek || !running) media=ms;
      else media=predicted + Math.max(-12,Math.min(12,error*.18));
      stamp=now;initialized=true;
      return seek;
    }
  };
}
