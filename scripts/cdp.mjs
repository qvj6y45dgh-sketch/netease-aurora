// This connection installs our local plugin into the official client's CEF page.
// No browser navigation, account access, resource patching or native injection.
export async function connect(port = 49363) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`, {signal: AbortSignal.timeout(3000)})).json();
  const target = targets.find(t => t.type === 'page' && t.url === 'orpheus://orpheus/app.html');
  if (!target) throw new Error('Official NetEase app.html target unavailable; refusing other pages.');
  const url = new URL(target.webSocketDebuggerUrl);
  if (url.hostname !== '127.0.0.1' || Number(url.port) !== port) throw new Error('Non-loopback debugger rejected');
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, {once:true});
    socket.addEventListener('error', reject, {once:true});
  });
  let next = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    clearTimeout(entry.timer);
    data.error ? entry.reject(new Error(JSON.stringify(data.error))) : entry.resolve(data.result);
  });
  socket.addEventListener('close', () => {
    for (const e of pending.values()) { clearTimeout(e.timer); e.reject(new Error('Client closed')); }
    pending.clear();
  });
  function call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++next;
      const timer = setTimeout(() => {pending.delete(id); reject(new Error(`${method} timeout`));}, 8000);
      pending.set(id, {resolve, reject, timer});
      socket.send(JSON.stringify({id, method, params}));
    });
  }
  return {target, call, close: () => socket.close(), async evaluate(expression) {
    const result = await call('Runtime.evaluate', {expression, returnByValue:true, awaitPromise:true});
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }};
}
