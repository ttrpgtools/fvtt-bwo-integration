// @ts-check

/**
 * Keep it generic/opinion-free.
 * @typedef {*} BusEvent
 */

/**
 * A function that receives an event.
 * @template [T=BusEvent]
 * @callback Listener
 * @param {T} event
 * @returns {void}
 */

/**
 * A function that removes a previously registered listener.
 * @typedef {() => void} Unsubscribe
 */

/**
 * Minimal pub/sub with topic support (no reactivity, no Svelte deps)
 */
class Emitter {
  constructor() {
    /** @type {Map<string, Set<Listener>>} */
    this.map = new Map();
  }

  /**
   * Subscribe to a topic.
   * @template [T=BusEvent]
   * @param {string} topic
   * @param {Listener<T>} fn
   * @returns {Unsubscribe}
   */
  on(topic, fn) {
    let set = this.map.get(topic);
    if (!set) {
      set = new Set();
      this.map.set(topic, set);
    }
    set.add(fn);
    return () => {
      set && set.delete(fn);
    };
  }

  /**
   * Subscribe once to a topic, then auto-unsubscribe after the first event.
   * @template [T=BusEvent]
   * @param {string} topic
   * @param {Listener<T>} fn
   * @returns {Unsubscribe}
   */
  once(topic, fn) {
    const off = this.on(topic, (e) => {
      off();
      fn(e);
    });
    return off;
  }

  /**
   * Unsubscribe a specific listener from a topic.
   * @template [T=BusEvent]
   * @param {string} topic
   * @param {Listener<T>} fn
   * @returns {void}
   */
  off(topic, fn) {
    const set = /** @type {Set<Listener>|undefined} */ (this.map.get(topic));
    set?.delete(fn);
  }

  /**
   * Emit an event on a topic.
   * @template [T=BusEvent]
   * @param {string} topic
   * @param {T} e
   * @returns {void}
   */
  emit(topic, e) {
    const set = this.map.get(topic);
    if (!set || set.size === 0) return;
    for (const fn of Array.from(set)) {
      try {
        /** @type {Listener<T>} */ (fn)(e);
      } catch (err) {
        console.error("bus listener error", err);
      }
    }
  }

  /**
   * Clear listeners for a topic, or all topics if none provided.
   * @param {string} [topic]
   * @returns {void}
   */
  clear(topic) {
    if (topic) this.map.delete(topic);
    else this.map.clear();
  }
}

// Singleton bus for the app
export const bus = new Emitter();

/**
 * Options for send()
 * @typedef {Object} SendOptions
 * @property {boolean} [throwIfOffline]
 */

// Sender plumbing — set by the bridge when connected.
// Consumers call send() to go out over the MessagePort if present, else it no-ops/throws based on config.
/** @type {((data: any) => void) | null} */
let _post = null;

/**
 * Set or clear the outbound sender function.
 * Emits "bridge:sender" with { ready: boolean }.
 * @param {((data: any) => void) | null} fn
 * @returns {void}
 */
export function setSender(fn) {
  _post = fn;
  bus.emit("bridge:sender", { ready: !!fn });
}

/**
 * Send data over the current sender, if available.
 * @param {any} data
 * @param {SendOptions} [options]
 * @returns {boolean} true if sent, false if not (unless throwIfOffline)
 * @throws {Error} when no sender is set and options.throwIfOffline is true
 */
export function send(data, options) {
  if (_post) {
    _post(data);
    return true;
  }
  if (options?.throwIfOffline) throw new Error("bus: sender not ready");
  return false;
}

/**
 * Is the sender ready?
 * @returns {boolean}
 */
export function isReady() {
  return !!_post;
}
