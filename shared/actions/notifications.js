// @flow
import * as Constants from '../constants/notifications'
import * as ConfigGen from './config-gen'
import * as NotificationsGen from './notifications-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import {getEngine} from '../engine'
import logger from '../logger'
import {isMobile} from '../constants/platform'
import type {TypedState} from '../constants/reducer'

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
    kbfsrequest: !isMobile,
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

const receivedBadgeState = (state: TypedState, action: NotificationsGen.ReceivedBadgeStatePayload) => {
  const payload = Constants.badgeStateToBadges(action.payload.badgeState, state)
  return payload ? Saga.put(NotificationsGen.createSetAppBadgeState(payload)) : null
}

function* notificationsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.actionToAction(NotificationsGen.receivedBadgeState, receivedBadgeState)
  yield Saga.actionToAction(ConfigGen.setupEngineListeners, setupEngineListeners)
}

export default notificationsSaga
