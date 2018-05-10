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

const mapStateToProps = (state: TypedState, {routeProps}) => {
  return {
    _teamNameToIsOpen: state.teams.getIn(['teamNameToIsOpen'], I.Map()),
    _teammembercounts: state.teams.getIn(['teammembercounts'], I.Map()),
    _teamNameToCanPerform: state.teams.getIn(['teamNameToCanPerform'], I.Map()),
    _teamNameToMembers: state.teams.getIn(['teamNameToMembers'], I.Map()),
    _teamNameToPublicitySettings: state.teams.getIn(['teamNameToPublicitySettings'], I.Map()),
    _teamNameToAllowPromote: state.teams.getIn(['teamNameToAllowPromote'], I.Map()),
    _teamNameToIsShowcasing: state.teams.getIn(['teamNameToIsShowcasing'], I.Map()),
    _teamNameToRole: state.teams.getIn(['teamNameToRole'], I.Map()),
    _them: routeProps.get('username'),
    teamnames: getSortedTeamnames(state),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  loadAllTeams: () => dispatch(TeamsGen.createGetDetailsForAllTeams()),
  loadTeamList: () => dispatch(TeamsGen.createGetTeams()),
  _onAddToTeams: (role: string, teams: Array<string>, user: string) =>
    dispatch(TeamsGen.createAddUserToTeams({role, teams, user})),
  onBack: () => dispatch(navigateUp()),
  onOpenRolePicker: (role: string, onComplete: (string, boolean) => void) => {
    dispatch(
      navigateAppend([
        {
          props: {
            allowOwner: true,
            onComplete,
            selectedRole: role,
            sendNotificationChecked: true,
            showNotificationCheckbox: false,
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
    onAddToTeams: (role: string, teams: Array<string>) =>
      dispatchProps._onAddToTeams(role, teams, stateProps._them),
    teamNameToIsOpen: stateProps._teamNameToIsOpen.toObject(),
    teammembercounts: stateProps._teammembercounts.toObject(),
    teamNameToAllowPromote: stateProps._teamNameToAllowPromote.toObject(),
    teamNameToCanPerform: stateProps._teamNameToCanPerform.toObject(),
    teamNameToIsShowcasing: stateProps._teamNameToIsShowcasing.toObject(),
    teamNameToMembers: stateProps._teamNameToMembers.toObject(),
    teamNameToRole: stateProps._teamNameToRole.toObject(),
    them: stateProps._them,
    title: `Add ${stateProps._them} to teams`,
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
