// @flow
import * as I from 'immutable'
import Render from './index'
import {branch, compose, connect, lifecycle, type TypedState} from '../../util/container'
import * as TeamsGen from '../../actions/teams-gen'
import {HeaderHoc} from '../../common-adapters'
import {isMobile} from '../../constants/platform'
import {sortTeamnames} from '../../util/teams'

const mapStateToProps = (state: TypedState) => {
  return {
    _teamNameToIsOpen: state.teams.getIn(['teamNameToIsOpen'], I.Map()),
    _teammembercounts: state.teams.getIn(['teammembercounts'], I.Map()),
    _teamnames: state.teams.getIn(['teamnames'], I.Set()),
    _teamNameToCanPerform: state.teams.getIn(['teamNameToCanPerform'], I.Map()),
    _teamNameToPublicitySettings: state.teams.getIn(['teamNameToPublicitySettings'], I.Map()),
    _teamNameToAllowPromote: state.teams.getIn(['teamNameToAllowPromote'], I.Map()),
    _teamNameToIsShowcasing: state.teams.getIn(['teamNameToIsShowcasing'], I.Map()),
    _teamNameToRole: state.teams.getIn(['teamNameToRole'], I.Map()),
    _waiting: state.waiting,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  loadTeams: teamname => dispatch(TeamsGen.createGetTeams()),
  onBack: () => dispatch(navigateUp()),
  onPromote: (teamname, showcase) => dispatch(TeamsGen.createSetMemberPublicity({showcase, teamname})),
})

const mergeProps = (stateProps, dispatchProps) => {
  let teamnames = stateProps._teamnames.toArray()
  teamnames.sort(sortTeamnames)

  return {
    ...stateProps,
    ...dispatchProps,
    teamNameToIsOpen: stateProps._teamNameToIsOpen.toObject(),
    teammembercounts: stateProps._teammembercounts.toObject(),
    teamNameToAllowPromote: stateProps._teamNameToAllowPromote.toObject(),
    teamNameToIsShowcasing: stateProps._teamNameToIsShowcasing.toObject(),
    teamNameToRole: stateProps._teamNameToRole.toObject(),
    teamnames,
    title: 'Publish your teams',
    waiting: stateProps._waiting.toObject(),
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount() {
      this.props.loadTeams()
    },
  }),
  branch(() => isMobile, HeaderHoc)
)(Render)
