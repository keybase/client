import * as React from 'react'
import {Reloadable} from '../../common-adapters'
import * as SettingsGen from '../../actions/settings-gen'
import * as Container from '../../util/container'
import Notifications, {Props} from '.'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/settings'

type OwnProps = {}

type ExtraProps = {
  onRefresh: () => void
  title: string
}

const ReloadableNotifications = (props: Props & ExtraProps) => {
  const {title, onRefresh, ...rest} = props
  return (
    <Reloadable
      onBack={Container.isMobile ? props.onBack : undefined}
      waitingKeys={[Constants.refreshNotificationsWaitingKey, Constants.loadSettingsWaitingKey]}
      onReload={onRefresh}
      reloadOnMount={true}
      title={title}
    >
      <Notifications {...rest} />
    </Reloadable>
  )
}

ReloadableNotifications.navigationOptions = {
  header: undefined,
  title: 'Notifications',
}

export default Container.connect(
  state => ({
    _groups: state.settings.notifications.groups,
    allowEdit: state.settings.notifications.allowEdit,
    mobileHasPermissions: state.push.hasPermissions,
    showEmailSection: !!state.settings.email.emails && state.settings.email.emails.size > 0,
    waitingForResponse: Container.anyWaiting(state, Constants.settingsWaitingKey),
  }),
  dispatch => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onClickYourAccount: () => dispatch(RouteTreeGen.createNavigateAppend({path: [Constants.accountTab]})),
    onRefresh: () => {
      dispatch(SettingsGen.createLoadSettings())
      dispatch(SettingsGen.createNotificationsRefresh())
    },
    onToggle: (group: string, name?: string) =>
      dispatch(SettingsGen.createNotificationsToggle({group, name})),
    onToggleUnsubscribeAll: (group: string) => dispatch(SettingsGen.createNotificationsToggle({group})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    ...dispatchProps,
    allowEdit: stateProps.allowEdit,
    groups: stateProps._groups,
    mobileHasPermissions: stateProps.mobileHasPermissions,
    showEmailSection: stateProps.showEmailSection,
    waitingForResponse: stateProps.waitingForResponse,
  })
)(ReloadableNotifications)
