// @flow
import * as Route from '../../../../actions/route-tree'
import {teamsTab} from '../../../../constants/tabs'
import {namedConnect} from '../../../../util/container'
import BuildTeam from '.'

const mapStateToProps = state => ({
  metaMap: state.chat2.metaMap,
})

const mapDispatchToProps = dispatch => ({
  // Route to the teams tab and open the NewTeamDialog component
  _onBuildTeam: () => dispatch(Route.navigateTo([teamsTab])),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  onBuildTeam: dispatchProps._onBuildTeam,
  showBuildATeam: !stateProps.metaMap.some(m => m.teamType !== 'adhoc'),
})

export default namedConnect<OwnProps, _,_,_,_>(mapStateToProps, mapDispatchToProps, mergeProps, 'BuildTeam')(BuildTeam)
