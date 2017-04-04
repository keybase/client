"use strict";

const KBNM_HOST = "io.keybase.kbnm";

// KBNM sits between the NativeMessage port and manages disjoint async
// messages to the callers. Response callbacks from NativeMessages are
// not in the same context as this background context, so the callback
// needs to be disjoint.
const KBNM = function() {
  this.host = KBNM_HOST;
  this.port = null;

  this.counter = 0;
  this.clients = {};
}

KBNM.prototype.connect = function() {
  if (this.port != null) return;

  this.port = chrome.runtime.connectNative(this.host);
  this.port.onMessage.addListener(this._onReceive.bind(this));
  this.port.onDisconnect.addListener(this._onDisconnect.bind(this));
}

KBNM.prototype.disconnect = function() {
  this.port.disconnect();
  this.port = null;
  this.clients = {};
}

KBNM.prototype.send = function(msg, cb) {
  const client = this.counter++;
  this.clients[client] = cb;

  msg["client"] = client;

  this.connect();
  this.port.postMessage(msg);
}

KBNM.prototype._onReceive = function(msg) {
  const client = msg["client"];
  const cb = this.clients[client];
  if (cb === undefined) return;
  cb(msg);
  delete this.clients[client];
}

KBNM.prototype._onDisconnect = function() {
  this.port = null;
}


const channel = new KBNM();

// This does not work:
//   chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
//     chrome.runtime.sendNativeMessage(msg, sendResponse);
//   });
// Because the sendNativeMessage callback can't call sendResponse from the outer clojure.

chrome.runtime.onConnect.addListener(function(port) {
  port.onMessage.addListener(function(msg) {
      channel.send(msg, function(r) {
        port.postMessage(r);
        port.disconnect();
      });
  });
});
