import BrowserWindow from 'browser-window'
import {ipcMain} from 'electron'
import {showDevTools} from '../local-debug.desktop'
import {statusCodes} from '../constants/types/go'

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
      width: 513, height: 250,
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

    const pinentryResize = (event, arg) => {
      if (pinentryWindow) {
        pinentryWindow.setSize(pinentryWindow.getSize()[0], arg)
      }
    }

    ipcMain.on('pinentryReady', pinentryReady)
    ipcMain.on('pinentryResize', pinentryResize)

    function unregister () {
      ipcMain.removeListener('pinentryNeedProps', pinentryNeedProps)
      ipcMain.removeListener('pinentryReady', pinentryReady)
      ipcMain.removeListener('pinentryResult', pinentryResult)
      ipcMain.removeListener('pinentryResize', pinentryResize)
    }

    function sendError (response) {
      response.error({
        code: statusCodes.SCCanceled,
        desc: 'Input canceled'
      })
    }

    const pinentryResult = (event, arg) => {
      if (!pinentryWindow || !response) {
        return
      }

      if ('error' in arg) {
        console.log('Sending error back')
        sendError(response)
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
          sendError(response)
        }

        unregister()
        pinentryWindow.removeListener('close', onClose)
        pinentryWindow = null
      }
    }
    pinentryWindow.on('close', onClose)
  }
}
