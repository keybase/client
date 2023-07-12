// Inside tracker we use an embedded Avatar which is connected.
import * as Chat2Gen from '../actions/chat2-gen'
import * as ConfigGen from '../actions/config-gen'
import * as Constants from '../constants/tracker2'
import * as ConfigConstants from '../constants/config'
import * as Followers from '../constants/followers'
import * as Container from '../util/container'
import * as Tracker2Gen from '../actions/tracker2-gen'
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
  const {httpSrvToken, httpSrvAddress} = state
  const {usernameToDetails} = tracker2
  const details = usernameToDetails.get(trackerUsername) ?? noDetails
  const {assertions, bio, followersCount, followingCount} = details
  const {guiID, location, reason, state: trackerState, teamShowcase} = details
  useAvatarState(s => s.dispatch.replace)(avatarRefreshCounter)
  Followers.useFollowerState(s => s.dispatch.replace)(followers, following)
  ConfigConstants.useCurrentUserState(s => s.dispatch.replaceUsername)(username)
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
      onAccept={() => dispatch(Tracker2Gen.createChangeFollow({follow: true, guiID}))}
      onChat={() => {
        dispatch(ConfigGen.createShowMain())
        dispatch(Chat2Gen.createPreviewConversation({participants: [trackerUsername], reason: 'tracker'}))
      }}
      onClose={() => {
        dispatch(Tracker2Gen.createCloseTracker({guiID}))
        // close immediately
        closeWindow?.()
      }}
      onFollow={() => dispatch(Tracker2Gen.createChangeFollow({follow: true, guiID}))}
      onIgnoreFor24Hours={() => dispatch(Tracker2Gen.createIgnore({guiID}))}
      onReload={() =>
        dispatch(
          Tracker2Gen.createLoad({
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
