"use strict";

const KBNM_HOST = "com.keybase.kbnm";

const KBNM = function() {
  this.host = KBNM_HOST;
  this.port = null;
}

KBNM.prototype.connect = function() {
  if (this.port != null) return;

  this.port = chrome.runtime.connectNative(this.host);
  this.port.onMessage.addListener(this._onReceive.bind(this));
  this.port.onDisconnect.addListener(this._onDisconnect.bind(this));
}

KBNM.prototype.send = function(msg) {
  this.port.postMessage(msg);
}

KBNM.prototype._onReceive = function(msg) {
  console.log("KBNM: received: ", msg, this);
}

KBNM.prototype._onDisconnect = function() {
  console.log("KBNM: disconnected: ", this);
  this.port = null;
}


chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  // FIXME: Switch to the persistent KBNM connection?
  chrome.runtime.sendNativeMessage(KBNM_HOST, msg, sendResponse);
});
