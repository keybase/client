// Inside tracker we use an embedded Avatar which is connected.
import * as React from 'react'
import * as C from '@/constants'
import {useConfigState} from '@/stores/config'
import * as R from '@/constants/remote'
import * as RemoteGen from '../actions/remote-gen'
import type * as T from '@/constants/types'
import Tracker from './index.desktop'
import type {DeserializeProps} from './remote-serializer.desktop'
import KB2 from '@/util/electron.desktop'
import {useAvatarState} from '@/common-adapters/avatar/store'
import {useTrackerState} from '@/stores/tracker2'
import {useUsersState} from '@/stores/users'
import {useFollowerState} from '@/stores/followers'
import {useCurrentUserState} from '@/stores/current-user'
import {useDarkModeState} from '@/stores/darkmode'

const {closeWindow} = KB2.functions

const noDetails: T.Tracker.Details = {
  blocked: false,
  guiID: '',
  hidFromFollowers: false,
  reason: '',
  resetBrokeTrack: false,
  state: 'checking',
  username: '',
}

const RemoteContainer = (d: DeserializeProps) => {
  const {avatarRefreshCounter, darkMode, trackerUsername, tracker2, followers, following, username} = d
  const {httpSrvToken, httpSrvAddress, infoMap, blockMap} = d
  const {usernameToDetails} = tracker2
  const details = usernameToDetails.get(trackerUsername) ?? noDetails
  const {assertions, bio, followersCount, followingCount} = details
  const {guiID, location, reason, state: trackerState, teamShowcase} = details

  const replaceAvatar = useAvatarState(s => s.dispatch.replace)
  const replaceFollower = useFollowerState(s => s.dispatch.replace)
  const replaceUsers = useUsersState(s => s.dispatch.replace)
  const replaceCurrent = useCurrentUserState(s => s.dispatch.replaceUsername)
  const replaceHTTP = useConfigState(s => s.dispatch.setHTTPSrvInfo)
  const replaceTracker = useTrackerState(s => s.dispatch.replace)
  const setSystemDarkMode = useDarkModeState(s => s.dispatch.setSystemDarkMode)

  React.useEffect(() => {
    const id = setTimeout(() => {
      setSystemDarkMode(darkMode)
    }, 1)
    return () => {
      clearTimeout(id)
    }
  }, [setSystemDarkMode, darkMode])

  React.useEffect(() => {
    const id = setTimeout(() => {
      replaceAvatar(avatarRefreshCounter)
    }, 1)
    return () => {
      clearTimeout(id)
    }
  }, [replaceAvatar, avatarRefreshCounter])

  React.useEffect(() => {
    const id = setTimeout(() => {
      replaceFollower(followers, following)
    }, 1)
    return () => {
      clearTimeout(id)
    }
  }, [replaceFollower, followers, following])

  React.useEffect(() => {
    const id = setTimeout(() => {
      replaceUsers(infoMap, blockMap)
    }, 1)
    return () => {
      clearTimeout(id)
    }
  }, [replaceUsers, infoMap, blockMap])

  React.useEffect(() => {
    const id = setTimeout(() => {
      replaceCurrent(username)
    }, 1)
    return () => {
      clearTimeout(id)
    }
  }, [replaceCurrent, username])

  React.useEffect(() => {
    const id = setTimeout(() => {
      replaceHTTP(httpSrvAddress, httpSrvToken)
    }, 1)
    return () => {
      clearTimeout(id)
    }
  }, [replaceHTTP, httpSrvAddress, httpSrvToken])

  React.useEffect(() => {
    const id = setTimeout(() => {
      replaceTracker(tracker2.usernameToDetails)
    }, 1)
    return () => {
      clearTimeout(id)
    }
  }, [replaceTracker, tracker2.usernameToDetails])

  return (
    <Tracker
      assertionKeys={assertions ? [...assertions.keys()] : undefined}
      bio={bio}
      followersCount={followersCount}
      followingCount={followingCount}
      guiID={guiID}
      isYou={username === trackerUsername}
      location={location}
      onAccept={() => R.remoteDispatch(RemoteGen.createTrackerChangeFollow({follow: true, guiID}))}
      onChat={() => {
        R.remoteDispatch(RemoteGen.createShowMain())
        R.remoteDispatch(RemoteGen.createPreviewConversation({participant: trackerUsername}))
      }}
      onClose={() => {
        R.remoteDispatch(RemoteGen.createTrackerCloseTracker({guiID}))
        // close immediately
        closeWindow?.()
      }}
      onFollow={() => R.remoteDispatch(RemoteGen.createTrackerChangeFollow({follow: true, guiID}))}
      onIgnoreFor24Hours={() => R.remoteDispatch(RemoteGen.createTrackerIgnore({guiID}))}
      onReload={() =>
        R.remoteDispatch(
          RemoteGen.createTrackerLoad({
            assertion: trackerUsername,
            forceDisplay: true,
            fromDaemon: false,
            guiID: C.generateGUIID(),
            ignoreCache: true,
            inTracker: true,
            reason: '',
          })
        )
      }
      reason={reason}
      state={trackerState}
      teamShowcase={teamShowcase}
      trackerUsername={trackerUsername}
    />
  )
}
export default RemoteContainer
