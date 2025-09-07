import { bus } from "./lib/bus.js";
import { mountBusBridge } from "./lib/bus-frame.js";
const SCOPE = "bwo-integration";
const CHAR_ID = "bwo-character-id";
const DieClass = foundry?.dice?.terms?.Die ?? Die;
async function handleMessage(msg) {
  const actor = game.actors.find((a) => a.name === msg.name && a.isOwner);
  if (actor) {
    actor.setFlag(SCOPE, CHAR_ID, msg.id);
  }
  if (msg.type === "roll") {
    const roll = Roll.fromTerms([
      new DieClass({
        number: 1,
        faces: msg.dice[0],
        results: [{ result: msg.result, active: true }],
      }),
    ]);
    const chatData = {};
    if (msg.label) {
      chatData.flavor = (actor ? "" : `[${msg.name}] `) + msg.label;
    }
    chatData.speaker = ChatMessage.getSpeaker(actor ? { actor } : {});
    roll.toMessage(chatData, { create: true });
  }
}

Hooks.once("init", async function () {});

Hooks.once("ready", async function () {
  // Roll.fromData()
  bus.on("bwo:roll", handleMessage);
  bus.on("bridge:open", ({ origin }) => console.log("bridge open", origin));
  mountBusBridge({ src: "https://magic-portal.divora.world" });
});
