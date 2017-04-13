"use strict";

const KBNM_HOST = "io.keybase.kbnm";

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  chrome.runtime.sendNativeMessage(KBNM_HOST, msg, function(r) {
    if (r) {
      return sendResponse(r);
    }
    const err = chrome.runtime.lastError;
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

// Add context menu options for the browser icon
chrome.contextMenus.create({
  title: "Getting started...",
  contexts: ["browser_action"],
  onclick: function() {
    chrome.tabs.create({url: "https://keybase.io/reddit-crypto"});
  }
});
chrome.contextMenus.create({
  title: "Keybase.io",
  contexts: ["browser_action"],
  onclick: function() {
    chrome.tabs.create({url: "https://keybase.io/"});
  }
});
