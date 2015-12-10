import {BrowserWindow} from 'electron'
import {ipcMain} from 'electron'
import {showDevTools, isDev} from '../local-debug'
import path from 'path'

export default {
  'keybase.1.secretUi.getPassphrase': (payload, response) => {
    console.log('Asked for passphrase')

    // filtered features
    let features = {}
    for (const feature in payload.pinentry.features) {
      if (payload.pinentry.features[feature].allow) {
        features[feature] = payload.pinentry.features[feature]
      }
    }

    const props = {
      ...payload.pinentry,
      features
    }

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

    const hot = process.env.HOT === 'true'
    pinentryWindow.loadUrl(`file://${path.resolve('../react-native/react/native/pinentry.wrapper.html')}?hot=${!!hot}`)

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
        response.result({passphrase: arg.passphrase, ...arg.features})
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
