// Inside tracker we use an embedded Avatar which is connected.
import * as Constants from '../constants/tracker2'
import * as ConfigGen from '../actions/config-gen'
import * as Chat2Gen from '../actions/chat2-gen'
import * as Tracker2Gen from '../actions/tracker2-gen'
import Tracker from './index.desktop'
import {remoteConnect} from '../util/container'
import * as SafeElectron from '../util/safe-electron.desktop'
import {DeserializeProps} from './remote-serializer.desktop'

type OwnProps = {}

export default remoteConnect(
  (s: DeserializeProps) => s,
  dispatch => ({
    _onChat: (username: string) => {
      dispatch(ConfigGen.createShowMain())
      dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'tracker'}))
    },
    _onClose: (guiID: string) => {
      dispatch(Tracker2Gen.createCloseTracker({guiID}))
      // close immediately
      const w = SafeElectron.getCurrentWindowFromRemote()
      w && w.close()
    },
    _onFollow: (guiID: string) => dispatch(Tracker2Gen.createChangeFollow({follow: true, guiID})),
    _onIgnoreFor24Hours: (guiID: string) => dispatch(Tracker2Gen.createIgnore({guiID})),
    _onReload: (assertion: string) =>
      dispatch(
        Tracker2Gen.createLoad({
          assertion,
          forceDisplay: true,
          fromDaemon: false,
          guiID: Constants.generateGUIID(),
          ignoreCache: true,
          inTracker: true,
          reason: '',
        })
      ),
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    const {assertions, bio, darkMode, followThem, followersCount, followingCount, followsYou} = stateProps
    const {guiID, isYou, location, config, reason, state, teamShowcase} = stateProps
    const {username} = config
    return {
      assertionKeys: assertions ? [...assertions.keys()] : undefined,
      bio,
      darkMode,
      followThem,
      followersCount,
      followingCount,
      followsYou,
      guiID,
      isYou,
      location,
      onAccept: () => dispatchProps._onFollow(guiID),
      onChat: () => dispatchProps._onChat(username),
      onClose: () => dispatchProps._onClose(guiID),
      onFollow: () => dispatchProps._onFollow(guiID),
      onIgnoreFor24Hours: () => dispatchProps._onIgnoreFor24Hours(guiID),
      onReload: () => dispatchProps._onReload(username),
      reason,
      state,
      teamShowcase,
      username,
    }
  }
)(Tracker)
