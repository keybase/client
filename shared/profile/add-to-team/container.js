// @flow
import * as I from 'immutable'
import Render from './index'
import {
  compose,
  connect,
  lifecycle,
  withHandlers,
  withStateHandlers,
  type RouteProps,
} from '../../util/container'
import * as TeamsGen from '../../actions/teams-gen'
import * as Constants from '../../constants/teams'
import * as WaitingConstants from '../../constants/waiting'
import {HeaderOnMobile} from '../../common-adapters'
import type {TeamRoleType} from '../../constants/types/teams'

type OwnProps = RouteProps<{username: string}, {}>

const mapStateToProps = (state, {routeProps}) => {
  return {
    _them: routeProps.get('username'),
    teamProfileAddList: state.teams.get('teamProfileAddList'),
    teamnames: Constants.getSortedTeamnames(state),
    waiting: WaitingConstants.anyWaiting(state, Constants.teamProfileAddListWaitingKey),
  }
}

const mapDispatchToProps = (dispatch, {navigateUp, routeProps, navigateAppend}) => ({
  _onAddToTeams: (role: TeamRoleType, teams: Array<string>, user: string) => {
    dispatch(TeamsGen.createAddUserToTeams({role, teams, user}))
    dispatch(navigateUp())
  },
  loadTeamList: () => dispatch(TeamsGen.createGetTeamProfileAddList({username: routeProps.get('username')})),
  onBack: () => {
    dispatch(navigateUp())
    dispatch(TeamsGen.createSetTeamProfileAddList({teamlist: I.List([])}))
  },
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
  const {teamProfileAddList, _them} = stateProps
  const title = `Add ${_them} to...`

  return {
    ...stateProps,
    ...dispatchProps,
    onAddToTeams: (role: TeamRoleType, teams: Array<string>) =>
      dispatchProps._onAddToTeams(role, teams, stateProps._them),
    onBack: dispatchProps.onBack,
    teamProfileAddList: teamProfileAddList.toArray(),
    them: _them,
    title,
  }
}

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  lifecycle({
    componentDidMount() {
      this.props.loadTeamList()
    },
  }),
  withStateHandlers(
    {role: 'writer', selectedTeams: {}, sendNotification: true},
    {
      onRoleChange: () => role => ({role}),
      setSelectedTeams: () => selectedTeams => ({selectedTeams}),
      setSendNotification: () => sendNotification => ({sendNotification}),
    }
  ),
  withHandlers({
    onSave: props => () => props.onAddToTeams(props.role, Object.keys(props.selectedTeams)),
    onToggle: props => (teamname: string) =>
      props.setSelectedTeams({
        ...props.selectedTeams,
        [teamname]: !props.selectedTeams[teamname],
      }),
  })
)(HeaderOnMobile(Render))
