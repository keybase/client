// @flow
import logger from '../logger'
import * as I from 'immutable'
import * as Chat2Gen from './chat2-gen'
import * as KBFSGen from './kbfs-gen'
import * as FsGen from './fs-gen'
import * as ConfigGen from './config-gen'
import * as TeamsGen from './teams-gen'
import * as LoginGen from './login-gen'
import * as Constants from '../constants/config'
import * as GregorCreators from '../actions/gregor'
import * as NotificationsGen from '../actions/notifications-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import * as PinentryGen from '../actions/pinentry-gen'
import * as SignupGen from '../actions/signup-gen'
import engine from '../engine'
import {RouteStateStorage} from '../actions/route-state-storage'
import {createConfigurePush} from './push-gen'
import {createGetPeopleData} from './people-gen'
import {defaultNumFollowSuggestions} from '../constants/people'
import {getAppState, setAppState} from './platform-specific'
import {isMobile, isSimulator} from '../constants/platform'
import {loggedInSelector} from '../constants/selectors'
import {type AsyncAction} from '../constants/types/flux'
import {type TypedState} from '../constants/reducer'

const maxAvatarsPerLoad = 50
// TODO convert to sagas

isMobile &&
  module.hot &&
  module.hot.accept(() => {
    logger.info('accepted update in actions/config')
  })

const waitForKBFS = (): AsyncAction => dispatch =>
  new Promise((resolve, reject) => {
    let timedOut = false

    // The rpc timeout doesn't seem to work correctly (not that we should trust that anyways) so we have our own local timeout
    // TODO clean this up with sagas!
    let timer = setTimeout(() => {
      timedOut = true
      reject(new Error("Waited for KBFS client, but it wasn't found"))
    }, 10 * 1000)

    RPCTypes.configWaitForClientRpcPromise({
      clientType: RPCTypes.commonClientType.kbfs,
      timeout: 10.0,
    })
      .then(found => {
        clearTimeout(timer)
        if (timedOut) {
          return
        }
        if (!found) {
          reject(new Error("Waited for KBFS client, but it wasn't not found"))
          return
        }
        resolve()
      })
      .catch(error => {
        clearTimeout(timer)
        reject(error)
      })
  })

// Must be an action which returns a promise so put.resolve continues to wait and work
// TODO could change this to use Take and make it 2 steps instead of using put.resolve()
const getExtendedStatus = (): AsyncAction => dispatch => {
  return new Promise((resolve, reject) => {
    RPCTypes.configGetExtendedStatusRpcPromise()
      .then(extendedConfig => {
        dispatch(ConfigGen.createExtendedConfigLoaded({extendedConfig}))
        resolve(extendedConfig)
      })
      .catch(error => {
        reject(error)
      })
  })
}

const registerListeners = (): AsyncAction => dispatch => {
  dispatch(GregorCreators.listenForNativeReachabilityEvents)
  dispatch(GregorCreators.registerGregorListeners())
  dispatch(GregorCreators.registerReachability())
  dispatch(PinentryGen.createRegisterPinentryListener())
}

const _retryBootstrap = () =>
  Saga.sequentially([Saga.put(ConfigGen.createBootstrapRetry()), Saga.put(ConfigGen.createBootstrap({}))])

// TODO: It's unfortunate that we have these globals. Ideally,
// bootstrap would be a method on an object.
let bootstrapSetup = false
const routeStateStorage = new RouteStateStorage()

// Until bootstrap is sagaized
function _bootstrap({payload}: ConfigGen.BootstrapPayload) {
  return Saga.put(bootstrap(payload))
}

const bootstrap = (opts: $PropertyType<ConfigGen.BootstrapPayload, 'payload'>): AsyncAction => (
  dispatch,
  getState
) => {
  const readyForBootstrap = getState().config.readyForBootstrap
  if (!readyForBootstrap) {
    logger.warn('Not ready for bootstrap/connect')
    return
  }

  if (!bootstrapSetup) {
    bootstrapSetup = true
    logger.info('[bootstrap] registered bootstrap')
    engine().listenOnConnect('bootstrap', () => {
      dispatch(ConfigGen.createDaemonError({daemonError: null}))
      dispatch(GregorCreators.checkReachabilityOnConnect())
      logger.info('[bootstrap] bootstrapping on connect')
      dispatch(ConfigGen.createBootstrap({}))
    })
    dispatch(registerListeners())
  } else {
    logger.info('[bootstrap] performing bootstrap...')
    Promise.all([
      dispatch(getBootstrapStatus()),
      dispatch(waitForKBFS()),
      dispatch(KBFSGen.createFuseStatus()),
      dispatch(FsGen.createFuseStatus()),
    ])
      .then(() => {
        dispatch(ConfigGen.createBootstrapSuccess())
        engine().listenOnDisconnect('daemonError', () => {
          dispatch(ConfigGen.createDaemonError({daemonError: new Error('Disconnected')}))
          logger.flush()
        })
        dispatch(NotificationsGen.createListenForKBFSNotifications())
        if (!opts.isReconnect) {
          dispatch(async (): Promise<*> => {
            await dispatch(LoginGen.createNavBasedOnLoginAndInitialState())
            if (getState().config.loggedIn) {
              // If we're logged in, restore any saved route state and
              // then nav again based on it.
              // load people tab info on startup as well
              // also load the teamlist for auxiliary information around the app
              await dispatch(routeStateStorage.load)
              await dispatch(LoginGen.createNavBasedOnLoginAndInitialState())
              await dispatch(TeamsGen.createGetTeams())
              await dispatch(
                createGetPeopleData({
                  markViewed: false,
                  numFollowSuggestionsWanted: defaultNumFollowSuggestions,
                })
              )
            }
          })
          dispatch(SignupGen.createResetSignup())
        }
      })
      .catch(error => {
        logger.warn('[bootstrap] error bootstrapping: ', error)
        const triesRemaining = getState().config.bootstrapTriesRemaining
        dispatch(ConfigGen.createBootstrapAttemptFailed())
        if (triesRemaining > 0) {
          const retryDelay = Constants.bootstrapRetryDelay / triesRemaining
          logger.info(`[bootstrap] resetting engine in ${retryDelay / 1000}s (${triesRemaining} tries left)`)
          setTimeout(() => engine().reset(), retryDelay)
        } else {
          logger.error('[bootstrap] exhausted bootstrap retries')
          dispatch(ConfigGen.createBootstrapFailed())
        }
        logger.flush()
      })
  }
}

// Until routeStateStorage is sagaized.
function* _clearRouteState(action: ConfigGen.ClearRouteStatePayload) {
  yield Saga.put(routeStateStorage.clear)
}

// Until routeStateStorage is sagaized.
function _persistRouteState(action: ConfigGen.PersistRouteStatePayload) {
  return Saga.put(routeStateStorage.store)
}

const getBootstrapStatus = (): AsyncAction => dispatch =>
  new Promise((resolve, reject) => {
    RPCTypes.configGetBootstrapStatusRpcPromise()
      .then(bootstrapStatus => {
        dispatch(ConfigGen.createBootstrapStatusLoaded(bootstrapStatus))
        resolve(bootstrapStatus)
      })
      .catch(error => {
        reject(error)
      })
  })

function _bootstrapSuccess(action: ConfigGen.BootstrapSuccessPayload, state: TypedState) {
  if (!isMobile) {
    return null
  }

  const actions = []
  const pushLoaded = state.config.pushLoaded
  const loggedIn = loggedInSelector(state)
  if (!pushLoaded && loggedIn) {
    if (!isSimulator) {
      actions.push(Saga.put(createConfigurePush()))
    }
    actions.push(Saga.put(ConfigGen.createPushLoaded({pushLoaded: true})))
  }

  return Saga.sequentially(actions)
}

type AvatarHelperAction = {payload: {names: Array<string>, endpoint: string, key: string}}
function _loadAvatarHelper(action: AvatarHelperAction) {
  const {names, endpoint, key} = action.payload
  return Saga.sequentially([
    Saga.call(RPCTypes.apiserverGetRpcPromise, {
      args: [{key, value: names.join(',')}, {key: 'formats', value: 'square_360,square_200,square_40'}],
      endpoint,
    }),
    Promise.resolve(names),
  ])
}

function _loadAvatarHelperError(error: Error, action: AvatarHelperAction) {
  if (error.code === RPCTypes.constantsStatusCode.scinputerror) {
    throw error
  }
  // ignore all other errors
}

function _loadAvatarHelperSuccess([response: {body: string}, names]) {
  const nameToUrlMap = JSON.parse(response.body).pictures.reduce((map, picMap, idx) => {
    const name = names[idx]
    const urlMap = {
      ...(picMap['square_200'] ? {'200': picMap['square_200']} : null),
      ...(picMap['square_360'] ? {'360': picMap['square_360']} : null),
      ...(picMap['square_40'] ? {'40': picMap['square_40']} : null),
    }
    map[name] = urlMap
    return map
  }, {})

  return Saga.put(ConfigGen.createLoadedAvatars({nameToUrlMap}))
}

function _validUsernames(names: Array<string>) {
  return names.filter(name => !!name.match(/^([.a-z0-9_-]{1,1000})$/i))
}

let _avatarsToLoad = I.Set()
function* _loadAvatars(action: ConfigGen.LoadAvatarsPayload) {
  const usernames = _validUsernames(action.payload.usernames)
  // store it and wait, once our timer is up we pull any and run it
  _avatarsToLoad = _avatarsToLoad.concat(usernames)

  while (_avatarsToLoad.size > 0) {
    yield Saga.call(Saga.delay, 200)

    const names = _avatarsToLoad.take(maxAvatarsPerLoad).toArray()
    _avatarsToLoad = _avatarsToLoad.skip(maxAvatarsPerLoad)

    if (names.length) {
      yield Saga.put({
        payload: {endpoint: 'image/username_pic_lookups', key: 'usernames', names},
        type: '_loadAvatarHelper',
      })
    }
  }
}

let _teamAvatarsToLoad = I.Set()
function* _loadTeamAvatars(action: ConfigGen.LoadTeamAvatarsPayload) {
  const teamnames = _validUsernames(action.payload.teamnames)
  _teamAvatarsToLoad = _teamAvatarsToLoad.concat(teamnames)

  while (_teamAvatarsToLoad.size > 0) {
    // store it and wait, once our timer is up we pull any and run it
    yield Saga.call(Saga.delay, 200)

    const names = _teamAvatarsToLoad.take(maxAvatarsPerLoad).toArray()
    _teamAvatarsToLoad = _teamAvatarsToLoad.skip(maxAvatarsPerLoad)

    if (names.length) {
      yield Saga.put({
        payload: {endpoint: 'image/team_avatar_lookups', key: 'team_names', names},
        type: '_loadAvatarHelper',
      })
    }
  }
}

function _setOpenAtLogin(action: ConfigGen.SetOpenAtLoginPayload) {
  if (action.payload.writeFile) {
    setAppState({openAtLogin: action.payload.open})
  }
}

function* _getAppState(): Generator<any, void, any> {
  const state = yield Saga.call(getAppState)
  if (state) {
    yield Saga.put(ConfigGen.createSetOpenAtLogin({open: state.openAtLogin, writeFile: false}))
  }
}

const _setStartedDueToPush = () => Saga.put(ConfigGen.createSetStartedDueToPush())

function* configSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(ConfigGen.bootstrapSuccess, _bootstrapSuccess)
  yield Saga.safeTakeEveryPure(ConfigGen.bootstrap, _bootstrap)
  yield Saga.safeTakeEveryPure(ConfigGen.clearRouteState, _clearRouteState)
  yield Saga.safeTakeEveryPure(ConfigGen.persistRouteState, _persistRouteState)
  yield Saga.safeTakeEveryPure(ConfigGen.retryBootstrap, _retryBootstrap)
  yield Saga.safeTakeEvery(ConfigGen.loadAvatars, _loadAvatars)
  yield Saga.safeTakeEvery(ConfigGen.loadTeamAvatars, _loadTeamAvatars)
  yield Saga.safeTakeEveryPure(
    '_loadAvatarHelper',
    _loadAvatarHelper,
    _loadAvatarHelperSuccess,
    _loadAvatarHelperError
  )
  yield Saga.safeTakeEveryPure(ConfigGen.setOpenAtLogin, _setOpenAtLogin)
  yield Saga.safeTakeEveryPure(Chat2Gen.selectConversationDueToPush, _setStartedDueToPush)
  yield Saga.fork(_getAppState)
}

export {getExtendedStatus}
export default configSaga
