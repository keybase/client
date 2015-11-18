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
    // Here's where we should spawn a BrowserWindow with the Pinentry component,
    // passing in props.  For now, it's stubbed out.

    ipc.on('sendProps', function (event, arg) {
      console.log('received sendProps')
      event.sender.send('sendingProps', props)
    })
    var pinentryWindow = new BrowserWindow({
      width: 500, height: 300,
      //resizable: false,
      fullscreen: false
    })
    console.log(pinentryWindow)
    pinentryWindow.loadUrl(`file://${__dirname}/pinentry.wrapper.html`)
    pinentryWindow.show()

    const reply = {
      'passphrase': 'fooBARbaz',
      'storeSecret': false
    }
    response.result(reply)
    console.log('Sent passphrase back')
  }
}
