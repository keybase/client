// @flow
// Inside tracker we use an embedded Avatar which is connected. This assumes its connected and uses immutable stuff.
// We convert the over-the-wire plain json to immutable in the remote-store helper
// import * as ConfigGen from '../actions/config-gen'
// import * as Chat2Gen from '../actions/chat2-gen'
// import * as ProfileGen from '../actions/profile-gen'
// import * as TeamsGen from '../actions/teams-gen'
import * as Types from '../../constants/types/profile2'
// import * as Profile2Gen from '../actions/profile2-gen'
import Tracker from './index.desktop'
import {remoteConnect} from '../../util/container'

type OwnProps = {||}
type State = {|
  assertions: Array<string>,
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
const mapDispatchToProps = (dispatch, {teamname}) => ({
  // TODO
  onAccept: () => {},
  onChat: () => {},
  onClose: () => {},
  onFollow: () => {},
  onIgnoreFor24Hours: () => {},
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  ...ownProps,
})

export default remoteConnect<OwnProps, State, _, _, _, _>(s => s, mapDispatchToProps, mergeProps)(Tracker)
