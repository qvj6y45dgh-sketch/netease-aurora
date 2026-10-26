import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const app = '/Applications/NeteaseMusic.app';
const root = fileURLToPath(new URL('..',import.meta.url));
const mode = process.argv[2] || 'enable';
if(!['enable','rollback'].includes(mode)) throw new Error('Expected enable or rollback');
const version = execFileSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleShortVersionString',`${app}/Contents/Info.plist`],{encoding:'utf8'}).trim();
const build = execFileSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleVersion',`${app}/Contents/Info.plist`],{encoding:'utf8'}).trim();
if(mode==='enable' && `${version}.${build}` !== '3.1.13.3451') throw new Error(`客户端已更新至 ${version} (${build})，请先重新检查适配。`);
async function ready() {
 try {
  const response = await fetch('http://127.0.0.1:49363/json/version',{signal:AbortSignal.timeout(1000)});
  const data = await response.json();
  if(!data['User-Agent']?.includes('NeteaseMusicDesktop/')) throw new Error('Port occupied by another service');
  return true;
 } catch(e) {
  if(e.message.includes('Port occupied')) throw e;
  return false;
 }
}
if(mode === 'rollback') {
 if(await ready()) execFileSync(process.execPath,['scripts/plugin.mjs','disable'],{cwd:root,stdio:'inherit'});
 console.log('内部样式已移除。请在网易云按 ⌘Q 退出；下次从应用程序正常打开，临时调试端口也随之关闭。');
} else {
 if(!await ready()) {
  const processes = execFileSync('/bin/ps',['-axo','comm'],{encoding:'utf8'});
  if(processes.split('\n').some(x=>x.trim()===`${app}/Contents/MacOS/NeteaseMusic`)) {
   throw new Error('请先在网易云按 ⌘Q 完全退出，然后重新双击「启动 Aurora.command」。需要重新启动才能传入临时 CEF 参数。');
  }
  execFileSync('/usr/bin/open',['-a',app,'--args','--remote-debugging-port=49363','--remote-debugging-address=127.0.0.1']);
  let available = false;
  for(let i=0;i<40;i++) {
   if(await ready()) {available=true;break;}
   await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(!available) throw new Error('官方客户端调试端口未启动，请查看 evidence 和客户端版本。');
 }
 // No background daemon, permanent patches, launch agents or persisted page scripts.
 execFileSync(process.execPath,['scripts/plugin.mjs','enable'],{cwd:root,stdio:'inherit'});
 console.log('Aurora 已加载到官方网易云内部。打开歌曲封面查看；⌘⇧A 切换美化。退出后本次加载清除。');
}
