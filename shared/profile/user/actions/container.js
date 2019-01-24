// @flow
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as FsGen from '../../../actions/fs-gen'
import * as FsTypes from '../../../constants/types/fs'
import * as ConfigGen from '../../../actions/config-gen'
import * as Constants from '../../../constants/tracker2'
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Tracker2Gen from '../../../actions/tracker2-gen'
import * as WalletsType from '../../../constants/types/wallets'
import Actions from '.'

type OwnProps = {|username: string|}

const mapStateToProps = (state, ownProps) => {
  const username = ownProps.username
  const d = Constants.getDetails(state, username)
  const followThem = Constants.followThem(state, username)

  return {
    _guiID: d.guiID,
    _you: state.config.username,
    followThem,
    state: d.state,
    username,
  }
}
const mapDispatchToProps = (dispatch, ownProps) => ({
  _onAddToTeam: (username: string) =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {username}, selected: 'addToTeam'}]})),
  _onBrowsePublicFolder: (username: string) =>
    dispatch(FsGen.createOpenPathInFilesTab({path: FsTypes.stringToPath(`/keybase/public/${username}`)})),
  _onChat: (username: string) => {
    dispatch(ConfigGen.createShowMain())
    dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'tracker'}))
  },
  _onClose: (guiID: string) => dispatch(Tracker2Gen.createCloseTracker({guiID})),
  _onEditProfile: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['editProfile2']})),
  _onFollow: (guiID: string, follow: boolean) => dispatch(Tracker2Gen.createChangeFollow({follow, guiID})),
  _onIgnoreFor24Hours: (guiID: string) => dispatch(Tracker2Gen.createIgnore({guiID})),
  _onOpenPrivateFolder: (myUsername: string, theirUsername: string) =>
    dispatch(
      FsGen.createOpenPathInFilesTab({
        path: FsTypes.stringToPath(`/keybase/private/${theirUsername},${myUsername}`),
      })
    ),
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
  _onSendOrRequestLumens: (to: string, isRequest: boolean, recipientType: WalletsType.CounterpartyType) => {
    dispatch(
      WalletsGen.createOpenSendRequestForm({from: WalletsType.noAccountID, isRequest, recipientType, to})
    )
  },
})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  followThem: stateProps.followThem,
  onAccept: () => dispatchProps._onFollow(stateProps._guiID, true),
  onAddToTeam: () => dispatchProps._onAddToTeam(stateProps.username),
  onBrowsePublicFolder: () => dispatchProps._onBrowsePublicFolder(stateProps.username),
  onChat: () => dispatchProps._onChat(stateProps.username),
  onEditProfile: stateProps._you === stateProps.username ? dispatchProps._onEditProfile : null,
  onFollow: () => dispatchProps._onFollow(stateProps._guiID, true),
  onIgnoreFor24Hours: () => dispatchProps._onIgnoreFor24Hours(stateProps._guiID),
  onOpenPrivateFolder: () => dispatchProps._onOpenPrivateFolder(stateProps._you, stateProps.username),
  onReload: () => dispatchProps._onReload(stateProps.username),
  onRequestLumens: () => dispatchProps._onSendOrRequestLumens(stateProps.username, true, 'keybaseUser'),
  onSendLumens: () => dispatchProps._onSendOrRequestLumens(stateProps.username, false, 'keybaseUser'),
  onUnfollow: () => dispatchProps._onFollow(stateProps._guiID, false),
  state: stateProps.state,
})

export default Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'Actions'
)(Actions)
