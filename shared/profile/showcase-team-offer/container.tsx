import * as C from '../../constants'
import * as Constants from '../../constants/teams'
import * as Tracker2Constants from '../../constants/tracker2'
import Render from '.'

export default () => {
  const waiting = C.useWaitingState(s => s.counts)
  const _you = C.useCurrentUserState(s => s.username)
  const teamMeta = C.useTeamsState(s => s.teamMeta)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = (you: string) => {
    // sadly a little racy, doing this for now
    setTimeout(() => {
      C.useTrackerState.getState().dispatch.load({
        assertion: you,
        guiID: Tracker2Constants.generateGUIID(),
        ignoreCache: true,
        inTracker: false,
        reason: '',
      })
    }, 500)
    navigateUp()
  }

  const setMemberPublicity = C.useTeamsState(s => s.dispatch.setMemberPublicity)
  const onPromote = setMemberPublicity
  const props = {
    onCancel: () => onCancel(_you),
    onPromote,
    teams: Constants.sortTeamsByName(teamMeta),
    waiting,
  }
  return <Render {...props} />
}
