import * as Constants from '../../../constants/teams'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Types from '../../../constants/types/teams'
import {createAddUsersToTeamSoFar} from '../../../actions/team-building-gen'
import {appendNewTeamBuilder} from '../../../actions/typed-routes'
import {default as _HeaderTitle, SubHeader as _SubHeader} from './index.new'
import * as Container from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'
import {selfToUser} from '../../../constants/team-building'

type OwnProps = {
  teamID: Types.TeamID
}

export const HeaderTitle = Container.connect(
  (state, {teamID}: OwnProps) => {
    const meta = Constants.getTeamMeta(state, teamID)
    const {role, memberCount, teamname, isOpen} = meta
    const yourOperations = Constants.getCanPerformByID(state, teamID)
    return {
      _canAddSelf: Constants.getCanPerformByID(state, teamID).joinTeam,
      _canEditDescAvatar: yourOperations.editTeamDescription,
      _canRenameTeam: yourOperations.renameTeam,
      _teamname: teamname,
      _you: state.config.username,
      canAddPeople: yourOperations.manageMembers,
      canChat: !yourOperations.joinTeam,
      description: Constants.getTeamDetails(state, teamID).description,
      isOpen,
      loading: anyWaiting(state, Constants.teamWaitingKey(teamname)),
      members: memberCount,
      role,
      teamname,
    }
  },
  (dispatch, {teamID}: OwnProps) => ({
    onAddSelf: (you: string) => {
      dispatch(appendNewTeamBuilder(teamID))
      dispatch(createAddUsersToTeamSoFar({namespace: 'teams', users: [selfToUser(you)]}))
    },
    onChat: (teamname: string) =>
      dispatch(Chat2Gen.createPreviewConversation({reason: 'teamHeader', teamname})),
    onEditAvatar: (teamname: string) =>
      // On mobile we show the image picker first before opening the dialog. This
      // is a desktop-only component right now, so just do this.
      // TODO: make this work on mobile
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {sendChatNotification: true, teamname}, selected: 'teamEditTeamAvatar'}],
        })
      ),
    onEditDescription: () =>
      dispatch(
        RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'teamEditTeamDescription'}]})
      ),
    onRename: (teamname: string) =>
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'teamRename'}]})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    active: true, // TODO
    canAddPeople: stateProps.canAddPeople,
    canChat: stateProps.canChat,
    canEdit: stateProps.canAddPeople, // TODO
    description: stateProps.description,
    isOpen: stateProps.isOpen,
    loading: stateProps.loading,
    location: undefined, // TODO
    members: stateProps.members,
    newMemberCount: undefined, // TODO
    onAddSelf: stateProps._canAddSelf ? () => dispatchProps.onAddSelf(stateProps._you) : undefined,
    onChat: () => dispatchProps.onChat(stateProps.teamname),
    onEdit: () => {}, // TODO
    onEditAvatar: stateProps._canEditDescAvatar
      ? () => dispatchProps.onEditAvatar(stateProps.teamname)
      : undefined,
    onEditDescription: stateProps._canEditDescAvatar ? dispatchProps.onEditDescription : undefined,
    onManageInvites: () => {}, // TODO
    onRename: stateProps._canRenameTeam ? () => dispatchProps.onRename(stateProps.teamname) : undefined,
    onShare: () => {}, // TODO
    role: stateProps.role,
    teamID: ownProps.teamID,
    teamname: stateProps.teamname,
  })
)(_HeaderTitle)

export const SubHeader = Container.namedConnect(
  (state, {teamID}: OwnProps) => ({
    _canAddSelf: Constants.getCanPerformByID(state, teamID).joinTeam,
    _teamname: Constants.getTeamMeta(state, teamID).teamname,
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
