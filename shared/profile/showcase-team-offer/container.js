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
    _teamNameToAllowPromote: state.entities.getIn(['teams', 'teamNameToAllowPromote'], I.Map()),
    _teamNameToIsShowcasing: state.entities.getIn(['teams', 'teamNameToIsShowcasing'], I.Map()),
    _teamNameToRole: state.entities.getIn(['teams', 'teamNameToRole'], I.Map()),
    _waiting: state.waiting,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  loadPublicitySettings: teamname => dispatch(TeamsGen.createGetTeamPublicity({teamname})),
  loadTeamOperations: teamname => dispatch(TeamsGen.createGetTeamOperations({teamname})),
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
  lifecycle({}),
  branch(() => isMobile, HeaderHoc)
)(Render)
