/* @flow */

import * as Constants from '../constants/pinentry'
import engine from '../engine'

import type {GUIEntryFeatures, GUIEntryArg} from '../constants/types/flow-types'
import type {NewPinentryAction, RegisterPinentryListenerAction} from '../constants/pinentry'

import type {Dispatch} from '../constants/types/flux'

export function registerPinentryListener (): (dispatch: Dispatch) => void {
  return dispatch => {
    engine.listenOnConnect(() => {
      engine.rpc('delegateUiCtl.registerSecretUI', {}, {}, (error, response) => {
        if (error != null) {
          console.error('error in registering secret ui: ', error)
        } else {
          console.log('Registered secret ui')
        }
      })
    })

    dispatch(({
      type: Constants.registerPinentryListener,
      payload: {started: true}
    }: RegisterPinentryListenerAction))

    const pinentryListeners = pinentryListenersCreator(dispatch)
    Object.keys(pinentryListeners).forEach(
      k => engine.listenGeneralIncomingRpc(k, pinentryListeners[k])
    )
  }
}

export function onSubmit (sessionID: number, passphrase: string, features: GUIEntryFeatures): (dispatch: Dispatch) => void {
  console.log(`Passphrase submitted: ${passphrase}`)
  console.log(features)
  let result = {passphrase: passphrase}
  for (const feature in features) {
    result[feature] = features[feature]
  }
  return dispatch => {
    // TODO: send result to someone who's listening
    dispatch({type: Constants.onSubmit})
  }
}

export function onCancel (sessionID: number): (dipatch: Dispatch) => void {
  console.log('Pinentry dialog canceled')
  return dispatch => {
    // TODO: send result to someone who's listening
    dispatch({type: Constants.onCancel, payload: {sessionID}})
  }
}

export function sessionDecoratedActions (sessionID: number): {[key: string]: Function} {
  return {
    onSubmit: onSubmit.bind(null, sessionID),
    onCancel: onCancel.bind(null, sessionID),
  }
}

function pinentryListenersCreator (dispatch: Dispatch) {
  return {
    'keybase.1.secretUi.getPassphrase': (payload: {pinentry: GUIEntryArg, sessionID: number}, response) => {
      console.log('Asked for passphrase')

      // filtered features
      // TODO, remove the filtered features. Simplifies types
      // let features = {}
      // for (const feature in payload.pinentry.features) {
      //   if (payload.pinentry.features[feature].allow) {
      //     features[feature] = payload.pinentry.features[feature]
      //   }
      // }

      const {prompt, submitLabel, cancelLabel, windowTitle, retryLabel, features} = payload.pinentry
      const sessionID = payload.sessionID

      dispatch(({
        type: Constants.newPinentry,
        payload: {
          sessionID,
          features,
          prompt,
          submitLabel,
          cancelLabel,
          windowTitle,
          retryLabel
        }
      }: NewPinentryAction))

      // let pinentryWindow = new BrowserWindow({
      //   width: 513, height: 230 + 20 /* TEMP workaround for header mouse clicks in osx */,
      //   resizable: true,
      //   fullscreen: false,
      //   show: false,
      //   frame: false
      // })

      // if (showDevTools) {
      //   pinentryWindow.toggleDevTools()
      // }

//       pinentryWindow.loadUrl(`file://${__dirname}/pinentry.wrapper.html`)
// 
//       const pinentryNeedProps = (event, arg) => {
//         // Is this the pinentry window we just created?
//         if (pinentryWindow && pinentryWindow.webContents === event.sender) {
//           event.sender.send('pinentryGotProps', props)
//         }
//       }
//       ipcMain.on('pinentryNeedProps', pinentryNeedProps)
// 
//       const pinentryReady = (event, arg) => {
//         if (pinentryWindow) {
//           pinentryWindow.show()
//         }
//       }
//       ipcMain.on('pinentryReady', pinentryReady)
// 
//       function unregister () {
//         ipcMain.removeListener('pinentryNeedProps', pinentryNeedProps)
//         ipcMain.removeListener('pinentryReady', pinentryReady)
//         ipcMain.removeListener('pinentryResult', pinentryResult)
//       }
// 
//       const pinentryResult = (event, arg) => {
//         if (!pinentryWindow || !response) {
//           return
//         }
// 
//         if ('error' in arg) {
//           response.error(arg)
//         } else {
//           response.result({passphrase: arg.passphrase, ...arg.features})
//           console.log('Sent passphrase back')
//         }
// 
//         response = null
//         unregister()
//         pinentryWindow.close()
//         pinentryWindow = null
//       }
// 
//       ipcMain.on('pinentryResult', pinentryResult)
// 
//       const onClose = () => {
//         if (pinentryWindow) {
//           if (response) {
//             response.error({error: 'User canceled'})
//           }
// 
//           unregister()
//           pinentryWindow.removeListener('close', onClose)
//           pinentryWindow = null
//         }
//       }
//       pinentryWindow.on('close', onClose)
    }
  }
}
