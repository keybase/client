// @flow
import * as TeamsGen from '../../../actions/teams-gen'
import {connect, type RouteProps} from '../../../util/container'
import ReallyLeaveTeam from '.'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {teamsTab} from '../../../constants/tabs'

type OwnProps = RouteProps<{username: string, teamname: string, email: string}, {}>

const mapStateToProps = (state, {routeProps}) => ({
  member: routeProps.get('username') || routeProps.get('email'),
  name: routeProps.get('teamname'),
})

const mapDispatchToProps = (dispatch, {navigateUp, routeProps}) => ({
  onClose: () => dispatch(navigateUp()),
  onRemove: () => {
    dispatch(
      TeamsGen.createRemoveMemberOrPendingInvite({
        email: routeProps.get('email'),
        inviteID: '',
        teamname: routeProps.get('teamname'),
        username: routeProps.get('username'),
      })
    )
    dispatch(RouteTreeGen.createNavigateTo({path: [teamsTab, {props: {teamname: routeProps.get('teamname')}, selected: 'team'}]}))
    dispatch(TeamsGen.createGetDetails({teamname: routeProps.get('teamname')}))
  },
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(ReallyLeaveTeam)
