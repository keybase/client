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
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onJoinTeam: (teamname: string) => dispatch(TeamsGen.createJoinTeam({teamname})),
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(JoinTeam)
