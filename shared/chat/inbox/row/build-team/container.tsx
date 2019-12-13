import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Container from '../../../../util/container'
import {teamsTab} from '../../../../constants/tabs'
import BuildTeam from '.'

type OwnProps = Container.PropsWithSafeNavigation<{}>

export default Container.withSafeNavigation(
  Container.namedConnect(
    _ => ({}),
    (dispatch, {safeNavigateAppendPayload}: OwnProps) => ({
      // Route to the teams tab and open the NewTeamDialog component
      _onCreateTeam: () => {
        dispatch(RouteTreeGen.createSwitchTab({tab: teamsTab}))
        dispatch(safeNavigateAppendPayload({path: ['teamNewTeamDialog']}))
      },
      // Route to the teams tab and open the JoinTeamDialog component
      _onJoinTeam: () => {
        dispatch(RouteTreeGen.createSwitchTab({tab: teamsTab}))
        dispatch(safeNavigateAppendPayload({path: ['teamJoinTeamDialog']}))
      },
    }),
    (_, dispatchProps, __: OwnProps) => ({
      onCreateTeam: dispatchProps._onCreateTeam,
      onJoinTeam: dispatchProps._onJoinTeam,
    }),
    'BuildTeam'
  )(BuildTeam)
)
