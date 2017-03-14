"use strict";

const KBNM_HOST = "com.keybase.kbnm";

const KBNM = function() {
  this.host = KBNM_HOST;
  this.port = null;
}

KBNM.prototype.connect = function() {
  if (this.port != null) return;

  this.port = chrome.runtime.connectNative(this.port);
  port.onMessage.addListener(this.receive);
  port.onDisconnect.addListener(this.disconnect);
}

KBNM.prototype.send = function(msg) {
  this.port.postMessage(msg);
}

KBNM.prototype.receive = function(msg) {
  console.log("KBNM: received: ", msg);
}

KBNM.prototype.disconnect = function() {
  this.port = null;
}


chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  chrome.runtime.sendNativeMessage(KBNM_HOST, msg, sendResponse);
});
