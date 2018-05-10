// @flow
import * as Chat2Gen from './chat2-gen'
import * as ConfigGen from './config-gen'
import * as FsGen from './fs-gen'
import * as GitGen from './git-gen'
import * as LoginGen from './login-gen'
import * as NotificationsGen from './notifications-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import * as TeamsGen from './teams-gen'
import * as TrackerGen from './tracker-gen'
import * as UnlockFoldersGen from './unlock-folders-gen'
import engine, {Engine} from '../engine'
import logger from '../logger'
import {NotifyPopup} from '../native/notifications'
import {isMobile, isWindows} from '../constants/platform'
import {createSetupPeopleHandlers} from './people-gen'
import RNPN from 'react-native-push-notification'
import {kbfsNotification} from '../util/kbfs-notifications'
import {remote} from 'electron'
import dumpLogs from '../logger/dump-log-fs'
import {throttle} from 'lodash-es'

const throttledDispatch = throttle((dispatch, action) => dispatch(action), 1000, {
  leading: false,
  trailing: true,
})

const setUpSharedNotificationActions = (): void => {
  // Keep track of the last time we notified and ignore if it's the same
  let lastLoggedInNotifyUsername = null

  // We get a counter for badge state, if we get one that's less than what we've seen we toss it
  let lastBadgeStateVersion = -1

  engine().setIncomingActionCreators('keybase.1.NotifyBadges.badgeState', ({badgeState}, _, dispatch) => {
    if (badgeState.inboxVers < lastBadgeStateVersion) {
      logger.info(
        `Ignoring older badgeState, got ${badgeState.inboxVers} but have seen ${lastBadgeStateVersion}`
      )
      return
    }

    lastBadgeStateVersion = badgeState.inboxVers

    const actions = []
    const conversations = badgeState.conversations
    const totalChats = (conversations || []).reduce((total, c) => total + c.unreadMessages, 0)
    const action = NotificationsGen.createReceivedBadgeState({badgeState})
    if (totalChats > 0) {
      // Defer this slightly so we don't get flashing if we're quickly receiving and reading
      throttledDispatch(dispatch, action)
    } else {
      // If clearing go immediately
      actions.push(action)
    }

    return actions
  })

  engine().setIncomingActionCreators('keybase.1.NotifySession.loggedIn', ({username}, response) => {
    lastBadgeStateVersion = -1
    if (lastLoggedInNotifyUsername !== username) {
      lastLoggedInNotifyUsername = username
    }

    response && response.result()

    return [ConfigGen.createBootstrap({})]
  })

  engine().setIncomingActionCreators('keybase.1.NotifySession.loggedOut', (_, __, ___, getState) => {
    lastBadgeStateVersion = -1
    lastLoggedInNotifyUsername = null

    // Do we actually think we're logged in?
    if (getState().config.loggedIn) {
      return [LoginGen.createLogoutDone()]
    }
  })

  engine().setIncomingActionCreators('keybase.1.NotifyTracking.trackingChanged', ({username, isTracking}) => {
    return [ConfigGen.createUpdateFollowing({isTracking, username})]
  })
}

const setUpNativeNotificationActions = (): void => {
  engine().setIncomingActionCreators('keybase.1.NotifyBadges.badgeState', ({badgeState}) => {
    const count = (badgeState.conversations || []).reduce(
      (total, c) => (c.badgeCounts ? total + c.badgeCounts[`${RPCTypes.commonDeviceType.mobile}`] : total),
      0
    )

    RNPN.setApplicationIconBadgeNumber(count)
    if (count === 0) {
      RNPN.cancelAllLocalNotifications()
    }
  })
}

const setUpDesktopNotificationActions = (): void => {
  engine().setIncomingActionCreators('keybase.1.NotifyApp.exit', () => {
    console.log('App exit requested')
    return [remote.app.exit(0)]
  })

  engine().setIncomingActionCreators('keybase.1.NotifyFS.FSActivity', ({notification}, _, __, getState) => {
    return [kbfsNotification(notification, NotifyPopup, getState)]
  })

  engine().setIncomingActionCreators('keybase.1.NotifyPGP.pgpKeyInSecretStoreFile', () => {
    return [
      RPCTypes.pgpPgpStorageDismissRpcPromise().catch(err => {
        console.warn('Error in sending pgpPgpStorageDismissRpc:', err)
      }),
    ]
  })

  engine().setIncomingActionCreators('keybase.1.NotifyService.shutdown', () => {
    if (isWindows) {
      console.log('Quitting due to service shutdown')
      // Quit just the app, not the service
      return [remote.app.quit(true)]
    }
  })

  engine().setIncomingActionCreators(
    'keybase.1.NotifySession.clientOutOfDate',
    ({upgradeTo, upgradeURI, upgradeMsg}) => {
      const body = upgradeMsg || `Please update to ${upgradeTo} by going to ${upgradeURI}`
      return [NotifyPopup('Client out of date!', {body}, 60 * 60)]
    }
  )

  engine().setIncomingActionCreators('keybase.1.logsend.prepareLogsend', (_, response) => {
    return [dumpLogs().then(() => response && response.result())]
  })
}

const setUpNotificationActions = (): void => {
  setUpSharedNotificationActions()

  if (isMobile) {
    setUpNativeNotificationActions()
  } else {
    setUpDesktopNotificationActions()
  }
}

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
  yield Saga.put(FsGen.createRefreshLocalHTTPServerInfo())
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
