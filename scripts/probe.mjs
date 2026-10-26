import {connect} from './cdp.mjs';
import {writeFile} from 'node:fs/promises';
const client = await connect();
try {
  const report = await client.evaluate(`(() => {
    const old = document.getElementById('aurora-load-probe');
    if (old) old.remove();
    const marker = document.createElement('div');
    marker.id = 'aurora-load-probe';
    marker.textContent = '内部加载验证 · Aurora';
    marker.style.cssText = 'position:fixed;right:24px;top:70px;z-index:2147483647;padding:12px 20px;border-radius:12px;background:#172b26;color:#a8ffcf;font:600 15px -apple-system;pointer-events:none;box-shadow:0 8px 30px #0004';
    document.body.append(marker);
    return {url:location.href, ua:navigator.userAgent, marker:!!document.getElementById(marker.id),
      viewport:[innerWidth,innerHeight], roots:[...document.body.children].map(n=>({tag:n.tagName,id:n.id,class:n.className})),
      scripts:[...document.scripts].map(s=>s.src).filter(Boolean)};
  })()`);
  await writeFile('evidence/minimal-load.json', JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally {client.close();}
