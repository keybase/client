// @flow
import * as Constants from '../constants/notifications'
import * as Chat2Gen from './chat2-gen'
import * as ConfigGen from './config-gen'
import * as GitGen from './git-gen'
import * as NotificationsGen from './notifications-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import * as TeamsGen from './teams-gen'
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

  getEngine().setIncomingActionCreators(
    'keybase.1.NotifyBadges.badgeState',
    ({badgeState}, _: any, getState) => {
      const payload = Constants.badgeStateToBadges(badgeState, getState())
      return payload ? [NotificationsGen.createReceivedBadgeState(payload)] : null
    }
  )
}

// TODO fix this
const receivedBadgeState = (_: any, action: NotificationsGen.ReceivedBadgeStatePayload) => {
  const {
    conversations,
    newGitRepoGlobalUniqueIDs,
    newTeamNames,
    newTeamAccessRequests,
    teamsWithResetUsers,
  } = action.payload.badgeState
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
  ])
}

function* notificationsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.actionToAction(NotificationsGen.receivedBadgeState, receivedBadgeState)
  yield Saga.actionToAction(ConfigGen.setupEngineListeners, setupEngineListeners)
}

export default notificationsSaga
