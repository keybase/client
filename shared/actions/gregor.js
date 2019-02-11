// @flow
import logger from '../logger'
import * as ConfigGen from './config-gen'
import * as GregorGen from './gregor-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import engine from '../engine'

const setupEngineListeners = () => {
  // we get this with sessionID == 0 if we call openDialog
  engine().setIncomingCallMap({
    'keybase.1.gregorUI.pushOutOfBandMessages': ({oobm}) => {
      const filteredOOBM = (oobm || []).filter(Boolean)
      return filteredOOBM.length ? Saga.put(GregorGen.createPushOOBM({messages: filteredOOBM})) : null
    },
    'keybase.1.gregorUI.pushState': ({reason, state}) => {
      const items = state.items || []

      const goodState = items.reduce((arr, {md, item}) => {
        md && item && arr.push({item, md})
        return arr
      }, [])

      if (goodState.length !== items.length) {
        logger.warn('Lost some messages in filtering out nonNull gregor items')
      }
      return Saga.put(GregorGen.createPushState({reason, state: goodState}))
    },
    'keybase.1.reachability.reachabilityChanged': ({reachability}) =>
      Saga.callUntyped(function*() {
        const state = yield* Saga.selectState()
        if (state.config.loggedIn) {
          // Gregor reachability is only valid if we're logged in
          yield Saga.put(GregorGen.createUpdateReachable({reachable: reachability.reachable}))
        }
      }),
  })

  // Filter this firehose down to the system we care about: "git"
  // If ever you want to get OOBMs for a different system, then you need to enter it here.
  engine().actionOnConnect('registerGregorFirehose', () => {
    RPCTypes.delegateUiCtlRegisterGregorFirehoseFilteredRpcPromise({systems: ['git']})
      .then(response => {
        logger.info('Registered gregor listener')
      })
      .catch(error => {
        logger.warn('error in registering gregor listener: ', error)
      })
  })

  // The startReachability RPC call both starts and returns the current
  // reachability state. Then we'll get updates of changes from this state via reachabilityChanged.
  // This should be run on app start and service re-connect in case the service somehow crashed or was restarted manually.
  engine().actionOnConnect('startReachability', () => GregorGen.createStartReachability())
}

const startReachability = () =>
  RPCTypes.reachabilityStartReachabilityRpcPromise()
    .then(reachability => GregorGen.createUpdateReachable({reachable: reachability.reachable}))
    .catch(err => {
      logger.warn('error bootstrapping reachability: ', err)
    })

const checkReachability = () =>
  RPCTypes.reachabilityCheckReachabilityRpcPromise().then(reachability =>
    GregorGen.createUpdateReachable({reachable: reachability.reachable})
  )

const updateCategory = (_, action) =>
  RPCTypes.gregorUpdateCategoryRpcPromise({
    body: action.payload.body,
    category: action.payload.category,
    dtime: action.payload.dtime || {offset: 0, time: 0},
  })
    .then(() => {})
    .catch(() => {})

function* gregorSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction<GregorGen.UpdateCategoryPayload>(GregorGen.updateCategory, updateCategory)
  yield* Saga.chainAction<GregorGen.StartReachabilityPayload>(GregorGen.startReachability, startReachability)
  yield* Saga.chainAction<GregorGen.CheckReachabilityPayload>(GregorGen.checkReachability, checkReachability)
  yield* Saga.chainAction<ConfigGen.SetupEngineListenersPayload>(
    ConfigGen.setupEngineListeners,
    setupEngineListeners
  )
}

export default gregorSaga
