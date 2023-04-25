import {Reloadable} from '../../common-adapters'
import * as SettingsGen from '../../actions/settings-gen'
import * as Container from '../../util/container'
import Notifications, {type Props} from '.'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/settings'

const ReloadableNotifications = (props: Props) => {
  const dispatch = Container.useDispatch()

  const onRefresh = () => {
    dispatch(SettingsGen.createLoadSettings())
    dispatch(SettingsGen.createNotificationsRefresh())
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

export const options = {
  header: undefined,
  title: 'Notifications',
}

export default () => {
  const _groups = Container.useSelector(state => state.settings.notifications.groups)
  const allowEdit = Container.useSelector(state => state.settings.notifications.allowEdit)
  const showEmailSection = Container.useSelector(
    state => !!state.settings.email.emails && state.settings.email.emails.size > 0
  )
  const waitingForResponse = Container.useSelector(state =>
    Container.anyWaiting(state, Constants.settingsWaitingKey)
  )

  const dispatch = Container.useDispatch()
  const onBack = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onClickYourAccount = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [Constants.accountTab]}))
  }
  const onToggle = (group: string, name?: string) => {
    dispatch(SettingsGen.createNotificationsToggle({group, name}))
  }
  const onToggleUnsubscribeAll = (group: string) => {
    dispatch(SettingsGen.createNotificationsToggle({group}))
  }
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
