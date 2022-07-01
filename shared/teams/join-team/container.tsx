import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import JoinTeam from '.'
import upperFirst from 'lodash/upperFirst'
import * as Container from '../../util/container'

type OwnProps = Container.RouteProps<'teamJoinTeamDialog'>

export default Container.connect(
  (state, ownProps: OwnProps) => ({
    errorText: upperFirst(state.teams.errorInTeamJoin),
    initialTeamname: ownProps.route.params?.initialTeamname ?? undefined,
    open: state.teams.teamJoinSuccessOpen,
    success: state.teams.teamJoinSuccess,
    successTeamName: state.teams.teamJoinSuccessTeamName,
  }),
  dispatch => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onJoinTeam: (teamname: string) => dispatch(TeamsGen.createJoinTeam({teamname})),
  }),
  (s, d) => ({...s, ...d})
)(JoinTeam)
