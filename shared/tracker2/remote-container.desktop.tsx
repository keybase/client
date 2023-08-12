// Inside tracker we use an embedded Avatar which is connected.
import * as C from '../constants'
import * as RemoteGen from '../actions/remote-gen'
import * as Constants from '../constants/tracker2'
import * as UsersConstants from '../constants/users'
import * as ConfigConstants from '../constants/config'
import * as Container from '../util/container'
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
  const state = Container.useRemoteStore<DeserializeProps>()
  const dispatch = Container.useDispatch()
  const {avatarRefreshCounter, darkMode, trackerUsername, tracker2, followers, following, username} = state
  const {httpSrvToken, httpSrvAddress, infoMap, blockMap} = state
  const {usernameToDetails} = tracker2
  const details = usernameToDetails.get(trackerUsername) ?? noDetails
  const {assertions, bio, followersCount, followingCount} = details
  const {guiID, location, reason, state: trackerState, teamShowcase} = details
  useAvatarState(s => s.dispatch.replace)(avatarRefreshCounter)
  C.useFollowerState(s => s.dispatch.replace)(followers, following)
  UsersConstants.useState(s => s.dispatch.replace)(infoMap, blockMap)
  C.useCurrentUserState(s => s.dispatch.replaceUsername)(username)
  ConfigConstants.useConfigState(s => s.dispatch.setHTTPSrvInfo)(httpSrvAddress, httpSrvToken)
  Constants.useState(s => s.dispatch.replace)(tracker2.usernameToDetails)

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
      onAccept={() => dispatch(RemoteGen.createTrackerChangeFollow({follow: true, guiID}))}
      onChat={() => {
        dispatch(RemoteGen.createShowMain())
        dispatch(RemoteGen.createPreviewConversation({participant: trackerUsername}))
      }}
      onClose={() => {
        dispatch(RemoteGen.createTrackerCloseTracker({guiID}))
        // close immediately
        closeWindow?.()
      }}
      onFollow={() => dispatch(RemoteGen.createTrackerChangeFollow({follow: true, guiID}))}
      onIgnoreFor24Hours={() => dispatch(RemoteGen.createTrackerIgnore({guiID}))}
      onReload={() =>
        dispatch(
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
