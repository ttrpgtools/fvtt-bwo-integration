
window.onmessage = windowReceive;

let chan;
let port1;
let connected = false;

function connect(win) {
  if (!connected && win) {
    chan = new MessageChannel();
    port1 = chan.port1;
    port1.onmessage = channelReceive;
    console.log('[BWO] Connecting channel to iframe as window data');
    win.postMessage('init', '*', [chan.port2]);
    connected = true;
  }
}

function channelReceive(ev) {
  if (ev && ev.data) {
    console.log('[BWO] Received channel data', ev.data);
    handlers.forEach(fn => fn(ev.data));
  }
}

function windowReceive(ev) {
  console.log('[BWO] Received window data', ev.data);
  if (ev.data.type === 'init') {
    connect(ev.source);
  }
}

const handlers = new Set();

export const channel = {
  send(msg) {
    console.log('[BWO] Sending channel data', msg);
    port1.postMessage(msg);
  },
  addListener(fn) {
    handlers.add(fn);
    return () => handlers.delete(fn);
  }
};
