// @flow
import * as I from 'immutable'
import Render from './index'
import {compose, connect, lifecycle, type RouteProps} from '../../util/container'
import * as TeamsGen from '../../actions/teams-gen'
import {HeaderOrPopup} from '../../common-adapters'
import {getSortedTeamnames} from '../../constants/teams'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => {
  return {
    _teamNameToIsOpen: state.teams.getIn(['teamNameToIsOpen'], I.Map()),
    _teammembercounts: state.teams.getIn(['teammembercounts'], I.Map()),
    _teamNameToCanPerform: state.teams.getIn(['teamNameToCanPerform'], I.Map()),
    _teamNameToPublicitySettings: state.teams.getIn(['teamNameToPublicitySettings'], I.Map()),
    _teamNameToAllowPromote: state.teams.getIn(['teamNameToAllowPromote'], I.Map()),
    _teamNameToIsShowcasing: state.teams.getIn(['teamNameToIsShowcasing'], I.Map()),
    _teamNameToRole: state.teams.getIn(['teamNameToRole'], I.Map()),
    _waiting: state.waiting,
    teamnames: getSortedTeamnames(state),
  }
}

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  loadTeams: teamname => dispatch(TeamsGen.createGetTeams()),
  onCancel: () => dispatch(navigateUp()),
  onPromote: (teamname, showcase) => dispatch(TeamsGen.createSetMemberPublicity({showcase, teamname})),
})

const mergeProps = (stateProps, dispatchProps) => {
  return {
    ...stateProps,
    ...dispatchProps,
    customCancelText: 'Close',
    teamNameToIsOpen: stateProps._teamNameToIsOpen.toObject(),
    teammembercounts: stateProps._teammembercounts.toObject(),
    teamNameToAllowPromote: stateProps._teamNameToAllowPromote.toObject(),
    teamNameToIsShowcasing: stateProps._teamNameToIsShowcasing.toObject(),
    teamNameToRole: stateProps._teamNameToRole.toObject(),
    title: 'Publish your teams',
    waiting: stateProps._waiting.toObject(),
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
      this.props.loadTeams()
    },
  })
)(HeaderOrPopup(Render))
