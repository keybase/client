// @flow
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {teamsTab} from '../../../../constants/tabs'
import {namedConnect} from '../../../../util/container'
import BuildTeam from '.'

type OwnProps = {||}

const mapStateToProps = state => ({
  metaMap: state.chat2.metaMap,
})

const mapDispatchToProps = dispatch => ({
  // Route to the teams tab and open the NewTeamDialog component
  _onBuildTeam: () => dispatch(RouteTreeGen.createNavigateTo({path: [teamsTab]})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  onBuildTeam: dispatchProps._onBuildTeam,
  showBuildATeam: !stateProps.metaMap.some(m => m.teamType !== 'adhoc'),
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'BuildTeam'
)(BuildTeam)
