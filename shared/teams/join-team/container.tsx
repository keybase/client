import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import JoinTeam from '.'
import upperFirst from 'lodash/upperFirst'
import * as Container from '../../util/container'

type OwnProps = {}

export default Container.connect(
  state => ({
    errorText: upperFirst(state.teams.errorInTeamJoin),
    open: state.teams.teamJoinSuccessOpen,
    success: state.teams.teamJoinSuccess,
    successTeamName: state.teams.teamJoinSuccessTeamName,
  }),
  dispatch => ({
    _onSetTeamJoinError: (error: string) => dispatch(TeamsGen.createSetTeamJoinError({error})),
    _onSetTeamJoinSuccess: (open: boolean, success: boolean, teamname: string) =>
      dispatch(TeamsGen.createSetTeamJoinSuccess({open, success, teamname})),
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onJoinTeam: (teamname: string) => dispatch(TeamsGen.createJoinTeam({teamname})),
  }),
  (s, d, o: OwnProps) => {
    const {_onSetTeamJoinError, _onSetTeamJoinSuccess, ...dRest} = d
    return {
      ...o,
      ...s,
      ...dRest,
      load: () => {
        _onSetTeamJoinError('')
        _onSetTeamJoinSuccess(false, false, '')
      },
    }
  }
)(JoinTeam)
