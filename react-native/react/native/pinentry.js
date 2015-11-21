import engine from '../engine'
import pinentryListeners from './pinentry-listeners'

var initialized = false

export function init () {
  if (initialized) {
    throw new Error('pinentry was already initialized')
  }

  engine.listenOnConnect(() => {
    // TODO move this somewhere else
    engine.rpc('delegateUiCtl.registerSecretUI', {}, {}, (error, response) => {
      if (error != null) {
        console.error('error in registering secret ui: ', error)
      } else {
        console.log('Registered secret ui')
      }
    })
  })

  Object.keys(pinentryListeners).forEach(
    k => engine.listenGeneralIncomingRpc(k, pinentryListeners[k])
  )

  initialized = true
}
