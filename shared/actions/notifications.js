// @flow
import * as Constants from '../constants/notifications'
import * as ConfigGen from './config-gen'
import * as NotificationsGen from './notifications-gen'
import * as FsGen from './fs-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import {getEngine} from '../engine'
import logger from '../logger'
import {isMobile} from '../constants/platform'

const setupEngineListeners = () => {
  const channels = {
    app: true,
    badges: true,
    chat: true,
    chatattachments: true,
    chatdev: false,
    chatkbfsedits: false,
    deviceclone: false,
    ephemeral: false,
    favorites: false,
    kbfs: true,
    kbfsdesktop: !isMobile,
    kbfslegacy: false,
    kbfsrequest: false,
    keyfamily: false,
    paperkeys: false,
    pgp: true,
    reachability: true,
    service: true,
    session: true,
    team: true,
    tracking: true,
    users: true,
    wallet: true,
  }

  getEngine().actionOnConnect('setNotifications', () => {
    RPCTypes.notifyCtlSetNotificationsRpcPromise({channels}).catch(error => {
      if (error != null) {
        logger.warn('error in toggling notifications: ', error)
      }
    })
  })

  getEngine().setIncomingCallMap({
    'keybase.1.NotifyBadges.badgeState': ({badgeState}) =>
      Saga.put(NotificationsGen.createReceivedBadgeState({badgeState})),
  })
}

const receivedBadgeState = (state, action) => {
  const payload = Constants.badgeStateToBadgeCounts(action.payload.badgeState, state)
  return [
    payload && NotificationsGen.createSetBadgeCounts(payload),
    Constants.shouldTriggerTlfLoad(action.payload.badgeState) && FsGen.createFavoritesLoad(),
  ]
}

function* notificationsSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction<NotificationsGen.ReceivedBadgeStatePayload>(
    NotificationsGen.receivedBadgeState,
    receivedBadgeState
  )
  yield* Saga.chainAction<ConfigGen.SetupEngineListenersPayload>(
    ConfigGen.setupEngineListeners,
    setupEngineListeners
  )
}

export default notificationsSaga
