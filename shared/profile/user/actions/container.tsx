import * as C from '../../../constants'
import * as Constants from '../../../constants/tracker2'
import * as ProfileConstants from '../../../constants/profile'
import * as Followers from '../../../constants/followers'
import * as ConfigConstants from '../../../constants/config'
import * as FsTypes from '../../../constants/types/fs'
import Actions from '.'

type OwnProps = {
  username: string
}

export default (ownProps: OwnProps) => {
  const username = ownProps.username
  const d = Constants.useState(s => Constants.getDetails(s, username))
  const followThem = Followers.useFollowerState(s => s.following.has(username))
  const followsYou = Followers.useFollowerState(s => s.followers.has(username))
  const isBot = C.useBotsState(s => s.featuredBotsMap.has(username))

  const _guiID = d.guiID
  const _you = ConfigConstants.useCurrentUserState(s => s.username)
  const blocked = d.blocked
  const hidFromFollowers = d.hidFromFollowers
  const state = d.state

  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const _onAddToTeam = (username: string) => navigateAppend({props: {username}, selected: 'profileAddToTeam'})
  const _onBrowsePublicFolder = (username: string) =>
    C.makeActionForOpenPathInFilesTab(FsTypes.stringToPath(`/keybase/public/${username}`))
  const _onEditProfile = () => navigateAppend('profileEdit')

  const changeFollow = Constants.useState(s => s.dispatch.changeFollow)
  const ignore = Constants.useState(s => s.dispatch.ignore)
  const _onFollow = changeFollow
  const _onIgnoreFor24Hours = ignore
  const _onInstallBot = (username: string) => {
    navigateAppend({props: {botUsername: username}, selected: 'chatInstallBotPick'})
  }
  const _onManageBlocking = (username: string) =>
    navigateAppend({props: {username}, selected: 'chatBlockingModal'})
  const _onOpenPrivateFolder = (myUsername: string, theirUsername: string) =>
    C.makeActionForOpenPathInFilesTab(FsTypes.stringToPath(`/keybase/private/${theirUsername},${myUsername}`))
  const showUser = Constants.useState(s => s.dispatch.showUser)
  const _onReload = (username: string) => {
    showUser(username, false)
  }
  const submitUnblockUser = ProfileConstants.useState(s => s.dispatch.submitUnblockUser)
  const _onUnblock = (username: string, guiID: string) => {
    submitUnblockUser(username, guiID)
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
    onUnblock: () => _onUnblock(username, _guiID),
    onUnfollow: () => _onFollow(_guiID, false),
    state: state,
    username,
  }
  return <Actions {...props} />
}
