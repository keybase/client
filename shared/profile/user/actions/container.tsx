import * as Constants from '../../../constants/tracker2'
import * as Container from '../../../util/container'
import * as Followers from '../../../constants/followers'
import * as ConfigConstants from '../../../constants/config'
import * as FsConstants from '../../../constants/fs'
import * as FsTypes from '../../../constants/types/fs'
import * as ProfileGen from '../../../actions/profile-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Tracker2Gen from '../../../actions/tracker2-gen'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as WalletsType from '../../../constants/types/wallets'
import Actions from '.'

type OwnProps = {
  username: string
}

export default (ownProps: OwnProps) => {
  const username = ownProps.username
  const d = Container.useSelector(state => Constants.getDetails(state, username))
  const followThem = Followers.useFollowerState(s => s.following.has(username))
  const followsYou = Followers.useFollowerState(s => s.followers.has(username))
  const isBot = Container.useSelector(state => state.chat2.featuredBotsMap.has(username))

  const _guiID = d.guiID
  const _you = ConfigConstants.useConfigState(s => s.username)
  const blocked = d.blocked
  const hidFromFollowers = d.hidFromFollowers
  const state = d.state

  const dispatch = Container.useDispatch()
  const _onAddToTeam = (username: string) =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {username}, selected: 'profileAddToTeam'}]}))
  const _onBrowsePublicFolder = (username: string) =>
    dispatch(FsConstants.makeActionForOpenPathInFilesTab(FsTypes.stringToPath(`/keybase/public/${username}`)))
  const _onEditProfile = () => dispatch(RouteTreeGen.createNavigateAppend({path: ['profileEdit']}))
  const _onFollow = (guiID: string, follow: boolean) =>
    dispatch(Tracker2Gen.createChangeFollow({follow, guiID}))
  const _onIgnoreFor24Hours = (guiID: string) => dispatch(Tracker2Gen.createIgnore({guiID}))
  const _onInstallBot = (username: string) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {botUsername: username}, selected: 'chatInstallBotPick'}],
      })
    )
  }
  const _onManageBlocking = (username: string) =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {username}, selected: 'chatBlockingModal'}]}))
  const _onOpenPrivateFolder = (myUsername: string, theirUsername: string) =>
    dispatch(
      FsConstants.makeActionForOpenPathInFilesTab(
        FsTypes.stringToPath(`/keybase/private/${theirUsername},${myUsername}`)
      )
    )
  const _onReload = (username: string) => {
    dispatch(Tracker2Gen.createShowUser({asTracker: false, username}))
  }
  const _onSendOrRequestLumens = (
    to: string,
    isRequest: boolean,
    recipientType: WalletsType.CounterpartyType
  ) => {
    dispatch(
      WalletsGen.createOpenSendRequestForm({from: WalletsType.noAccountID, isRequest, recipientType, to})
    )
  }
  const _onUnblock = (username: string, guiID: string) => {
    dispatch(ProfileGen.createSubmitUnblockUser({guiID, username}))
  }
  const props = {
    blocked: blocked,
    followThem,
    followsYou,
    hidFromFollowers: hidFromFollowers,
    isBot: isBot,
    onAccept: () => _onFollow(_guiID, true),
    onAddToTeam: () => _onAddToTeam(username),
    onBrowsePublicFolder: () => _onBrowsePublicFolder(username),
    onEditProfile: _you === username ? _onEditProfile : undefined,
    onFollow: () => _onFollow(_guiID, true),
    onIgnoreFor24Hours: () => _onIgnoreFor24Hours(_guiID),
    onInstallBot: () => _onInstallBot(username),
    onManageBlocking: () => _onManageBlocking(username),
    onOpenPrivateFolder: () => _onOpenPrivateFolder(_you, username),
    onReload: () => _onReload(username),
    onRequestLumens: () => _onSendOrRequestLumens(username, true, 'keybaseUser'),
    onSendLumens: () => _onSendOrRequestLumens(username, false, 'keybaseUser'),
    onUnblock: () => _onUnblock(username, _guiID),
    onUnfollow: () => _onFollow(_guiID, false),
    state: state,
    username,
  }
  return <Actions {...props} />
}
