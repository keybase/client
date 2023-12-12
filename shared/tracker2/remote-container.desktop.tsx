// Inside tracker we use an embedded Avatar which is connected.
import * as React from 'react'
import * as C from '@/constants'
import * as R from '@/constants/remote'
import * as RemoteGen from '../actions/remote-gen'
import * as Constants from '@/constants/tracker2'
import type * as T from '@/constants/types'
import Tracker from './index.desktop'
import type {DeserializeProps} from './remote-serializer.desktop'
import KB2 from '@/util/electron.desktop'
import {useAvatarState} from '@/common-adapters/avatar-zus'

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
  const replaceFollower = C.useFollowerState(s => s.dispatch.replace)
  const replaceUsers = C.useUsersState(s => s.dispatch.replace)
  const replaceCurrent = C.useCurrentUserState(s => s.dispatch.replaceUsername)
  const replaceHTTP = C.useConfigState(s => s.dispatch.setHTTPSrvInfo)
  const replaceTracker = C.useTrackerState(s => s.dispatch.replace)

  React.useEffect(() => {
    const id = setTimeout(() => {
      replaceAvatar(avatarRefreshCounter)
      replaceFollower(followers, following)
      replaceUsers(infoMap, blockMap)
      replaceCurrent(username)
      replaceHTTP(httpSrvAddress, httpSrvToken)
      replaceTracker(tracker2.usernameToDetails)
    }, 1)
    return () => {
      clearTimeout(id)
    }
  }, [
    avatarRefreshCounter,
    blockMap,
    followers,
    following,
    httpSrvAddress,
    httpSrvToken,
    infoMap,
    replaceAvatar,
    replaceCurrent,
    replaceFollower,
    replaceHTTP,
    replaceTracker,
    replaceUsers,
    tracker2.usernameToDetails,
    username,
  ])

  return (
    <Tracker
      assertionKeys={assertions ? [...assertions.keys()] : undefined}
      bio={bio}
      darkMode={darkMode}
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
            guiID: Constants.generateGUIID(),
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
