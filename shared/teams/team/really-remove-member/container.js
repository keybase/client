// @flow
import * as TeamsGen from '../../../actions/teams-gen'
import {connect, type TypedState} from '../../../util/container'
import ReallyLeaveTeam from '.'
import {navigateTo} from '../../../actions/route-tree'
import {teamsTab} from '../../../constants/tabs'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  member: routeProps.get('username') || routeProps.get('email'),
  name: routeProps.get('teamname'),
})

const mapDispatchToProps = (dispatch, {navigateUp, routeProps}) => ({
  onClose: () => dispatch(navigateUp()),
  onRemove: () => {
    dispatch(
      TeamsGen.createRemoveMemberOrPendingInvite({
        email: routeProps.get('email'),
        teamname: routeProps.get('teamname'),
        username: routeProps.get('username'),
        inviteID: '',
      })
    )
    dispatch(navigateTo([teamsTab, {props: {teamname: routeProps.get('teamname')}, selected: 'team'}]))
    dispatch(TeamsGen.createGetDetails({teamname: routeProps.get('teamname')}))
  },
})

export default connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d}))(
  ReallyLeaveTeam
)
