import BrowserWindow from 'browser-window'
import {ipcMain} from 'electron'
import {showDevTools} from '../local-debug.desktop'

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
    let pinentryWindow = new BrowserWindow({
      width: 513, height: 230 + 20 /* TEMP workaround for header mouse clicks in osx */,
      resizable: true,
      fullscreen: false,
      show: false,
      frame: false
    })

    if (showDevTools) {
      pinentryWindow.toggleDevTools()
    }

    pinentryWindow.loadUrl(`file://${__dirname}/pinentry.wrapper.html`)

    const pinentryNeedProps = (event, arg) => {
      // Is this the pinentry window we just created?
      if (pinentryWindow && pinentryWindow.webContents === event.sender) {
        event.sender.send('pinentryGotProps', props)
      }
    }
    ipcMain.on('pinentryNeedProps', pinentryNeedProps)

    const pinentryReady = (event, arg) => {
      if (pinentryWindow) {
        pinentryWindow.show()
      }
    }
    ipcMain.on('pinentryReady', pinentryReady)

    function unregister () {
      ipcMain.removeListener('pinentryNeedProps', pinentryNeedProps)
      ipcMain.removeListener('pinentryReady', pinentryReady)
      ipcMain.removeListener('pinentryResult', pinentryResult)
    }

    const pinentryResult = (event, arg) => {
      if (!pinentryWindow || !response) {
        return
      }

      if ('error' in arg) {
        response.error(arg)
      } else {
        let result = {passphrase: arg.passphrase}

        if ('secretStorage' in arg) {
          result.storeSecret = arg.secretStorage
        } else {
          result.storeSecret = false
        }
        /* TODO something nice like this */
        /*
        for (const feature in arg.features) {
          result[feature] = arg.features[feature]
        }
        */
        response.result(result)
        console.log('Sent passphrase back')
      }

      response = null
      unregister()
      pinentryWindow.close()
      pinentryWindow = null
    }

    ipcMain.on('pinentryResult', pinentryResult)

    const onClose = () => {
      if (pinentryWindow) {
        if (response) {
          response.error({error: 'User canceled'})
        }

        unregister()
        pinentryWindow.removeListener('close', onClose)
        pinentryWindow = null
      }
    }
    pinentryWindow.on('close', onClose)
  }
}
