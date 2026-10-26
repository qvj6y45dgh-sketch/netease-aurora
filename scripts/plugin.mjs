import {readFile} from 'node:fs/promises';
import {connect} from './cdp.mjs';
const command = process.argv[2] || 'status';
if (!['status','enable','disable','probe'].includes(command)) throw new Error('Use status, enable, disable or probe');
if(command === 'probe') {await import('./probe.mjs');} else {
 const c = await connect();
 try {
  let expression;
  if(command === 'enable') {
   const css = await readFile(new URL('../plugin/aurora.css',import.meta.url),'utf8');
   const js = await readFile(new URL('../plugin/aurora.js',import.meta.url),'utf8');
   const vendor = await readFile(new URL('../plugin/vendor/amll.js',import.meta.url),'utf8');
   const vendorCss = await readFile(new URL('../plugin/vendor/amll.css',import.meta.url),'utf8');
   expression = `(() => {${vendor}\nreturn ${js.replace('__AURORA_CSS__',()=>JSON.stringify(css)).replace('__AMLL_CSS__',()=>JSON.stringify(vendorCss))};})()`;
  } else if(command === 'disable') {
   expression = `(() => {window.__aurora?.destroy();document.getElementById('aurora-load-probe')?.remove();return {removed:!window.__aurora && !document.getElementById('aurora-internal-style') && !document.querySelector('[data-aurora-page],.aurora-atmosphere,.aurora-switch')};})()`;
  } else {expression = 'window.__aurora?.status() || {loaded:false}';}
  let result = await c.evaluate(expression);
  if(command==='enable') {
   for(let i=0;result?.loading&&i<40;i++) {
    await new Promise(resolve=>setTimeout(resolve,125));
    result=await c.evaluate('window.__aurora?.status()');
   }
   if(result?.loading)throw new Error('Native player initialization timed out');
  }
  if(result?.error) throw new Error(result.error);
  console.log(JSON.stringify(result,null,2));
 } finally {c.close();}
}
