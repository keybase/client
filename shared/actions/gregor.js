// @flow
import logger from '../logger'
import * as ConfigGen from './config-gen'
import * as GregorGen from './gregor-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import engine from '../engine'

const setupEngineListeners = () => {
  // we get this with sessionID == 0 if we call openDialog
  engine().setIncomingActionCreators('keybase.1.gregorUI.pushState', ({reason, state}, response) => {
    response && response.result()
    const items = state.items || []

    const goodState = items.reduce((arr, {md, item}) => {
      md && item && arr.push({item, md})
      return arr
    }, [])

    if (goodState.length !== items.length) {
      logger.warn('Lost some messages in filtering out nonNull gregor items')
    }
    return GregorGen.createPushState({reason, state: goodState})
  })

  engine().setIncomingActionCreators('keybase.1.gregorUI.pushOutOfBandMessages', ({oobm}, response) => {
    response && response.result()
    const filteredOOBM = (oobm || []).filter(Boolean)
    return filteredOOBM.length ? GregorGen.createPushOOBM({messages: filteredOOBM}) : null
  })

  engine().setIncomingActionCreators(
    'keybase.1.reachability.reachabilityChanged',
    ({reachability}, response, _, getState) => {
      if (getState().config.loggedIn) {
        // Gregor reachability is only valid if we're logged in
        return GregorGen.createUpdateReachable({reachable: reachability.reachable})
      }
    }
  )

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

const updateCategory = (_: any, action: GregorGen.UpdateCategoryPayload) =>
  RPCTypes.gregorUpdateCategoryRpcPromise({
    body: action.payload.body,
    category: action.payload.category,
    dtime: action.payload.dtime || {offset: 0, time: 0},
  })
    .then(() => {})
    .catch(() => {})

function* gregorSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.actionToPromise(GregorGen.updateCategory, updateCategory)
  yield Saga.actionToPromise(GregorGen.startReachability, startReachability)
  yield Saga.actionToPromise(GregorGen.checkReachability, checkReachability)
  yield Saga.actionToAction(ConfigGen.setupEngineListeners, setupEngineListeners)
}

export default gregorSaga
