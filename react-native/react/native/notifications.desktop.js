'use strict'
/* @flow */

import engine from '../engine'
import Server from '../engine/server'

export function enableNotifications () {
  console.log('setting up notification')

  const param = {
    channels: {
      session: true,
      users: true
    }
  }

  engine.listenOnConnect(() => {
    engine.rpc('notifyCtl.setNotifications', param, {}, (error, response) => {
      if (error != null) {
        console.error('error in toggling notifications: ', error)
      } else {
        console.log('Enabled Notifications')
      }
    })

    // TODO move this somewhere else
    engine.rpc('delegateUiCtl.registerIdentifyUI', {}, {}, (error, response) => {
      if (error != null) {
        console.error('error in registering identify ui: ', error)
      } else {
        console.log('Registered identify ui')
      }
    })

    type IdentifyKey = any

    const identifyUi = {
      start: (params: {sessionID: number, username: string}) => {
        console.log('starting identify ui server instance')
      },
      displayKey: (params: {sessionID: number, key: IdentifyKey}) => {
        console.log('displaying key', params)
      },
      reportLastTrack: (params: {sessionID: number, track: any}) => {
        console.log('Report last track', params)
      },
      launchNetworkChecks: (params: {sessionID: number, identity: any, user: any}) => {
        console.log('network checks', params)
      },
      displayTrackStatement: (params: {sessionID: number, stmt: string}) => {
        console.log('display track statements', params)
      },

      finishWebProofCheck: (params: {sessionID: number, rp: any, lcr: any}) => {
        console.log('finish web proof', params)
      },
      finishSocialProofCheck: (params: {sessionID: number, rp: any, lcr: any}) => {
        console.log('finish social proof', params)
      },
      displayCryptocurrency: (params: {sessionID: number, c: any}) => {
        console.log('finish displayCryptocurrency', params)
      },
      confirm: (params: {sessionID: number, outcome: any}): bool => {
        console.log('confirm', params)
        return true
      },
      finish: (params: {sessionID: number}) => {
        console.log('finish', params)
      }
    }

    const identifyUIServer = new Server(
      engine,
      'keybase.1.identifyUi.delegateIdentifyUI',
      'keybase.1.identifyUi.finish',
      (params) => { return { keybase: { 1: { identifyUi } } } }
    )

    identifyUIServer.listen()
  })
}

const listeners = {
  'keybase.1.NotifySession.loggedOut': logoutNotification
}

// Returns function that should be called to unbind listeners
export function bindNotifications () {
  Object.keys(listeners).forEach(k => engine.listenGeneralIncomingRpc(k, listeners[k]))
  return () => {
    Object.keys(listeners).forEach(k => engine.unlistenGeneralIncomingRpc(k, listeners[k]))
  }
}

function logoutNotification (param) {
  new Notification('Logged Out') // eslint-disable-line
}
