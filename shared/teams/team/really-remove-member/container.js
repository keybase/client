// @flow
import {connect, type TypedState} from '../../../util/container'
import * as Creators from '../../../actions/teams/creators'
import ReallyLeaveTeam from '.'
import {navigateTo} from '../../../actions/route-tree'
import {teamsTab} from '../../../constants/tabs'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  name: routeProps.get('teamname'),
  username: routeProps.get('username'),
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  onClose: () => dispatch(navigateUp()),
  onRemove: () => {
    dispatch(Creators.removeMember(routeProps.get('teamname'), routeProps.get('username')))
    dispatch(navigateTo([teamsTab, {selected: 'team', props: {teamname: routeProps.get('teamname')}}]))
    dispatch(Creators.getDetails(routeProps.get('teamname')))
  },
})

export default connect(mapStateToProps, mapDispatchToProps)(ReallyLeaveTeam)
