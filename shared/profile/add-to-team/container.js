// @flow
import * as I from 'immutable'
import Render from './index'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as TeamsGen from '../../actions/teams-gen'
import * as Constants from '../../constants/teams'
import * as WaitingConstants from '../../constants/waiting'
import {HeaderOnMobile} from '../../common-adapters'
import type {TeamRoleType} from '../../constants/types/teams'

type OwnProps = Container.RouteProps<{username: string}, {}>

const mapStateToProps = (state, ownProps) => {
  return {
    _teamNameToRole: state.teams.teamNameToRole,
    _them: Container.getRouteProps(ownProps, 'username'),
    addUserToTeamsResults: state.teams.addUserToTeamsResults,
    addUserToTeamsState: state.teams.addUserToTeamsState,
    teamProfileAddList: state.teams.get('teamProfileAddList'),
    teamnames: Constants.getSortedTeamnames(state),
    waiting: WaitingConstants.anyWaiting(state, Constants.teamProfileAddListWaitingKey),
  }
}

const mapDispatchToProps = (dispatch, ownProps) => ({
  _onAddToTeams: (role: TeamRoleType, teams: Array<string>, user: string) => {
    dispatch(TeamsGen.createAddUserToTeams({role, teams, user}))
  },
  _onOpenRolePicker: (
    role: TeamRoleType,
    onComplete: (string, boolean) => void,
    ownerDisabledExp: string,
    styleCover?: Object
  ) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {
              onComplete,
              ownerDisabledExp,
              selectedRole: role,
              sendNotificationChecked: true,
              showNotificationCheckbox: false,
              styleCover,
            },
            selected: 'controlledRolePicker',
          },
        ],
      })
    )
  },
  clearAddUserToTeamsResults: () => dispatch(TeamsGen.createClearAddUserToTeamsResults()),
  loadTeamList: () =>
    dispatch(TeamsGen.createGetTeamProfileAddList({username: Container.getRouteProps(ownProps, 'username')})),
  onBack: () => {
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(TeamsGen.createSetTeamProfileAddList({teamlist: I.List([])}))
  },
})

const mergeProps = (stateProps, dispatchProps) => {
  const {teamProfileAddList, _them} = stateProps
  const title = `Add ${_them} to...`

  return {
    ...stateProps,
    ...dispatchProps,
    onAddToTeams: (role: TeamRoleType, teams: Array<string>) =>
      dispatchProps._onAddToTeams(role, teams, stateProps._them),
    onBack: dispatchProps.onBack,
    onOpenRolePicker: (
      role: TeamRoleType,
      onComplete: (string, boolean) => void,
      selectedTeams: {[string]: boolean},
      styleCover?: Object
    ) => {
      const selectedTeamsArr = Object.keys(selectedTeams).filter(st => selectedTeams[st])
      const ownerDisabledExp = getOwnerDisabledExp(selectedTeamsArr, stateProps._teamNameToRole)
      dispatchProps._onOpenRolePicker(role, onComplete, ownerDisabledExp, styleCover)
    },
    teamProfileAddList: teamProfileAddList.toArray(),
    them: _them,
    title,
  }
}

const getOwnerDisabledExp = (selected, teamNameToRole) => {
  for (let st of selected) {
    // important for subteam check to come first
    if (Constants.isSubteam(st)) {
      return `${st} is a subteam which cannot have owners.`
    } else if (teamNameToRole.get(st) !== 'owner') {
      return `You are not an owner of ${st}.`
    }
  }
  return ''
}

// The data flow in this component is confusing
// TODO make the component a class and remove recompose
export default Container.compose(
  Container.connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  Container.lifecycle({
    componentDidMount() {
      this.props.clearAddUserToTeamsResults()
      this.props.loadTeamList()
    },
  }),
  Container.withStateHandlers(
    {role: 'writer', selectedTeams: {}, sendNotification: true},
    {
      onRoleChange: () => role => ({role}),
      setSelectedTeams: ({role}, {_teamNameToRole}) => selectedTeams => {
        const selectedTeamsArr = Object.keys(selectedTeams).filter(st => selectedTeams[st])
        const shouldSetRole = role === 'owner' && !!getOwnerDisabledExp(selectedTeamsArr, _teamNameToRole)
        return {role: shouldSetRole ? 'admin' : role, selectedTeams}
      },
      setSendNotification: () => sendNotification => ({sendNotification}),
    }
  ),
  Container.withHandlers({
    // Return rows set to true.
    onSave: props => () => {
      props.onAddToTeams(
        props.role,
        Object.keys(props.selectedTeams).filter(team => props.selectedTeams[team])
      )
      props.setSelectedTeams({})
    },
    onToggle: props => (teamname: string) => {
      props.clearAddUserToTeamsResults()
      props.setSelectedTeams({
        ...props.selectedTeams,
        [teamname]: !props.selectedTeams[teamname],
      })
    },
  })
)(HeaderOnMobile(Render))
