// @flow
// Inside tracker we use an embedded Avatar which is connected. This assumes its connected and uses immutable stuff.
// We convert the over-the-wire plain json to immutable in the remote-store helper
import * as ConfigGen from '../../actions/config-gen'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Profile2Gen from '../../actions/profile2-gen'
import * as I from 'immutable'
// import * as TeamsGen from '../actions/teams-gen'
import * as Types from '../../constants/types/profile2'
// import * as Profile2Gen from '../actions/profile2-gen'
import Tracker from './index.desktop'
import {remoteConnect} from '../../util/container'

type OwnProps = {||}
type State = {|
  assertions: ?I.Map<string, Types.Assertion>,
  bio: ?string,
  followThem: ?boolean,
  followersCount: ?number,
  followingCount: ?number,
  followsYou: ?boolean,
  guiID: string,
  location: ?string,
  publishedTeams: ?$ReadOnlyArray<string>,
  reason: string,
  state: Types.DetailsState,
  username: string,
|}

// Props are handled by remote-proxy.desktop.js
const mapDispatchToProps = dispatch => ({
  _onAccept: (guiID: string) => {},
  _onChat: (username: string) => {
    dispatch(ConfigGen.createShowMain())
    dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'tracker'}))
  },
  _onClose: (guiID: string) => dispatch(Profile2Gen.createCloseTracker({guiID})),
  _onFollow: (guiID: string) => {},
  _onIgnoreFor24Hours: (guiID: string) => {},
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  assertionKeys: stateProps.assertions ? stateProps.assertions.keySeq().toArray() : null,
  bio: stateProps.bio,
  followThem: stateProps.followThem,
  followersCount: stateProps.followersCount,
  followingCount: stateProps.followingCount,
  followsYou: stateProps.followsYou,
  guiID: stateProps.guiID,
  location: stateProps.location,
  publishedTeams: stateProps.publishedTeams,
  reason: stateProps.reason,
  state: stateProps.state,
  username: stateProps.username,
  onAccept: () => dispatchProps._onAccept(stateProps.guiID),
  onChat: () => dispatchProps._onChat(stateProps.username),
  onClose: () => dispatchProps._onClose(stateProps.guiID),
  onFollow: () => dispatchProps._onFollow(stateProps.guiID),
  onIgnoreFor24Hours: () => dispatchProps._onIgnoreFor24Hours(stateProps.guiID),
})

export default remoteConnect<OwnProps, State, _, _, _, _>(s => s, mapDispatchToProps, mergeProps)(Tracker)
