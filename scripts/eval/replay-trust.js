"use strict";

const builtInReplays = new WeakSet();

function markBuiltInReplay(replay) {
  builtInReplays.add(replay);
  return replay;
}

function isBuiltInReplay(replay) {
  return builtInReplays.has(replay);
}

module.exports = { isBuiltInReplay, markBuiltInReplay };
