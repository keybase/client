"use strict";

const KBNM_HOST = "io.keybase.kbnm";

// Relay extension messages to native messages.
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
  contexts: ["browser_action", "page_action"],
  onclick: function() {
    chrome.tabs.create({url: "https://keybase.io/reddit-crypto"});
  }
});
chrome.contextMenus.create({
  title: "Keybase.io",
  contexts: ["browser_action", "page_action"],
  onclick: function() {
    chrome.tabs.create({url: "https://keybase.io/"});
  }
});


// Register browser_action icon state
// Via: https://developer.chrome.com/extensions/examples/api/pageAction/pageaction_by_url/background.js
const pageMatchRules = [
  {
    conditions: [
      // Match user pages that Keybase recognizes
      // Extra css matchers added to avoid matching on non-profile URLs like /about or 404's
      new chrome.declarativeContent.PageStateMatcher({
          pageUrl: { urlMatches: '\.reddit.com\/user\/[\\w-]+$' },
      }),
      new chrome.declarativeContent.PageStateMatcher({
          pageUrl: { urlMatches: 'twitter.com/[\\w]+$' },
          css: ['body.ProfilePage']
      }),
      new chrome.declarativeContent.PageStateMatcher({
          pageUrl: { urlMatches: 'github.com/[\\w]+$' },
          css: ['body.page-profile']
      }),
      new chrome.declarativeContent.PageStateMatcher({
          pageUrl: { urlMatches: 'news.ycombinator.com/user' },
          css: ['html[op="user"]']
      })
    ],
    actions: [
      new chrome.declarativeContent.ShowPageAction(),
      new chrome.declarativeContent.SetIcon({
        path: "images/icon-keybase-logo-16@2x.png"
      })
    ]
  }
];
chrome.runtime.onInstalled.addListener(function() {
  chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
    chrome.declarativeContent.onPageChanged.addRules(pageMatchRules);
  });
});
