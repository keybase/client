// Inside tracker we use an embedded Avatar which is connected.
import * as C from '../constants'
import * as R from '../constants/remote'
import * as RemoteGen from '../actions/remote-gen'
import * as Constants from '../constants/tracker2'
import type * as Types from '../constants/types/tracker2'
import Tracker from './index.desktop'
import type {DeserializeProps} from './remote-serializer.desktop'
import KB2 from '../util/electron.desktop'
import {useAvatarState} from '../common-adapters/avatar-zus'

const {closeWindow} = KB2.functions

const noDetails: Types.Details = {
  blocked: false,
  guiID: '',
  hidFromFollowers: false,
  reason: '',
  resetBrokeTrack: false,
  state: 'checking',
  username: '',
}

const RemoteContainer = () => {
  const state = R.useRemoteStore<DeserializeProps>()
  const {avatarRefreshCounter, darkMode, trackerUsername, tracker2, followers, following, username} = state
  const {httpSrvToken, httpSrvAddress, infoMap, blockMap} = state
  const {usernameToDetails} = tracker2
  const details = usernameToDetails.get(trackerUsername) ?? noDetails
  const {assertions, bio, followersCount, followingCount} = details
  const {guiID, location, reason, state: trackerState, teamShowcase} = details
  useAvatarState(s => s.dispatch.replace)(avatarRefreshCounter)
  C.useFollowerState(s => s.dispatch.replace)(followers, following)
  C.useUsersState(s => s.dispatch.replace)(infoMap, blockMap)
  C.useCurrentUserState(s => s.dispatch.replaceUsername)(username)
  C.useConfigState(s => s.dispatch.setHTTPSrvInfo)(httpSrvAddress, httpSrvToken)
  C.useTrackerState(s => s.dispatch.replace)(tracker2.usernameToDetails)

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
