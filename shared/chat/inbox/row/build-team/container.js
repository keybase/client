// @flow
import * as Route from '../../../../actions/route-tree'
import {teamsTab} from '../../../../constants/tabs'
import {connect} from '../../../../util/container'
import type {TypedState, Dispatch} from '../../../../util/container'
import BuildTeam from '.'

const mapStateToProps = (state: TypedState) => ({
  showBuildATeam: state.teams.teamnames.size === 0,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  // Route to the teams tab and open the NewTeamDialog component
  _onBuildTeam: () => dispatch(Route.navigateTo([teamsTab])),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  onBuildTeam: dispatchProps._onBuildTeam,
  showBuildATeam: stateProps.showBuildATeam,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(BuildTeam)
