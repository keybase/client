import app = require('app');
import BrowserWindow = require('browser-window');
import configuration = require('./configuration');

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

    client = new Client(window);
    //global['client'] = client;

    const sockfile = config['app']['sockfile'];

    client.connect(sockfile, function(err, res) {
      window.webContents.send('output', 'Connected');
    });
  }

  app.on('ready', openNewWindow);
  app.on('window-all-closed', function () {
  });
}
