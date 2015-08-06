import app = require('app');
import BrowserWindow = require('browser-window');
import configuration = require('./configuration');

import ipc = require('ipc');
import Client = require('./client');

export function run(mainUrl: string) {
  var config = configuration.load();
  global['configuration'] = config;

  var window = null;
  var client = null;

  function openNewWindow() {
    window = new BrowserWindow({width: 1200, height: 700}); // Very wide for dev tools
    window.loadUrl(mainUrl);

    window.toggleDevTools();

    client = new Client();

    // RPC call
    ipc.on('rpc', function(event, request) {
      console.log('Got request: ', request);
      client.invoke(request, function(response) {
        console.log('Replying: ', response);
        event.sender.send('rpc', response);
      });
    });

    // Console command
    ipc.on('command', function(event, arg) {
      event.sender.send('output', 'Running: ' + arg.text);

      client.run(arg.text, function(err, res) {
        if (err != null) {
          event.sender.send('error', err.desc);
        }
        if (res != null) {
          event.sender.send('output', JSON.stringify(res, null, 2));
        }
      });
    });

    const sockfile = config['app']['sockfile'];

    client.connect(sockfile, function(err, res) {
      window.webContents.send('output', 'Connected');
    });
  }

  app.on('ready', openNewWindow);
  app.on('window-all-closed', function () {
  });
}
