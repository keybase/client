import * as Constants from '../../../constants/teams'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Types from '../../../constants/types/teams'
import * as ChatTypes from '../../../constants/types/chat2'
import {createAddUsersToTeamSoFar} from '../../../actions/team-building-gen'
import {appendNewTeamBuilder} from '../../../actions/typed-routes'
import {default as _HeaderTitle, SubHeader as _SubHeader} from './index.new'
import * as Container from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'
import {selfToUser} from '../../../constants/team-building'

type OwnProps = {
  teamID: Types.TeamID
  conversationIDKey: ChatTypes.ConversationIDKey
}

export const HeaderTitle = Container.connect(
  (state, {teamID, conversationIDKey}: OwnProps) => {
    const meta = Constants.getTeamMeta(state, teamID)
    const {role, memberCount, teamname, isOpen} = meta
    const yourOperations = Constants.getCanPerformByID(state, teamID)
    return {
      _canAddSelf: Constants.getCanPerformByID(state, teamID).joinTeam,
      _canEditDescAvatar: yourOperations.editTeamDescription,
      _canRenameTeam: yourOperations.renameTeam,
      _teamname: teamname,
      _you: state.config.username,
      canAddMembers: yourOperations.manageMembers,
      canChat: !yourOperations.joinTeam,
      description: Constants.getTeamDetails(state, teamID).description,
      isOpen,
      loading: anyWaiting(state, Constants.teamWaitingKey(teamname)),
      memberCount,
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
    canAddMembers: stateProps.canAddMembers,
    canChat: stateProps.canChat,
    canEdit: stateProps.canAddPeople, // TODO
    description: stateProps.description,
    loading: stateProps.loading,
    memberCount: stateProps.memberCount,
    newMemberCount: undefined, // TODO
    onChat: () => dispatchProps.onChat(stateProps.teamname),
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
