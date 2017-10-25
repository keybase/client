// @flow
import {connect, type TypedState} from '../../../util/container'
import * as Creators from '../../../actions/teams/creators'
import ReallyLeaveTeam from '.'
import {navigateTo} from '../../../actions/route-tree'
import {teamsTab} from '../../../constants/tabs'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  email: routeProps.get('email'),
  name: routeProps.get('teamname'),
  username: routeProps.get('username'),
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  onClose: () => dispatch(navigateUp()),
  onRemove: () => {
    dispatch(
      Creators.removeMember(routeProps.get('email'), routeProps.get('teamname'), routeProps.get('username'))
    )
    dispatch(navigateTo([teamsTab, {props: {teamname: routeProps.get('teamname')}, selected: 'team'}]))
    dispatch(Creators.getDetails(routeProps.get('teamname')))
  },
})

export default connect(mapStateToProps, mapDispatchToProps)(ReallyLeaveTeam)
