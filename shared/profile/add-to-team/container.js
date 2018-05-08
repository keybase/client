// @flow
import * as I from 'immutable'
import Render from './index'
import {branch, compose, connect, lifecycle, withStateHandlers, type TypedState} from '../../util/container'
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
    _teamNameToPublicitySettings: state.teams.getIn(['teamNameToPublicitySettings'], I.Map()),
    _teamNameToAllowPromote: state.teams.getIn(['teamNameToAllowPromote'], I.Map()),
    _teamNameToIsShowcasing: state.teams.getIn(['teamNameToIsShowcasing'], I.Map()),
    _teamNameToRole: state.teams.getIn(['teamNameToRole'], I.Map()),
    _them: routeProps.get('username'),
    _waiting: state.waiting,
    teamnames: getSortedTeamnames(state),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  loadTeams: teamname => dispatch(TeamsGen.createGetTeams()),
  onBack: () => dispatch(navigateUp()),
  onPromote: (teamname, showcase) => dispatch(TeamsGen.createSetMemberPublicity({showcase, teamname})),
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
    teamNameToIsOpen: stateProps._teamNameToIsOpen.toObject(),
    teammembercounts: stateProps._teammembercounts.toObject(),
    teamNameToAllowPromote: stateProps._teamNameToAllowPromote.toObject(),
    teamNameToIsShowcasing: stateProps._teamNameToIsShowcasing.toObject(),
    teamNameToRole: stateProps._teamNameToRole.toObject(),
    them: stateProps._them,
    title: 'Publish your teams',
    waiting: stateProps._waiting.toObject(),
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  compose(
    withStateHandlers(
      {role: 'writer', sendNotification: true},
      {
        setSendNotification: () => sendNotification => ({sendNotification}),
        onRoleChange: () => role => ({role}),
      }
    ),
  ),
  lifecycle({
    componentDidMount() {
      this.props.loadTeams()
    },
  }),
  branch(() => isMobile, HeaderHoc)
)(Render)
