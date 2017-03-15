"use strict";

const KBNM_HOST = "com.keybase.kbnm";

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
}

KBNM.prototype.send = function(msg, cb) {
  const client = this.counter++;
  this.clients[client] = cb;

  this.connect();
  this.port.postMessage({
    "client": client,
    "message": msg
  });
}

KBNM.prototype._onReceive = function(msg) {
  console.log("KBNM: received: ", msg, this);
  const client = msg["client"];
  const cb = this.clients[client];
  if (cb === undefined) return;
  cb(msg);
}

KBNM.prototype._onDisconnect = function() {
  console.log("KBNM: disconnected: ", this);
  this.port = null;
}


const channel = new KBNM();

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  channel.send(msg, sendResponse);
});

chrome.runtime.onConnect.addListener(function(port) {
  port.onMessage.addListener(function(msg) {
      channel.send(msg, function(r) {
        port.postMessage(r);
        port.disconnect();
      });
  });
});
