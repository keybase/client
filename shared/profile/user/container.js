// @flow
import * as Chat2Gen from '../../actions/chat2-gen'
import * as ConfigGen from '../../actions/config-gen'
import * as Constants from '../../constants/tracker2'
import * as Container from '../../util/container'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import Profile2 from '.'
import type {RouteProps} from '../../route-tree/render-route'

type OwnProps = RouteProps<{username: string}, {}>

const mapStateToProps = (state, ownProps) => {
  const username = ownProps.routeProps.get('username')
  const d = state.tracker2.usernameToDetails.get(username, Constants.noDetails)

  return {
    _assertions: d.assertions,
    _teamShowcase: d.teamShowcase,
    bio: d.bio,
    followThem: Constants.followThem(state, username),
    followersCount: d.followersCount,
    followingCount: d.followingCount,
    followsYou: Constants.followsYou(state, username),
    guiID: d.guiID,
    location: d.location,
    reason: d.reason,
    state: d.state,
    username,
  }
}
const mapDispatchToProps = (dispatch, ownProps) => ({
  _onChat: (username: string) => {
    dispatch(ConfigGen.createShowMain())
    dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'tracker'}))
  },
  _onClose: (guiID: string) => dispatch(Tracker2Gen.createCloseTracker({guiID})),
  _onFollow: (guiID: string, follow: boolean) => dispatch(Tracker2Gen.createChangeFollow({follow, guiID})),
  _onIgnoreFor24Hours: (guiID: string) => dispatch(Tracker2Gen.createIgnore({guiID})),
  _onReload: (assertion: string) =>
    dispatch(
      Tracker2Gen.createLoad({
        assertion,
        guiID: Constants.generateGUIID(),
        ignoreCache: true,
        reason: '',
      })
    ),
  onBack: () => dispatch(ownProps.navigateUp()),
})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  assertionKeys: stateProps._assertions ? stateProps._assertions.keySeq().toArray() : null,
  bio: stateProps.bio,
  followThem: stateProps.followThem,
  followersCount: stateProps.followersCount,
  followingCount: stateProps.followingCount,
  followsYou: stateProps.followsYou,
  guiID: stateProps.guiID,
  location: stateProps.location,
  onAccept: () => dispatchProps._onFollow(stateProps.guiID, true),
  onBack: () => dispatchProps.onBack(),
  onChat: () => dispatchProps._onChat(stateProps.username),
  onClose: () => dispatchProps._onClose(stateProps.guiID),
  onFollow: () => dispatchProps._onFollow(stateProps.guiID, true),
  onIgnoreFor24Hours: () => dispatchProps._onIgnoreFor24Hours(stateProps.guiID),
  onReload: () => dispatchProps._onReload(stateProps.username),
  onUnfollow: () => dispatchProps._onFollow(stateProps.guiID, false),
  reason: stateProps.reason,
  state: stateProps.state,
  teamShowcase: stateProps._teamShowcase ? stateProps._teamShowcase.map(t => t.toObject()).toArray() : null,
  username: stateProps.username,
})

export default Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'Profile2'
)(Profile2)
