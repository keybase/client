"use strict";

const KBNM_HOST = "io.keybase.kbnm";

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  chrome.runtime.sendNativeMessage(KBNM_HOST, msg, sendResponse);
  return true; // Keep callback channel alive
});
