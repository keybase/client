"use strict";

const KBNM_HOST = "io.keybase.kbnm";

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  chrome.runtime.sendNativeMessage(KBNM_HOST, msg, function(r) {
    if (r) {
      return sendResponse(r);
    }
    const err = chrome.runtime.lastError;
    debugger;
    if (err) {
      return sendResponse({
        "status": "error",
        "message": err.message,
        "result": {
          "lastError": err,
          "lastMessage": msg
        }
      });
    }
    return sendResponse({
      "status": "error",
      "message": "no response from native message",
      "result": {
        "lastMessage": msg,
      }
    });
  });
  return true; // Keep callback channel alive
});
