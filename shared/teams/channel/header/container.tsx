import * as Container from '../../../util/container'
import * as Constants from '../../../constants/teams'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as ConfigGen from '../../../actions/config-gen'
import * as ChatTypes from '../../../constants/types/chat2'
import * as Types from '../../../constants/types/teams'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {createAddUsersToTeamSoFar} from '../../../actions/team-building-gen'
import {appendNewTeamBuilder} from '../../../actions/typed-routes'
import {TeamHeader} from '.'
import {selfToUser} from '../../../constants/team-building'
import * as ImagePicker from 'expo-image-picker'

export type OwnProps = {
  teamID: Types.TeamID
  conversationIDKey: ChatTypes.ConversationIDKey
}

export default Container.connect(
  (state, {teamID}: OwnProps) => {
    const yourOperations = Constants.getCanPerformByID(state, teamID)
    const {teamname, isOpen, memberCount} = Constants.getTeamMeta(state, teamID)
    return {
      _canRenameTeam: yourOperations.renameTeam,
      _you: state.config.username,
      canChat: yourOperations.chat,
      canEditDescription: yourOperations.editTeamDescription,
      canJoinTeam: yourOperations.joinTeam,
      canManageMembers: yourOperations.manageMembers,
      description: Constants.getTeamDetails(state, teamID).description,
      memberCount,
      openTeam: isOpen,
      role: Constants.getRole(state, teamID),
      teamname,
    }
  },
  (dispatch, {teamID}: OwnProps) => ({
    _onChat: (conversationIDKey: ChatTypes.ConversationIDKey) =>
      dispatch(Chat2Gen.createPreviewConversation({conversationIDKey, reason: 'channelHeader'})),
    onEdit: () =>
      dispatch(
        RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'teamEditTeamDescription'}]})
      ),
  }),
  (stateProps, dispatchProps, ownProps) => ({
    canChat: stateProps.canChat,
    canEditDescription: stateProps.canEditDescription,
    canJoinTeam: stateProps.canJoinTeam,
    canManageMembers: stateProps.canManageMembers,
    conversationIDKey: ownProps.conversationIDKey,
    description: stateProps.description,
    loading: false,
    memberCount: stateProps.memberCount,
    onAddSelf: () => dispatchProps._onAddSelf(stateProps._you),
    onChat: () => dispatchProps._onChat(stateProps.teamname),
    onEditDescription: dispatchProps.onEditDescription,
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
