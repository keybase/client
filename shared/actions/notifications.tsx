import * as Constants from '../constants/notifications'
import * as ConfigGen from './config-gen'
import * as EngineGen from './engine-gen-gen'
import * as NotificationsGen from './notifications-gen'
import * as FsGen from './fs-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import * as Container from '../util/container'
import logger from '../logger'
import {isMobile} from '../constants/platform'

const setupNotifications = async () => {
  try {
    await RPCTypes.notifyCtlSetNotificationsRpcPromise({
      channels: {
        app: true,
        audit: true,
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
        kbfssubscription: true,
        keyfamily: false,
        paperkeys: false,
        pgp: true,
        reachability: true,
        runtimestats: true,
        service: true,
        session: true,
        team: true,
        teambot: false,
        tracking: true,
        users: true,
        wallet: true,
      },
    })
  } catch (error) {
    if (error != null) {
      logger.warn('error in toggling notifications: ', error)
    }
  }
}

const createBadgeState = (_: Container.TypedState, action: EngineGen.Keybase1NotifyBadgesBadgeStatePayload) =>
  NotificationsGen.createReceivedBadgeState({badgeState: action.payload.params.badgeState})

const receivedBadgeState = (
  state: Container.TypedState,
  action: NotificationsGen.ReceivedBadgeStatePayload
) => {
  const payload = Constants.badgeStateToBadgeCounts(action.payload.badgeState, state)
  return [
    payload && NotificationsGen.createSetBadgeCounts(payload),
    Constants.shouldTriggerTlfLoad(action.payload.badgeState) && FsGen.createFavoritesLoad(),
  ]
}

const receivedRootAuditError = (
  _: Container.TypedState,
  action: EngineGen.Keybase1NotifyAuditRootAuditErrorPayload
) =>
  ConfigGen.createGlobalError({
    globalError: new Error(`Keybase is buggy, please report this: ${action.payload.params.message}`),
  })

const receivedBoxAuditError = (
  _: Container.TypedState,
  action: EngineGen.Keybase1NotifyAuditBoxAuditErrorPayload
) =>
  ConfigGen.createGlobalError({
    globalError: new Error(
      `Keybase had a problem loading a team, please report this with \`keybase log send\`: ${
        action.payload.params.message
      }`
    ),
  })

function* notificationsSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction2(NotificationsGen.receivedBadgeState, receivedBadgeState)
  yield* Saga.chainAction2(EngineGen.keybase1NotifyAuditRootAuditError, receivedRootAuditError)
  yield* Saga.chainAction2(EngineGen.keybase1NotifyAuditBoxAuditError, receivedBoxAuditError)
  yield* Saga.chainAction2(EngineGen.connected, setupNotifications)
  yield* Saga.chainAction2(EngineGen.keybase1NotifyBadgesBadgeState, createBadgeState)
}

export default notificationsSaga
