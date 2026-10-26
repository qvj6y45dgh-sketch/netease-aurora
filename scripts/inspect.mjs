import {connect} from './cdp.mjs';
import {writeFile} from 'node:fs/promises';
const c = await connect();
try {
 const r = await c.evaluate(`(() => {
  const summary = el => ({tag:el.tagName,id:el.id,class:el.className,rect:[el.getBoundingClientRect().x,el.getBoundingClientRect().y,el.clientWidth,el.clientHeight],text:el.children.length?undefined:el.textContent?.slice(0,90)});
  return {url:location.href, playerNodes:[...document.querySelectorAll('[class]')].filter(el=>/lyric|playing|player|album|cover|songInfo|songName|musicInfo/i.test(el.className)&&typeof el.className==='string').map(summary).slice(-220),images:[...document.images].filter(el=>el.getBoundingClientRect().width>100).map(el=>({...summary(el),src:el.currentSrc,parents:[el.parentElement,el.parentElement.parentElement,el.parentElement.parentElement.parentElement].map(summary)}))};
 })()`);
 await writeFile('evidence/dom-inspection.json',JSON.stringify(r,null,2));console.log(JSON.stringify(r,null,2));
} finally {c.close();}
