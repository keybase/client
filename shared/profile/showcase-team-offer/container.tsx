import * as Constants from '../../constants/teams'
import * as C from '../../constants'
import * as ConfigConstants from '../../constants/config'
import * as Tracker2Constants from '../../constants/tracker2'
import * as WaitingConstants from '../../constants/waiting'
import Render from '.'

export default () => {
  const waiting = WaitingConstants.useWaitingState(s => s.counts)
  const _you = ConfigConstants.useCurrentUserState(s => s.username)
  const teamMeta = Constants.useState(s => s.teamMeta)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = (you: string) => {
    // sadly a little racy, doing this for now
    setTimeout(() => {
      Tracker2Constants.useState.getState().dispatch.load({
        assertion: you,
        guiID: Tracker2Constants.generateGUIID(),
        ignoreCache: true,
        inTracker: false,
        reason: '',
      })
    }, 500)
    navigateUp()
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
