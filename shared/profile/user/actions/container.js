// @flow
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as ConfigGen from '../../../actions/config-gen'
import * as Constants from '../../../constants/tracker2'
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Tracker2Gen from '../../../actions/tracker2-gen'
import Actions from '.'

type OwnProps = {|username: string|}

const mapStateToProps = (state, ownProps) => {
  const username = ownProps.username
  const d = state.tracker2.usernameToDetails.get(username, Constants.noDetails)
  const followThem = Constants.followThem(state, username)

  return {
    _guiID: d.guiID,
    _userIsYou: username === state.config.username,
    followThem,
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
  _onEditProfile: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['editProfile']})),
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
})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  followThem: stateProps.followThem,
  onAccept: () => dispatchProps._onFollow(stateProps._guiID, true),
  onChat: () => dispatchProps._onChat(stateProps.username),
  onEditProfile: stateProps._userIsYou ? dispatchProps._onEditProfile : null,
  onFollow: () => dispatchProps._onFollow(stateProps._guiID, true),
  onIgnoreFor24Hours: () => dispatchProps._onIgnoreFor24Hours(stateProps._guiID),
  onReload: () => dispatchProps._onReload(stateProps.username),
  onUnfollow: () => dispatchProps._onFollow(stateProps._guiID, false),
  state: stateProps.state,
})

export default Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'Actions'
)(Actions)
