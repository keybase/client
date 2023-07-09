import * as Constants from '../../constants/teams'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ConfigConstants from '../../constants/config'
import * as Tracker2Constants from '../../constants/tracker2'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import * as WaitingConstants from '../../constants/waiting'
import Render from '.'

export default () => {
  const waiting = WaitingConstants.useWaitingState(s => s.counts)
  const _you = ConfigConstants.useCurrentUserState(s => s.username)
  const teamMeta = Container.useSelector(state => state.teams.teamMeta)
  const dispatch = Container.useDispatch()
  const onCancel = (you: string) => {
    // sadly a little racy, doing this for now
    setTimeout(() => {
      dispatch(
        Tracker2Gen.createLoad({
          assertion: you,
          guiID: Tracker2Constants.generateGUIID(),
          ignoreCache: true,
          inTracker: false,
          reason: '',
        })
      )
    }, 500)
    dispatch(RouteTreeGen.createNavigateUp())
  }

  const setMemberPublicity = Constants.useState(s => s.dispatch.setMemberPublicity)
  const onPromote = setMemberPublicity
  const props = {
    onCancel: () => onCancel(_you),
    onPromote,
    teams: Constants.sortTeamsByName(teamMeta),
    waiting,
  }
  return <Render {...props} />
}
