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
    if (!('pinentry' in payload)) {
      console.error('Passphrase payload has no pinentry object.')
    } else if (!('features' in payload.pinentry)) {
      console.error('payload.pinentry.features does not exist')
    } else if (!('prompt' in payload.pinentry)) {
      console.error('payload.pinentry.prompt does not exist')
    }

    var props = payload.pinentry
    console.log(props)
    var pinentryWindow = new BrowserWindow({
      width: 500, height: 300,
      //resizable: false,
      fullscreen: false
    })
    pinentryWindow.hide()
    pinentryWindow.loadUrl(`file://${__dirname}/pinentry.wrapper.html`)

    ipc.on('needProps', function (event, arg) {
      event.sender.send('gotProps', props)
    })

    ipc.on('pinentryReady', function (event, arg) {
      pinentryWindow.show()
    })

    ipc.on('pinentryResult', function (event, arg) {
      response.result(arg)
      console.log(arg)
      console.log('Sent passphrase back')
      //pinentryWindow.close()
    })
  }
}
