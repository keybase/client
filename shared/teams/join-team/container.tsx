import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import JoinTeamDialog from '.'
import {upperFirst} from 'lodash-es'
import * as Container from '../../util/container'

type OwnProps = {}

export default Container.compose(
  Container.connect(
    state => ({
      errorText: upperFirst(state.teams.teamJoinError),
      success: state.teams.teamJoinSuccess,
      successTeamName: state.teams.teamJoinSuccessTeamName,
    }),
    dispatch => ({
      _onJoinTeam: (teamname: string) => {
        dispatch(TeamsGen.createJoinTeam({teamname}))
      },
      _onSetTeamJoinError: (error: string) => {
        dispatch(TeamsGen.createSetTeamJoinError({error}))
      },
      _onSetTeamJoinSuccess: (success: boolean, teamname: string) => {
        dispatch(TeamsGen.createSetTeamJoinSuccess({success, teamname}))
      },
      onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    }),
    (s, d, o: OwnProps) => ({...o, ...s, ...d})
  ),
  Container.withStateHandlers(
    {name: ''},
    {onNameChange: () => (name: string) => ({name: name.toLowerCase()})}
  ),
  Container.withHandlers({
    onSubmit: ({name, _onJoinTeam}) => () => _onJoinTeam(name),
  } as any),
  Container.lifecycle({
    componentDidMount() {
      this.props._onSetTeamJoinError('')
      this.props._onSetTeamJoinSuccess(false, null)
    },
  } as any)
)(JoinTeamDialog as any)
