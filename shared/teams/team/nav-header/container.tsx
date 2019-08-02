import * as Constants from '../../../constants/teams'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {createAddUsersToTeamSoFar} from '../../../actions/team-building-gen'
import {appendNewTeamBuilder} from '../../../actions/typed-routes'
import {
  HeaderRightActions as _HeaderRightActions,
  HeaderTitle as _HeaderTitle,
  SubHeader as _SubHeader,
} from '.'
import * as Container from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'

type OwnProps = {
  teamname: string
}

const mapStateToProps = (state, {teamname}) => {
  const yourOperations = Constants.getCanPerform(state, teamname)
  return {
    canAddPeople: yourOperations.manageMembers,
    canChat: !yourOperations.joinTeam,
    loading: anyWaiting(state, Constants.teamWaitingKey(teamname)),
  }
}

const mapDispatchToProps = (dispatch, {teamname}) => ({
  onChat: () => dispatch(Chat2Gen.createPreviewConversation({reason: 'teamHeader', teamname})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  canAddPeople: stateProps.canAddPeople,
  canChat: stateProps.canChat,
  loading: stateProps.loading,
  onChat: dispatchProps.onChat,
  teamname: ownProps.teamname,
})

export const HeaderRightActions = Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'TeamHeaderRightActions'
)(_HeaderRightActions)

const mapStateToPropsTitle = (state, {teamname}) => {
  const role = Constants.getRole(state, teamname)
  const description = Constants.getTeamPublicitySettings(state, teamname).description
  const members = Constants.getTeamMemberCount(state, teamname)
  const yourOperations = Constants.getCanPerform(state, teamname)
  return {
    _canEditDescAvatar: yourOperations.editTeamDescription,
    _canRenameTeam: yourOperations.renameTeam,
    description,
    members,
    role,
    teamname,
  }
}

const mapDispatchToPropsTitle = (dispatch, {teamname}) => ({
  onEditAvatar: () =>
    // On mobile we show the image picker first before opening the dialog. This
    // is a desktop-only component right now, so just do this.
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {sendChatNotification: true, teamname}, selected: 'teamEditTeamAvatar'}],
      })
    ),
  onEditDescription: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'teamEditTeamDescription'}]})
    ),
  onRename: () =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'teamRename'}]})),
})
const mergePropsTitle = (stateProps, dispatchProps) => ({
  description: stateProps.description,
  members: stateProps.members,
  onEditAvatar: stateProps._canEditDescAvatar ? dispatchProps.onEditAvatar : null,
  onEditDescription: stateProps._canEditDescAvatar ? dispatchProps.onEditDescription : null,
  onRename: stateProps._canRenameTeam ? dispatchProps.onRename : null,
  role: stateProps.role,
  teamname: stateProps.teamname,
})

export const HeaderTitle = Container.namedConnect(
  mapStateToPropsTitle,
  mapDispatchToPropsTitle,
  mergePropsTitle,
  'TeamHeaderTitle'
)(_HeaderTitle)

const mapStateToPropsSub = (state, {teamname}) => ({
  _canAddSelf: Constants.getCanPerform(state, teamname).joinTeam,
  _you: state.config.username,
})

const mapDispatchToPropsSub = dispatch => ({
  onAddSelf: (you: string, teamname: string) => {
    dispatch(appendNewTeamBuilder(teamname))
    dispatch(
      createAddUsersToTeamSoFar({namespace: 'teams', users: [{id: you, prettyName: you, serviceMap: {}}]})
    )
  },
})

const mergePropsSub = (stateProps, dispatchProps, {teamname}) => ({
  onAddSelf: stateProps._canAddSelf ? () => dispatchProps.onAddSelf(stateProps._you, teamname) : null,
})

export const SubHeader = Container.namedConnect(
  mapStateToPropsSub,
  mapDispatchToPropsSub,
  mergePropsSub,
  'TeamSubHeader'
)(_SubHeader)
