"use strict";

const KBNM_HOST = "io.keybase.kbnm";

if (browser===undefined) {
  const browser = chrome;
}

// Set the default badge color
chrome.browserAction.setBadgeBackgroundColor({
  color: "#3dcc8e"
});

// Relay extension messages to native messages.
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (sender.tab) {
    // Reset the tab state with each query
    chrome.browserAction.setBadgeText({
      text: "",
      tabId: sender.tab.id,
    });
  }

  const isPassive = msg["method"] === "passivequery";
  if (isPassive) {
    // TODO: This will be a special method at some point, but for now we're
    // prototyping this feature with the normal query method.
    msg["method"] = "query";
  }

  chrome.runtime.sendNativeMessage(KBNM_HOST, msg, function(r) {
    if (r) {
      if (isPassive && r.status === "ok") {
        // Set badge
        chrome.browserAction.setBadgeText({
          text: "✓",
          tabId: sender.tab.id,
        });
      }
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
    chrome.tabs.create({url: "https://keybase.io/docs/extension"});
  }
});
chrome.contextMenus.create({
  title: "Keybase.io",
  contexts: ["browser_action", "page_action"],
  onclick: function() {
    chrome.tabs.create({url: "https://keybase.io/"});
  }
});


// Convert matchers into the declarative matching format
function generateConditions(matchers)  {
  // Generate pageMatchRules conditions
  const conditions = [];
  for (const m of matchers) {
    const cond = {
      pageUrl: { originAndPathMatches: m.originAndPathMatches },
    };
    if (m.css !== undefined) {
      cond.css = m.css;
    }
    conditions.push(new chrome.declarativeContent.PageStateMatcher(cond));
  }
  return conditions;
}


if (chrome.declarativeContent) {
  // Register browser_action icon state
  // Via: https://developer.chrome.com/extensions/examples/api/pageAction/pageaction_by_url/background.js
  // Not available in Firefox yet.
  const pageMatchRules = [
    {
      conditions: generateConditions(identityMatchers),
      actions: [
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
}
