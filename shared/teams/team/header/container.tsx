import * as Container from '../../../util/container'
import * as Constants from '../../../constants/teams'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as ConfigGen from '../../../actions/config-gen'
import * as Types from '../../../constants/types/teams'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {createAddUsersToTeamSoFar} from '../../../actions/team-building-gen'
import {appendNewTeamBuilder} from '../../../actions/typed-routes'
import {TeamHeader} from '.'
import {selfToUser} from '../../../constants/team-building'
import * as ImagePicker from 'expo-image-picker'

export type OwnProps = {
  teamID: Types.TeamID
}

export default Container.connect(
  (state, {teamID}: OwnProps) => {
    const yourOperations = Constants.getCanPerformByID(state, teamID)
    const {teamname, isOpen, memberCount} = Constants.getTeamDetails(state, teamID)
    return {
      _canRenameTeam: yourOperations.renameTeam,
      _you: state.config.username,
      canChat: yourOperations.chat,
      canEditDescription: yourOperations.editTeamDescription,
      canJoinTeam: yourOperations.joinTeam,
      canManageMembers: yourOperations.manageMembers,
      description: Constants.getTeamPublicitySettings(state, teamname).description,
      memberCount,
      openTeam: isOpen,
      role: Constants.getRole(state, teamID),
      teamname,
    }
  },
  dispatch => ({
    _onAddSelf: (you: string | null, teamname: string) => {
      if (!you) {
        return
      }
      dispatch(appendNewTeamBuilder(teamname))
      dispatch(createAddUsersToTeamSoFar({namespace: 'teams', users: [selfToUser(you)]}))
    },
    _onChat: (teamname: string) =>
      dispatch(Chat2Gen.createPreviewConversation({reason: 'teamHeader', teamname})),
    _onEditDescription: (teamname: string) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'teamEditTeamDescription'}]})
      ),
    _onEditIcon: (teamname: string, image?: ImagePicker.ImagePickerResult) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {image, sendChatNotification: true, teamname}, selected: 'teamEditTeamAvatar'}],
        })
      ),
    _onRename: (teamname: string) =>
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'teamRename'}]})),
    onFilePickerError: (error: Error) => dispatch(ConfigGen.createFilePickerError({error})),
  }),
  (stateProps, dispatchProps, ownProps) => ({
    canChat: stateProps.canChat,
    canEditDescription: stateProps.canEditDescription,
    canJoinTeam: stateProps.canJoinTeam,
    canManageMembers: stateProps.canManageMembers,
    description: stateProps.description,
    loading: false,
    memberCount: stateProps.memberCount,
    onAddSelf: () => dispatchProps._onAddSelf(stateProps._you, stateProps.teamname),
    onChat: () => dispatchProps._onChat(stateProps.teamname),
    onEditDescription: () => dispatchProps._onEditDescription(stateProps.teamname),
    onEditIcon: (image?: ImagePicker.ImagePickerResult) =>
      dispatchProps._onEditIcon(stateProps.teamname, image),
    onFilePickerError: dispatchProps.onFilePickerError,
    onRename: stateProps._canRenameTeam ? () => dispatchProps._onRename(stateProps.teamname) : null,
    openTeam: stateProps.openTeam,
    role: stateProps.role,
    showingMenu: false,
    teamID: ownProps.teamID,
    teamname: stateProps.teamname,
  })
)(TeamHeader)
