// @flow
// Inside tracker we use an embedded Avatar which is connected. This assumes its connected and uses immutable stuff.
// We convert the over-the-wire plain json to immutable in the remote-store helper
import * as Constants from '../constants/tracker2'
import * as ConfigGen from '../actions/config-gen'
import * as Chat2Gen from '../actions/chat2-gen'
import * as Tracker2Gen from '../actions/tracker2-gen'
import * as I from 'immutable'
import * as Types from '../constants/types/tracker2'
import Tracker from './index.desktop'
import {remoteConnect} from '../util/container'
import * as SafeElectron from '../util/safe-electron.desktop'

type OwnProps = {||}
type State = {|
  assertions: ?I.Map<string, Types.Assertion>,
  bio: ?string,
  followThem: ?boolean,
  followersCount: ?number,
  followingCount: ?number,
  followsYou: ?boolean,
  guiID: string,
  isYou: boolean,
  location: ?string,
  reason: string,
  state: Types.DetailsState,
  teamShowcase: ?I.List<Types.TeamShowcase>,
  username: string,
|}

// Props are handled by remote-proxy.desktop.js
const mapDispatchToProps = dispatch => ({
  _onChat: (username: string) => {
    dispatch(ConfigGen.createShowMain())
    dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'tracker'}))
  },
  _onClose: (guiID: string) => {
    // close immediately
    const w = SafeElectron.getCurrentWindowFromRemote()
    w && w.close()
    dispatch(Tracker2Gen.createCloseTracker({guiID}))
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
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  assertionKeys: stateProps.assertions ? stateProps.assertions.keySeq().toArray() : null,
  bio: stateProps.bio,
  followThem: stateProps.followThem,
  followersCount: stateProps.followersCount,
  followingCount: stateProps.followingCount,
  followsYou: stateProps.followsYou,
  guiID: stateProps.guiID,
  isYou: stateProps.isYou,
  location: stateProps.location,
  onAccept: () => dispatchProps._onFollow(stateProps.guiID),
  onChat: () => dispatchProps._onChat(stateProps.username),
  onClose: () => dispatchProps._onClose(stateProps.guiID),
  onFollow: () => dispatchProps._onFollow(stateProps.guiID),
  onIgnoreFor24Hours: () => dispatchProps._onIgnoreFor24Hours(stateProps.guiID),
  onReload: () => dispatchProps._onReload(stateProps.username),
  reason: stateProps.reason,
  state: stateProps.state,
  teamShowcase: stateProps.teamShowcase ? stateProps.teamShowcase.map(t => t.toObject()).toArray() : null,
  username: stateProps.username,
})

export default remoteConnect<OwnProps, State, _, _, _, _>(s => s, mapDispatchToProps, mergeProps)(Tracker)
