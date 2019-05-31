import * as TeamsGen from '../../../actions/teams-gen'
import * as Container from '../../../util/container'
import ReallyLeaveTeam from '.'
import * as RouteTreeGen from '../../../actions/route-tree-gen'

type OwnProps = Container.RouteProps<
  {
    username: string
    teamname: string
    email: string
  },
  {}
>

const mapStateToProps = (state, ownProps) => ({
  member: Container.getRouteProps(ownProps, 'username') || Container.getRouteProps(ownProps, 'email'),
  name: Container.getRouteProps(ownProps, 'teamname'),
})

const mapDispatchToProps = (dispatch, ownProps) => {
  const teamname = Container.getRouteProps(ownProps, 'teamname')
  const email = Container.getRouteProps(ownProps, 'email')
  const username = Container.getRouteProps(ownProps, 'username')
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
      dispatch(RouteTreeGen.createNavUpToScreen({routeName: 'team'}))
      dispatch(TeamsGen.createGetDetails({teamname}))
    },
  }
}

export default Container.connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d}))(
  ReallyLeaveTeam
)
