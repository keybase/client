// @flow
import {connect, type TypedState} from '../../util/container'
import * as Creators from '../../actions/teams/creators'
import ReallyLeaveTeam from '.'
import {navigateTo} from '../../actions/route-tree'
import {teamsTab} from '../../constants/tabs'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  name: routeProps.get('teamname'),
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  onClose: () => dispatch(navigateUp()),
  onLeave: () => {
    dispatch(Creators.leaveTeam(routeProps.get('teamname')))
    dispatch(navigateTo([teamsTab]))
    dispatch(Creators.getTeams())
  },
})

export default connect(mapStateToProps, mapDispatchToProps)(ReallyLeaveTeam)
