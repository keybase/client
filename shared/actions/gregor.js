// @flow
import logger from '../logger'
import * as ConfigGen from './config-gen'
import * as GregorGen from './gregor-gen'
import * as EngineGen from './engine-gen-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import engine from '../engine'

const pushOutOfBandMessages = (_, action) => {
  const {oobm} = action.payload.params
  const filteredOOBM = (oobm || []).filter(Boolean)
  if (filteredOOBM.length) {
    return GregorGen.createPushOOBM({messages: filteredOOBM})
  }
}

const pushState = (_, action) => {
  const {reason, state} = action.payload.params
  const items = state.items || []

  const goodState = items.reduce((arr, {md, item}) => {
    md && item && arr.push({item, md})
    return arr
  }, [])

  if (goodState.length !== items.length) {
    logger.warn('Lost some messages in filtering out nonNull gregor items')
  }
  return GregorGen.createPushState({reason, state: goodState})
}

// Gregor reachability is only valid if we're logged in
const reachabilityChanged = (state, action) =>
  state.config.loggedIn &&
  GregorGen.createUpdateReachable({reachable: action.payload.params.reachability.reachable})

const setupEngineListeners = () => {
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
  yield* Saga.chainAction<EngineGen.Keybase1GregorUIPushOutOfBandMessagesPayload>(
    EngineGen.keybase1GregorUIPushOutOfBandMessages,
    pushOutOfBandMessages
  )
  yield* Saga.chainAction<EngineGen.Keybase1GregorUIPushStatePayload>(
    EngineGen.keybase1GregorUIPushState,
    pushState
  )
  yield* Saga.chainAction<EngineGen.Keybase1ReachabilityReachabilityChangedPayload>(
    EngineGen.keybase1ReachabilityReachabilityChanged,
    reachabilityChanged
  )
}

export default gregorSaga
