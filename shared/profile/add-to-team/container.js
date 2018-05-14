// @flow
import * as I from 'immutable'
import Render from './index'
import {
  branch,
  compose,
  connect,
  lifecycle,
  withHandlers,
  withStateHandlers,
  type TypedState,
} from '../../util/container'
import * as TeamsGen from '../../actions/teams-gen'
import {HeaderHoc} from '../../common-adapters'
import {isMobile} from '../../constants/platform'
import {getSortedTeamnames} from '../../constants/teams'
import {navigateAppend} from '../../actions/route-tree'
import type {TeamRoleType} from '../../constants/types/teams'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  return {
    _teamNameToIsOpen: state.teams.getIn(['teamNameToIsOpen'], I.Map()),
    _teamNameToCanPerform: state.teams.getIn(['teamNameToCanPerform'], I.Map()),
    _teamNameToMembers: state.teams.getIn(['teamNameToMembers'], I.Map()),
    _them: routeProps.get('username'),
    teamnames: getSortedTeamnames(state),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
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
  return {
    ...stateProps,
    ...dispatchProps,
    onAddToTeams: (role: TeamRoleType, teams: Array<string>) =>
      dispatchProps._onAddToTeams(role, teams, stateProps._them),
    teamNameToIsOpen: stateProps._teamNameToIsOpen.toObject(),
    teamNameToCanPerform: stateProps._teamNameToCanPerform.toObject(),
    teamNameToMembers: stateProps._teamNameToMembers.toObject(),
    them: stateProps._them,
    title: `Add ${stateProps._them} to...`,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  compose(
    withStateHandlers(
      {role: 'writer', selectedTeams: {}, sendNotification: true},
      {
        setSendNotification: () => sendNotification => ({sendNotification}),
        onRoleChange: () => role => ({role}),
        setSelectedTeams: () => selectedTeams => ({selectedTeams}),
      }
    )
  ),
  withHandlers({
    onToggle: props => (teamname: string) =>
      props.setSelectedTeams({
        ...props.selectedTeams,
        [teamname]: !props.selectedTeams[teamname],
      }),
    onSave: props => () => props.onAddToTeams(props.role, Object.keys(props.selectedTeams)),
  }),
  lifecycle({
    componentDidMount() {
      this.props.loadTeamList()
      this.props.loadAllTeams()
    },
  }),
  branch(() => isMobile, HeaderHoc)
)(Render)
