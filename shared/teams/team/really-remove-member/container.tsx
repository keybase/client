import * as TeamsGen from '../../../actions/teams-gen'
import * as Container from '../../../util/container'
import ReallyLeaveTeam from '.'
import * as RouteTreeGen from '../../../actions/route-tree-gen'

type OwnProps = Container.RouteProps<{
  username: string
  teamname: string
  email: string
  navToChat?: boolean
}>

export default Container.connect(
  (_, ownProps: OwnProps) => ({
    member:
      Container.getRouteProps(ownProps, 'username', '') || Container.getRouteProps(ownProps, 'email', ''),
    name: Container.getRouteProps(ownProps, 'teamname', ''),
    navToChat: Container.getRouteProps(ownProps, 'navToChat', false),
  }),
  (dispatch, ownProps: OwnProps) => {
    const teamname = Container.getRouteProps(ownProps, 'teamname', '')
    const email = Container.getRouteProps(ownProps, 'email', '')
    const username = Container.getRouteProps(ownProps, 'username', '')
    const navToChat = Container.getRouteProps(ownProps, 'navToChat', false)
    return {
      onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
      onRemove: () => {
        dispatch(
          TeamsGen.createRemoveMemberOrPendingInvite({
            email: email,
            inviteID: '',
            teamname,
            username,
          })
        )
        if (navToChat) {
          dispatch(RouteTreeGen.createNavigateUp())
        } else {
          dispatch(RouteTreeGen.createNavUpToScreen({routeName: 'team'}))
          dispatch(TeamsGen.createGetDetails({teamname}))
        }
      },
    }
  },

  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(ReallyLeaveTeam)
