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
    _teamNameToIsOpen: state.entities.getIn(['teams', 'teamNameToIsOpen'], I.Map()),
    _teammembercounts: state.entities.getIn(['teams', 'teammembercounts'], I.Map()),
    _teamnames: state.entities.getIn(['teams', 'teamnames'], I.Set()),
    _teamNameToCanPerform: state.entities.getIn(['teams', 'teamNameToCanPerform'], I.Map()),
    _teamNameToPublicitySettings: state.entities.getIn(['teams', 'teamNameToPublicitySettings'], I.Map()),
    _waiting: state.waiting,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  loadTeam: teamname => dispatch(TeamsGen.createGetDetails({teamname})),
  onBack: () => dispatch(navigateUp()),
  onPromote: (teamname, showcase) => dispatch(TeamsGen.createSetMemberPublicity({showcase, teamname})),
})

const mergeProps = (stateProps, dispatchProps) => {
  let teamnames = stateProps._teamnames.toArray()
  teamnames.sort((a, b) => sortTeamnames(a, b))

  return {
    ...stateProps,
    ...dispatchProps,
    teamNameToIsOpen: stateProps._teamNameToIsOpen.toObject(),
    teammembercounts: stateProps._teammembercounts.toObject(),
    teamNameToCanPerform: stateProps._teamNameToCanPerform.toObject(),
    teamNameToPublicitySettings: stateProps._teamNameToPublicitySettings.toObject(),
    teamnames,
    title: 'Showcase teams',
    waiting: stateProps._waiting.toObject(),
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentWillMount: function() {
      this.props.teamnames.map(name => {
        !this.props._teamNameToPublicitySettings.get(name) && this.props.loadTeam(name)
      })
    },
  }),
  branch(() => isMobile, HeaderHoc)
)(Render)
