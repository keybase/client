// @flow
import {connect} from '../../../util/container'
import * as Constants from '../../../constants/teams'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as ConfigGen from '../../../actions/config-gen'
import * as Types from '../../../constants/types/teams'
import type {Response} from 'react-native-image-picker'
import {createAddResultsToUserInput} from '../../../actions/search-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {TeamHeader} from '.'

export type OwnProps = {
  teamname: Types.Teamname,
}

const mapStateToProps = (state, {teamname}: OwnProps) => {
  const yourOperations = Constants.getCanPerform(state, teamname)
  return {
    _you: state.config.username,
    canChat: yourOperations.chat,
    canEditDescription: yourOperations.editChannelDescription,
    canJoinTeam: yourOperations.joinTeam,
    canManageMembers: yourOperations.manageMembers,
    description: Constants.getTeamPublicitySettings(state, teamname).description,
    memberCount: Constants.getTeamMemberCount(state, teamname),
    openTeam: Constants.getTeamSettings(state, teamname).open,
    role: Constants.getRole(state, teamname),
  }
}

const mapDispatchToProps = (dispatch, {teamname}: OwnProps) => ({
  _onAddSelf: (you: ?string) => {
    if (!you) {
      return
    }
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'addPeople'}]}))
    dispatch(createAddResultsToUserInput({searchKey: 'addToTeamSearch', searchResults: [you]}))
  },
  onChat: () => dispatch(Chat2Gen.createPreviewConversation({reason: 'teamHeader', teamname})),
  onEditDescription: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'editTeamDescription'}]})
    ),
  onEditIcon: (image?: Response) =>
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {image, sendChatNotification: true, teamname}, selected: 'editTeamAvatar'}]})
    ),
  onFilePickerError: (error: Error) => dispatch(ConfigGen.createFilePickerError({error})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  canChat: stateProps.canChat,
  canEditDescription: stateProps.canEditDescription,
  canJoinTeam: stateProps.canJoinTeam,
  canManageMembers: stateProps.canManageMembers,
  description: stateProps.description,
  memberCount: stateProps.memberCount,
  onAddSelf: () => dispatchProps._onAddSelf(stateProps._you),
  onChat: dispatchProps.onChat,
  onEditDescription: dispatchProps.onEditDescription,
  onEditIcon: dispatchProps.onEditIcon,
  onFilePickerError: dispatchProps.onFilePickerError,
  openTeam: stateProps.openTeam,
  role: stateProps.role,
  teamname: ownProps.teamname,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(TeamHeader)
