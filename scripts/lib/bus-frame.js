// @ts-check

import { bus, setSender } from "./bus.js";

/**
 * @typedef {Object} BridgeOptions
 * @property {string} src                       // iframe URL to load
 * @property {string | null | undefined} [targetOrigin] // explicit target origin; defaults to new URL(src).origin
 * @property {HTMLElement} [parent]            // where to insert the iframe (default: document.body)
 * @property {string} [title]                  // iframe title (default: "bus-bridge")
 */

/**
 * Mount the bus bridge iframe and wire up postMessage plumbing.
 * Returns controls to disconnect/destroy (like Svelte's onDestroy).
 *
 * @param {BridgeOptions} options
 */
export function mountBusBridge(options) {
  const {
    src,
    targetOrigin = undefined,
    parent = document.body,
    title = "bus-bridge",
  } = options;

  /** @type {HTMLIFrameElement|null} */
  let iframeEl = document.createElement("iframe");
  /** @type {MessagePort|null} */
  let port = null;
  let loaded = false;

  iframeEl.src = src;
  iframeEl.title = title;
  iframeEl.style.display = "none";

  iframeEl.addEventListener("load", onIframeLoad);
  parent.appendChild(iframeEl);

  function connect() {
    if (!iframeEl || !loaded) return;
    const origin = targetOrigin ?? new URL(src, window.location.href).origin;

    // close previous
    try {
      port?.close?.();
    } catch {}

    const mc = new MessageChannel();
    port = mc.port1;

    // incoming -> emit to global bus
    port.onmessage = (e) => {
      const data = /** @type {any} */ (e.data || {});
      const { topic, payload } = data || {};
      if (topic) {
        bus.emit(topic, payload);
        bus.emit("bridge:message", { topic, payload });
      } else {
        bus.emit("bridge:message", data);
      }
    };

    try {
      port.start?.();
    } catch {}

    // parent -> iframe handshake
    try {
      iframeEl.contentWindow?.postMessage({ type: "connect" }, origin, [
        mc.port2,
      ]);
    } catch (err) {
      console.error("bridge handshake failed", err);
    }

    // outflow: set global sender
    setSender((data) => port?.postMessage(data));

    bus.emit("bridge:open", { origin });
  }

  function onIframeLoad() {
    loaded = true;
    connect();
  }

  function disconnect() {
    setSender(null);
    try {
      port?.close?.();
    } catch {}
    port = null;
    bus.emit("bridge:close", undefined);
  }

  function destroy() {
    disconnect();
    if (iframeEl) {
      iframeEl.removeEventListener("load", onIframeLoad);
      iframeEl.parentElement?.removeChild(iframeEl);
      iframeEl = null;
    }
  }

  /**
   * Update the bridge if src/targetOrigin change. Re-handshakes.
   * @param {Partial<Pick<BridgeOptions, "src" | "targetOrigin">>} next
   */
  function update(next) {
    const needsSrcChange = typeof next.src === "string" && next.src !== src;
    const newOrigin =
      next.targetOrigin !== undefined ? next.targetOrigin : targetOrigin;

    // Disconnect first to avoid dangling sender
    disconnect();

    if (needsSrcChange && iframeEl) {
      iframeEl.src = next.src ?? "";
      loaded = false; // wait for new load event
      // force reload if same URL but we still want to reconnect
      if (next.src === src)
        iframeEl.src =
          next.src + (next.src.includes("?") ? "&" : "?") + "_ts=" + Date.now();
    }

    // If the src didn't change, just reconnect with the new origin
    if (!needsSrcChange) {
      // eslint-disable-next-line no-unused-expressions
      (function reconnectWithNewOrigin() {
        // tiny defer so any caller state settles
        queueMicrotask(() => {
          connect();
        });
      })();
    }
  }

  return {
    /** The created iframe element (null after destroy). */
    get element() {
      return iframeEl;
    },
    /** Manually trigger reconnect (rarely needed). */
    connect,
    /** Disconnect the message port and clear sender. */
    disconnect,
    /** Remove the iframe and all listeners. */
    destroy,
    /** Update src/targetOrigin and re-handshake. */
    update,
  };
}
