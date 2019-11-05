import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Container from '../../../../util/container'
import {teamsTab} from '../../../../constants/tabs'
import BuildTeam from '.'

type OwnProps = Container.PropsWithSafeNavigation<{}>

export default Container.namedConnect(
  state => ({
    showBuildATeam: ((state.chat2.inboxLayout && state.chat2.inboxLayout.bigTeams) || []).length === 0,
  }),
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
  (stateProps, dispatchProps, _: OwnProps) => ({
    onCreateTeam: dispatchProps._onCreateTeam,
    onJoinTeam: dispatchProps._onJoinTeam,
    showBuildATeam: stateProps.showBuildATeam,
  }),
  'BuildTeam'
)(BuildTeam)
