// @flow
import * as ChatGen from '../actions/chat-gen'
import * as Chat2Gen from '../actions/chat2-gen'
import * as FavoriteGen from '../actions/favorite-gen'
import * as GitGen from '../actions/git-gen'
import * as NotificationsGen from '../actions/notifications-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import * as TeamsGen from '../actions/teams-gen'
import * as TrackerGen from '../actions/tracker-gen'
import * as UnlockFoldersGen from './unlock-folders-gen'
import ListenerCreator from '../native/notification-listeners'
import engine, {Engine} from '../engine'
import logger from '../logger'
import {NotifyPopup} from '../native/notifications'
import {isMobile} from '../constants/platform'
import {createSetupPeopleHandlers} from './people-gen'

function* _listenSaga(): Saga.SagaGenerator<any, any> {
  const channels = {
    app: true,
    badges: true,
    chat: true,
    favorites: false,
    kbfs: !isMobile,
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
  }

  const engineInst: Engine = yield Saga.call(engine)
  yield Saga.call([engineInst, engineInst.listenOnConnect], 'setNotifications', () => {
    RPCTypes.notifyCtlSetNotificationsRpcPromise({channels}).catch(error => {
      if (error != null) {
        logger.warn('error in toggling notifications: ', error)
      }
    })
  })

  const setHandlers = (dispatch, getState) => {
    const listeners = ListenerCreator(dispatch, getState, NotifyPopup)
    Object.keys(listeners).forEach(key => {
      engine().setIncomingHandler(key, listeners[key])
    })
  }
  yield Saga.put(setHandlers)
  yield Saga.put(TrackerGen.createSetupTrackerHandlers())
}

function* _listenKBFSSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.put(FavoriteGen.createSetupKBFSChangedHandler())
  yield Saga.put(Chat2Gen.createSetupChatHandlers())
  yield Saga.put(ChatGen.createSetupChatHandlers())
  yield Saga.put(TeamsGen.createSetupTeamHandlers())
  yield Saga.put(UnlockFoldersGen.createRegisterRekeyListener())
  yield Saga.put(createSetupPeopleHandlers())
}

function _onRecievedBadgeState(action: NotificationsGen.ReceivedBadgeStatePayload) {
  const {
    conversations,
    newGitRepoGlobalUniqueIDs,
    newTeamNames,
    newTeamAccessRequests,
  } = action.payload.badgeState
  return Saga.sequentially([
    Saga.put(Chat2Gen.createBadgesUpdated({conversations: conversations || []})),
    Saga.put(GitGen.createBadgeAppForGit({ids: newGitRepoGlobalUniqueIDs || []})),
    Saga.put(
      TeamsGen.createBadgeAppForTeams({
        newTeamAccessRequests: newTeamAccessRequests || [],
        newTeamNames: newTeamNames || [],
      })
    ),
  ])
}

function* _listenNotifications(): Saga.SagaGenerator<any, any> {
  yield Saga.take(NotificationsGen.listenForNotifications)
  yield Saga.call(_listenSaga)
}

function* _listenForKBFSNotifications(): Saga.SagaGenerator<any, any> {
  yield Saga.take(NotificationsGen.listenForKBFSNotifications)
  yield Saga.call(_listenKBFSSaga)
}

function* notificationsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.fork(_listenNotifications)
  yield Saga.fork(_listenForKBFSNotifications)
  yield Saga.safeTakeLatestPure(NotificationsGen.receivedBadgeState, _onRecievedBadgeState)
}

export default notificationsSaga
