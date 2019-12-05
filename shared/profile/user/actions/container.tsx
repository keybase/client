import * as WalletsGen from '../../../actions/wallets-gen'
import * as FsConstants from '../../../constants/fs'
import * as FsTypes from '../../../constants/types/fs'
import * as Constants from '../../../constants/tracker2'
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Tracker2Gen from '../../../actions/tracker2-gen'
import * as ProfileGen from '../../../actions/profile-gen'
import * as WalletsType from '../../../constants/types/wallets'
import Actions from '.'

type OwnProps = {
  username: string
}

export default Container.namedConnect(
  (state, ownProps: OwnProps) => {
    const username = ownProps.username
    const d = Constants.getDetails(state, username)
    const followThem = Constants.followThem(state, username)
    const followsYou = Constants.followsYou(state, username)

    return {
      _guiID: d.guiID,
      _you: state.config.username,
      blocked: d.blocked,
      followThem,
      followsYou,
      hidFromFollowers: d.hidFromFollowers,
      state: d.state,
      username,
    }
  },
  dispatch => ({
    _onAddToTeam: (username: string) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({path: [{props: {username}, selected: 'profileAddToTeam'}]})
      ),
    _onBlock: (username: string) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({path: [{props: {username}, selected: 'profileBlockUser'}]})
      ),
    _onBrowsePublicFolder: (username: string) =>
      dispatch(
        FsConstants.makeActionForOpenPathInFilesTab(FsTypes.stringToPath(`/keybase/public/${username}`))
      ),
    _onClose: (guiID: string) => dispatch(Tracker2Gen.createCloseTracker({guiID})),
    _onEditProfile: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['profileEdit']})),
    _onFollow: (guiID: string, follow: boolean) => dispatch(Tracker2Gen.createChangeFollow({follow, guiID})),
    _onIgnoreFor24Hours: (guiID: string) => dispatch(Tracker2Gen.createIgnore({guiID})),
    _onManageBlocking: (username: string) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {username}, selected: 'chatBlockingModal'}],
        })
      ),
    _onOpenPrivateFolder: (myUsername: string, theirUsername: string) =>
      dispatch(
        FsConstants.makeActionForOpenPathInFilesTab(
          FsTypes.stringToPath(`/keybase/private/${theirUsername},${myUsername}`)
        )
      ),
    _onReload: (username: string) => {
      dispatch(Tracker2Gen.createShowUser({asTracker: false, username}))
    },
    _onSendOrRequestLumens: (to: string, isRequest: boolean, recipientType: WalletsType.CounterpartyType) => {
      dispatch(
        WalletsGen.createOpenSendRequestForm({from: WalletsType.noAccountID, isRequest, recipientType, to})
      )
    },
    _onUnblock: (username: string, guiID: string) =>
      dispatch(ProfileGen.createSubmitUnblockUser({guiID, username})),
  }),
  (stateProps, dispatchProps, {username}: OwnProps) => ({
    blocked: stateProps.blocked,
    followThem: stateProps.followThem,
    followsYou: stateProps.followsYou,
    hidFromFollowers: stateProps.hidFromFollowers,
    onAccept: () => dispatchProps._onFollow(stateProps._guiID, true),
    onAddToTeam: () => dispatchProps._onAddToTeam(stateProps.username),
    onBlock: () => dispatchProps._onBlock(stateProps.username),
    onBrowsePublicFolder: () => dispatchProps._onBrowsePublicFolder(stateProps.username),
    onEditProfile: stateProps._you === stateProps.username ? dispatchProps._onEditProfile : undefined,
    onFollow: () => dispatchProps._onFollow(stateProps._guiID, true),
    onIgnoreFor24Hours: () => dispatchProps._onIgnoreFor24Hours(stateProps._guiID),
    onManageBlocking: () => dispatchProps._onManageBlocking(stateProps.username),
    onOpenPrivateFolder: () => dispatchProps._onOpenPrivateFolder(stateProps._you, stateProps.username),
    onReload: () => dispatchProps._onReload(stateProps.username),
    onRequestLumens: () => dispatchProps._onSendOrRequestLumens(stateProps.username, true, 'keybaseUser'),
    onSendLumens: () => dispatchProps._onSendOrRequestLumens(stateProps.username, false, 'keybaseUser'),
    onUnblock: () => dispatchProps._onUnblock(stateProps.username, stateProps._guiID),
    onUnfollow: () => dispatchProps._onFollow(stateProps._guiID, false),
    state: stateProps.state,
    username,
  }),
  'Actions'
)(Actions)
