/* @flow */

import BrowserWindow from 'browser-window'
import ipc from 'ipc'

export default {
  'keybase.1.secretUi.getPassphrase': (payload, response) => {
    console.log('Asked for passphrase')
    /*
    Payload looks like:
    { pinentry:
      { features:
        { secretStorage:
          { allow: true, label: 'store your test passphrase' }
        },
        prompt: 'Enter a test passphrase',
        retryLabel: '',
        windowTitle: 'Keybase Test Passphrase' },
        sessionID: 0
      }
    }
    */
    const props = payload.pinentry
    var pinentryWindow = new BrowserWindow({
      width: 500, height: 300,
      resizable: false,
      fullscreen: false
    })
    pinentryWindow.hide()
    pinentryWindow.loadUrl(`file://${__dirname}/pinentry.wrapper.html`)

    ipc.on('pinentryNeedProps', function (event, arg) {
      event.sender.send('pinentryGotProps', props)
    })

    ipc.on('pinentryReady', function (event, arg) {
      pinentryWindow.show()
    })

    ipc.on('pinentryResult', function (event, arg) {
      if ('error' in arg) {
        response.error(arg)
      } else if ('secretStorage' in arg) {
        // The core expects a GetPassphraseArg back.
        arg.storeSecret = arg.secretStorage
        response.result(arg)
        console.log(arg)
        console.log('Sent passphrase back')
      }
      pinentryWindow.close()
    })
  }
}
