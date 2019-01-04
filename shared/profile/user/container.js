// @flow
import * as I from 'immutable'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as ConfigGen from '../../actions/config-gen'
import * as Constants from '../../constants/tracker2'
import * as Container from '../../util/container'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import * as Styles from '../../styles'
import Profile2 from '.'
import type {RouteProps} from '../../route-tree/render-route'

type OwnProps = RouteProps<{username: string}, {}>
const emptySet = I.OrderedSet()

const headerBackgroundColor = (state, followThem) => {
  if (['broken', 'error'].includes(state)) {
    return Styles.globalColors.red
  } else {
    return followThem ? Styles.globalColors.green : Styles.globalColors.blue
  }
}

const mapStateToProps = (state, ownProps) => {
  const username = ownProps.routeProps.get('username')
  const d = state.tracker2.usernameToDetails.get(username, Constants.noDetails)
  const followThem = Constants.followThem(state, username)

  return {
    _assertions: d.assertions,
    _teamShowcase: d.teamShowcase,
    backgroundColor: headerBackgroundColor(d.state),
    followThem,
    followers: state.tracker2.usernameToDetails.getIn([username, 'followers']) || emptySet,
    following: state.tracker2.usernameToDetails.getIn([username, 'following']) || emptySet,
    guiID: d.guiID,
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
  _onReload: (assertion: string) => {
    dispatch(
      Tracker2Gen.createLoad({
        assertion,
        guiID: Constants.generateGUIID(),
        ignoreCache: true,
        inTracker: false,
        reason: '',
      })
    )
  },
  onBack: () => dispatch(ownProps.navigateUp()),
})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  assertionKeys: stateProps._assertions ? stateProps._assertions.keySeq().toArray() : null,
  backgroundColor: stateProps.backgroundColor,
  followThem: stateProps.followThem,
  followers: stateProps.followers.toArray(),
  following: stateProps.following.toArray(),
  onAccept: () => dispatchProps._onFollow(stateProps.guiID, true),
  onBack: () => dispatchProps.onBack(),
  onChat: () => dispatchProps._onChat(stateProps.username),
  onClose: () => dispatchProps._onClose(stateProps.guiID),
  onFollow: () => dispatchProps._onFollow(stateProps.guiID, true),
  onIgnoreFor24Hours: () => dispatchProps._onIgnoreFor24Hours(stateProps.guiID),
  onReload: () => dispatchProps._onReload(stateProps.username),
  onUnfollow: () => dispatchProps._onFollow(stateProps.guiID, false),
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
