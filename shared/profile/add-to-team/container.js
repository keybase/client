// @flow
import * as I from 'immutable'
import Render from './index'
import {
  compose,
  connect,
  lifecycle,
  withHandlers,
  withStateHandlers,
  type TypedState,
} from '../../util/container'
import {mapValues, zipObject} from 'lodash-es'
import * as TeamsGen from '../../actions/teams-gen'
import {HeaderOnMobile} from '../../common-adapters'
import {getSortedTeamnames} from '../../constants/teams'
import {navigateAppend} from '../../actions/route-tree'
import type {TeamRoleType} from '../../constants/types/teams'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  return {
    _teamNameToIsOpen: state.teams.get('teamNameToIsOpen', I.Map()),
    _teamNameToCanPerform: state.teams.get('teamNameToCanPerform', I.Map()),
    _teamNameToMembers: state.teams.get('teamNameToMembers', I.Map()),
    _them: routeProps.get('username'),
    teamnames: getSortedTeamnames(state),
  }
}

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  loadAllTeams: () => dispatch(TeamsGen.createGetDetailsForAllTeams()),
  loadTeamList: () => dispatch(TeamsGen.createGetTeams()),
  _onAddToTeams: (role: TeamRoleType, teams: Array<string>, user: string) => {
    dispatch(TeamsGen.createAddUserToTeams({role, teams, user}))
    dispatch(navigateUp())
  },
  onBack: () => dispatch(navigateUp()),
  onOpenRolePicker: (role: TeamRoleType, onComplete: (string, boolean) => void, styleCover?: Object) => {
    dispatch(
      navigateAppend([
        {
          props: {
            allowOwner: true,
            onComplete,
            selectedRole: role,
            sendNotificationChecked: true,
            showNotificationCheckbox: false,
            styleCover,
          },
          selected: 'controlledRolePicker',
        },
      ])
    )
  },
})

const mergeProps = (stateProps, dispatchProps) => {
  const teamnames = stateProps.teamnames
  const them = stateProps._them

  const teamNameToIsOpen = stateProps._teamNameToIsOpen.toObject()
  const teamNameToCanPerform = stateProps._teamNameToCanPerform.toObject()
  const youCanAddPeople = mapValues(teamNameToCanPerform, team => team.manageMembers)
  const teamNameToMembers = stateProps._teamNameToMembers.toObject()
  const memberIsInTeam = mapValues(teamNameToMembers, team => !!team.get(them))
  const canAddThem = teamnames.reduce((teams, team) => {
    teams[team] = youCanAddPeople[team] && !memberIsInTeam[team]
    return teams
  }, {})
  const loaded =
    teamnames &&
    zipObject(teamnames, teamnames.map(team => teamNameToMembers[team] && teamNameToCanPerform[team]))
  const title = `Add ${them} to...`

  return {
    ...stateProps,
    ...dispatchProps,
    canAddThem,
    loaded,
    memberIsInTeam,
    onAddToTeams: (role: TeamRoleType, teams: Array<string>) =>
      dispatchProps._onAddToTeams(role, teams, stateProps._them),
    onBack: dispatchProps.onBack,
    teamNameToIsOpen,
    them,
    title,
    youCanAddPeople,
  }
}

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  lifecycle({
    componentDidMount() {
      this.props.loadTeamList()
      this.props.loadAllTeams()
    },
  }),
  withStateHandlers(
    {role: 'writer', selectedTeams: {}, sendNotification: true},
    {
      setSendNotification: () => sendNotification => ({sendNotification}),
      onRoleChange: () => role => ({role}),
      setSelectedTeams: () => selectedTeams => ({selectedTeams}),
    }
  ),
  withHandlers({
    onToggle: props => (teamname: string) =>
      props.setSelectedTeams({
        ...props.selectedTeams,
        [teamname]: !props.selectedTeams[teamname],
      }),
    onSave: props => () => props.onAddToTeams(props.role, Object.keys(props.selectedTeams)),
  })
)(HeaderOnMobile(Render))
