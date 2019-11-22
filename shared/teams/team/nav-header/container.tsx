import * as Constants from '../../../constants/teams'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Types from '../../../constants/types/teams'
import {createAddUsersToTeamSoFar} from '../../../actions/team-building-gen'
import {appendNewTeamBuilder} from '../../../actions/typed-routes'
import {
  HeaderRightActions as _HeaderRightActions,
  HeaderTitle as _HeaderTitle,
  SubHeader as _SubHeader,
} from '.'
import * as Container from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'
import {selfToUser} from '../../../constants/team-building'

type OwnProps = {
  teamID: Types.TeamID
}

export const HeaderRightActions = Container.connect(
  (state, {teamID}: OwnProps) => {
    const yourOperations = Constants.getCanPerformByID(state, teamID)
    const {teamname} = Constants.getTeamDetails(state, teamID)
    return {
      canAddPeople: yourOperations.manageMembers,
      canChat: !yourOperations.joinTeam,
      loading: anyWaiting(state, Constants.teamWaitingKey(teamname)),
      teamname,
    }
  },
  dispatch => ({
    onChat: (teamname: string) =>
      dispatch(Chat2Gen.createPreviewConversation({reason: 'teamHeader', teamname})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    canAddPeople: stateProps.canAddPeople,
    canChat: stateProps.canChat,
    loading: stateProps.loading,
    onChat: () => dispatchProps.onChat(stateProps.teamname),
    teamID: ownProps.teamID,
    teamname: stateProps.teamname,
  })
)(_HeaderRightActions)

export const HeaderTitle = Container.connect(
  (state, {teamID}: OwnProps) => {
    const details = Constants.getTeamDetails(state, teamID)
    const {role, memberCount, teamname} = details
    const yourOperations = Constants.getCanPerformByID(state, teamID)
    return {
      _canEditDescAvatar: yourOperations.editTeamDescription,
      _canRenameTeam: yourOperations.renameTeam,
      description: Constants.getTeamPublicitySettings(state, teamname).description,
      members: memberCount,
      role,
      teamname,
    }
  },
  dispatch => ({
    onEditAvatar: (teamname: string) =>
      // On mobile we show the image picker first before opening the dialog. This
      // is a desktop-only component right now, so just do this.
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {sendChatNotification: true, teamname}, selected: 'teamEditTeamAvatar'}],
        })
      ),
    onEditDescription: (teamname: string) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'teamEditTeamDescription'}]})
      ),
    onRename: (teamname: string) =>
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'teamRename'}]})),
  }),
  (stateProps, dispatchProps) => ({
    description: stateProps.description,
    members: stateProps.members,
    onEditAvatar: stateProps._canEditDescAvatar
      ? () => dispatchProps.onEditAvatar(stateProps.teamname)
      : undefined,
    onEditDescription: stateProps._canEditDescAvatar
      ? () => dispatchProps.onEditDescription(stateProps.teamname)
      : undefined,
    onRename: stateProps._canRenameTeam ? () => dispatchProps.onRename(stateProps.teamname) : undefined,
    role: stateProps.role,
    teamname: stateProps.teamname,
  })
)(_HeaderTitle)

export const SubHeader = Container.namedConnect(
  (state, {teamID}: OwnProps) => ({
    _canAddSelf: Constants.getCanPerformByID(state, teamID).joinTeam,
    _teamname: Constants.getTeamDetails(state, teamID).teamname,
    _you: state.config.username,
  }),
  (dispatch, {teamID}) => ({
    onAddSelf: (you: string) => {
      dispatch(appendNewTeamBuilder(teamID))
      dispatch(createAddUsersToTeamSoFar({namespace: 'teams', users: [selfToUser(you)]}))
    },
  }),
  (stateProps, dispatchProps) => ({
    onAddSelf: stateProps._canAddSelf ? () => dispatchProps.onAddSelf(stateProps._you) : null,
  }),
  'TeamSubHeader'
)(_SubHeader)
