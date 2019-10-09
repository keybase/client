import * as Chat2Gen from '../../actions/chat2-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import * as FsConstants from '../../constants/fs'
import * as FsTypes from '../../constants/types/fs'
import * as ConfigGen from '../../actions/config-gen'
import * as Tracker2Constants from '../../constants/tracker2'
import * as Types from '../../constants/types/team-building'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import * as ProfileGen from '../../actions/profile-gen'
import * as WalletsType from '../../constants/types/wallets'
import PeopleResult from '.'

type OwnProps = {
  isPreExistingTeamMember: boolean
  resultForService: Types.ServiceIdWithContact
  username: string
  prettyName: string
  displayLabel: string
  services: {[K in Types.ServiceIdWithContact]?: string}
  inTeam: boolean
  followingState: Types.FollowingState
  highlight: boolean
  onAdd: () => void
  onRemove: () => void
}

const mapStateToProps = (state, ownProps) => {
  const username = ownProps.username
  const d = Tracker2Constants.getDetails(state, username)
  const followThem = Tracker2Constants.followThem(state, username)
  const followsYou = Tracker2Constants.followsYou(state, username)

  return {
    _guiID: d.guiID,
    _you: state.config.username,
    blocked: d.blocked,
    followThem,
    followsYou,
    state: d.state,
    username,
  }
}
const mapDispatchToProps = dispatch => ({
  _onAddToTeam: (username: string) =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {username}, selected: 'profileAddToTeam'}]})),
  _onBlock: (username: string) =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {username}, selected: 'profileBlockUser'}]})),
  _onBrowsePublicFolder: (username: string) =>
    dispatch(
      FsConstants.makeActionForOpenPathInFilesTab(FsTypes.stringToPath(`/keybase/public/${username}`))
    ),
  _onChat: (username: string) => {
    console.warn(`starting chat with ${username}`)
    dispatch(ConfigGen.createShowMain())
    dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'tracker'}))
  },
  _onClose: (guiID: string) => dispatch(Tracker2Gen.createCloseTracker({guiID})),
  _onOpenPrivateFolder: (myUsername: string, theirUsername: string) =>
    dispatch(
      FsConstants.makeActionForOpenPathInFilesTab(
        FsTypes.stringToPath(`/keybase/private/${theirUsername},${myUsername}`)
      )
    ),
  _onSendOrRequestLumens: (to: string, isRequest: boolean, recipientType: WalletsType.CounterpartyType) => {
    dispatch(
      WalletsGen.createOpenSendRequestForm({from: WalletsType.noAccountID, isRequest, recipientType, to})
    )
  },
  _onUnblock: (username: string, guiID: string) =>
    dispatch(ProfileGen.createSubmitUnblockUser({guiID, username})),
})
const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  ...ownProps,
  blocked: stateProps.blocked,
  followThem: stateProps.followThem,
  followsYou: stateProps.followsYou,
  onAddToTeam: () => dispatchProps._onAddToTeam(stateProps.username),
  onBlock: () => dispatchProps._onBlock(stateProps.username),
  onBrowsePublicFolder: () => dispatchProps._onBrowsePublicFolder(stateProps.username),
  onChat: () => dispatchProps._onChat(stateProps.username),
  onOpenPrivateFolder: () => dispatchProps._onOpenPrivateFolder(stateProps._you, stateProps.username),
  onRequestLumens: () => dispatchProps._onSendOrRequestLumens(stateProps.username, true, 'keybaseUser'),
  onSendLumens: () => dispatchProps._onSendOrRequestLumens(stateProps.username, false, 'keybaseUser'),
  onUnblock: () => dispatchProps._onUnblock(stateProps.username, stateProps._guiID),
  state: stateProps.state,
})

export default Container.namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'PeopleResult')(
  PeopleResult
)
