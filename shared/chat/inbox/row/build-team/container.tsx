import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {teamsTab} from '../../../../constants/tabs'
import {namedConnect} from '../../../../util/container'
import BuildTeam from '.'

type OwnProps = {}

export default namedConnect(
  state => ({
    showBuildATeam: ((state.chat2.inboxLayout && state.chat2.inboxLayout.bigTeams) || []).length === 0,
  }),
  dispatch => ({
    // Route to the teams tab and open the NewTeamDialog component
    _onBuildTeam: () => dispatch(RouteTreeGen.createSwitchTab({tab: teamsTab})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    onBuildTeam: dispatchProps._onBuildTeam,
    showBuildATeam: stateProps.showBuildATeam,
  }),
  'BuildTeam'
)(BuildTeam)
