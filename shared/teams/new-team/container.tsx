import * as Container from '../../util/container'
import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import NewTeamDialog from '.'
import upperFirst from 'lodash/upperFirst'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'

type OwnProps = Container.RouteProps<{subteamOf?: Types.TeamID}>

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const subteamOf = Container.getRouteProps(ownProps, 'subteamOf', undefined) || Types.noTeamID
    const baseTeam = Constants.getTeamMeta(state, subteamOf).teamname
    return {
      baseTeam,
      errorText: upperFirst(state.teams.errorInTeamCreation),
    }
  },
  dispatch => ({
    onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
    onClearError: () => dispatch(TeamsGen.createSetTeamCreationError({error: ''})),
    onSubmit: (teamname: string, joinSubteam: boolean) =>
      dispatch(TeamsGen.createCreateNewTeam({joinSubteam, teamname})),
  }),
  (s, d) => ({...s, ...d})
)(NewTeamDialog)
