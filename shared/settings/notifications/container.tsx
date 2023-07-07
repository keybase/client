import {Reloadable} from '../../common-adapters'
import * as Container from '../../util/container'
import Notifications, {type Props} from '.'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/settings'

const ReloadableNotifications = (props: Props) => {
  const loadSettings = Constants.useState(s => s.dispatch.loadSettings)
  const refresh = Constants.useNotifState(s => s.dispatch.refresh)

  const onRefresh = () => {
    loadSettings()
    refresh()
  }

  return (
    <Reloadable
      onBack={Container.isMobile ? props.onBack : undefined}
      waitingKeys={[Constants.refreshNotificationsWaitingKey, Constants.loadSettingsWaitingKey]}
      onReload={onRefresh}
      reloadOnMount={true}
    >
      <Notifications {...props} />
    </Reloadable>
  )
}

export default () => {
  const _groups = Constants.useNotifState(s => s.groups)
  const allowEdit = Constants.useNotifState(s => s.allowEdit)
  const toggle = Constants.useNotifState(s => s.dispatch.toggle)
  const showEmailSection = Constants.useEmailState(s => s.emails.size > 0)
  const waitingForResponse = Container.useAnyWaiting(Constants.settingsWaitingKey)

  const dispatch = Container.useDispatch()
  const onBack = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onClickYourAccount = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [Constants.accountTab]}))
  }
  const onToggle = toggle
  const onToggleUnsubscribeAll = toggle
  const props = {
    allowEdit,
    groups: _groups,
    onBack,
    onClickYourAccount,
    onToggle,
    onToggleUnsubscribeAll,
    showEmailSection: showEmailSection,
    waitingForResponse: waitingForResponse,
  }
  return <ReloadableNotifications {...props} />
}
