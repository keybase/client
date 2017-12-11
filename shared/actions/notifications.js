// @flow
import * as GitGen from '../actions/git-gen'
import * as NotificationsGen from '../actions/notifications-gen'
import * as TrackerGen from '../actions/tracker-gen'
import * as FavoriteGen from '../actions/favorite-gen'
import * as RPCTypes from '../constants/types/flow-types'
import * as Saga from '../util/saga'
import ListenerCreator from '../native/notification-listeners'
import engine, {Engine} from '../engine'
import {NotifyPopup} from '../native/notifications'
import {call, put, take, fork} from 'redux-saga/effects'
import {isMobile} from '../constants/platform'
import {createBadgeAppForChat, createSetupChatHandlers} from './chat-gen'
import {createRegisterRekeyListener} from './unlock-folders-gen'
import {setupTeamHandlers, badgeAppForTeams} from './teams/creators'

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
    tracking: true,
    team: true,
    users: true,
  }

  const engineInst: Engine = yield call(engine)
  yield call([engineInst, engineInst.listenOnConnect], 'setNotifications', () => {
    RPCTypes.notifyCtlSetNotificationsRpcPromise({channels}).catch(error => {
      if (error != null) {
        console.warn('error in toggling notifications: ', error)
      }
    })
  })

  const setHandlers = (dispatch, getState) => {
    const listeners = ListenerCreator(dispatch, getState, NotifyPopup)
    Object.keys(listeners).forEach(key => {
      engine().setIncomingHandler(key, listeners[key])
    })
  }
  yield put(setHandlers)
  yield put(TrackerGen.createSetupTrackerHandlers())
}

function* _listenKBFSSaga(): Saga.SagaGenerator<any, any> {
  yield put(FavoriteGen.createSetupKBFSChangedHandler())
  yield put(createSetupChatHandlers())
  yield put(setupTeamHandlers())
  yield put(createRegisterRekeyListener())
}

function* _onRecievedBadgeState(
  action: NotificationsGen.ReceivedBadgeStatePayload
): Saga.SagaGenerator<any, any> {
  const {
    conversations,
    newGitRepoGlobalUniqueIDs,
    newTeamNames,
    newTeamAccessRequests,
  } = action.payload.badgeState
  yield put(createBadgeAppForChat({conversations: conversations || []}))
  yield put(GitGen.createBadgeAppForGit({ids: newGitRepoGlobalUniqueIDs || []}))
  yield put(badgeAppForTeams(newTeamNames || [], newTeamAccessRequests || []))
}

function* _listenNotifications(): Saga.SagaGenerator<any, any> {
  yield take(NotificationsGen.listenForNotifications)
  yield call(_listenSaga)
}

function* _listenForKBFSNotifications(): Saga.SagaGenerator<any, any> {
  yield take(NotificationsGen.listenForKBFSNotifications)
  yield call(_listenKBFSSaga)
}

function* notificationsSaga(): Saga.SagaGenerator<any, any> {
  yield fork(_listenNotifications)
  yield fork(_listenForKBFSNotifications)
  yield Saga.safeTakeLatest(NotificationsGen.receivedBadgeState, _onRecievedBadgeState)
}

export default notificationsSaga
