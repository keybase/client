// @flow
import * as I from 'immutable'
import * as Chat2Gen from './chat2-gen'
import * as FsGen from './fs-gen'
import * as GitGen from './git-gen'
import * as NotificationsGen from './notifications-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import * as TeamsGen from './teams-gen'
import * as TrackerGen from './tracker-gen'
import * as UnlockFoldersGen from './unlock-folders-gen'
import * as FsTypes from '../constants/types/fs'
import * as TeamsConstants from '../constants/teams'
import setUpNotificationActions from '../native/notification-listeners'
import engine, {Engine} from '../engine'
import logger from '../logger'
import {isMobile} from '../constants/platform'
import {createSetupPeopleHandlers} from './people-gen'

function* _listenSaga(): Saga.SagaGenerator<any, any> {
  const channels = {
    app: true,
    badges: true,
    chat: true,
    ephemeral: false,
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
    chatkbfsedits: false,
  }

  const engineInst: Engine = yield Saga.call(engine)
  yield Saga.call([engineInst, engineInst.listenOnConnect], 'setNotifications', () => {
    RPCTypes.notifyCtlSetNotificationsRpcPromise({channels}).catch(error => {
      if (error != null) {
        logger.warn('error in toggling notifications: ', error)
      }
    })
  })

  setUpNotificationActions()

  yield Saga.put(TrackerGen.createSetupTrackerHandlers())
}

function* _listenKBFSSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.put(FsGen.createSetupFSHandlers())
  yield Saga.put(Chat2Gen.createSetupChatHandlers())
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
    teamsWithResetUsers,
  } = action.payload.badgeState
  const tlfs: Map<FsTypes.Path, FsTypes.ResetMetadata> = (teamsWithResetUsers || []).reduce((filtered, item: $ReadOnly<{id: Buffer, teamname: string, username: string}>) => {
    const path = FsTypes.stringToPath(`/keybase/team/${item.teamname}`)
    let team = filtered.get(path)
    if (!team) {
      team = {
        badgeIDKey: TeamsConstants.resetUserBadgeIDToKey(item.id),
        name: item.teamname,
        visibility: 'team',
        resetParticipants: [],
      }
      filtered.set(path, team)
    }
    team.resetParticipants.push(item.username)
    return filtered
  }, new Map())
  return Saga.sequentially([
    Saga.put(Chat2Gen.createBadgesUpdated({conversations: conversations || []})),
    Saga.put(GitGen.createBadgeAppForGit({ids: newGitRepoGlobalUniqueIDs || []})),
    Saga.put(
      TeamsGen.createBadgeAppForTeams({
        newTeamAccessRequests: newTeamAccessRequests || [],
        newTeamNames: newTeamNames || [],
        teamsWithResetUsers: teamsWithResetUsers || [],
      })
    ),
    Saga.put(FsGen.createLoadResetsResult({tlfs: I.Map(tlfs)})),
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
