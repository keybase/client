import * as Container from '../../../util/container'
import * as Constants from '../../../constants/teams'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as ConfigGen from '../../../actions/config-gen'
import * as Types from '../../../constants/types/teams'
// @ts-ignore not typed yet
import {Response} from 'react-native-image-picker'
import {createAddResultsToUserInput} from '../../../actions/search-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {TeamHeader} from '.'

export type OwnProps = {
  teamname: Types.Teamname
}

const mapStateToProps = (state: Container.TypedState, {teamname}: OwnProps) => {
  const yourOperations = Constants.getCanPerform(state, teamname)
  return {
    _canRenameTeam: yourOperations.renameTeam,
    _you: state.config.username,
    canChat: yourOperations.chat,
    canEditDescription: yourOperations.editTeamDescription,
    canJoinTeam: yourOperations.joinTeam,
    canManageMembers: yourOperations.manageMembers,
    description: Constants.getTeamPublicitySettings(state, teamname).description,
    memberCount: Constants.getTeamMemberCount(state, teamname),
    openTeam: Constants.getTeamSettings(state, teamname).open,
    role: Constants.getRole(state, teamname),
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch, {teamname}: OwnProps) => ({
  _onAddSelf: (you: string | null) => {
    if (!you) {
      return
    }
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'teamAddPeople'}]}))
    dispatch(createAddResultsToUserInput({searchKey: 'addToTeamSearch', searchResults: [you]}))
  },
  onChat: () => dispatch(Chat2Gen.createPreviewConversation({reason: 'teamHeader', teamname})),
  onEditDescription: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'teamEditTeamDescription'}]})
    ),
  onEditIcon: (image?: Response) =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {image, sendChatNotification: true, teamname}, selected: 'teamEditTeamAvatar'}],
      })
    ),
  onFilePickerError: (error: Error) => dispatch(ConfigGen.createFilePickerError({error})),
  onRename: () =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'teamRename'}]})),
})

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    canChat: stateProps.canChat,
    canEditDescription: stateProps.canEditDescription,
    canJoinTeam: stateProps.canJoinTeam,
    canManageMembers: stateProps.canManageMembers,
    description: stateProps.description,
    loading: false,
    memberCount: stateProps.memberCount,
    onAddSelf: () => dispatchProps._onAddSelf(stateProps._you),
    onChat: dispatchProps.onChat,
    onEditDescription: dispatchProps.onEditDescription,
    onEditIcon: dispatchProps.onEditIcon,
    onFilePickerError: dispatchProps.onFilePickerError,
    onRename: stateProps._canRenameTeam ? dispatchProps.onRename : null,
    openTeam: stateProps.openTeam,
    role: stateProps.role,
    showingMenu: false,
    teamname: ownProps.teamname,
  })
)(TeamHeader)
