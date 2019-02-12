// @flow
import * as React from 'react'
import {Reloadable} from '../../common-adapters'
import * as SettingsGen from '../../actions/settings-gen'
import {refreshNotificationsWaitingKey} from '../../constants/settings'
import * as Types from '../../constants/types/settings'
import {connect, isMobile} from '../../util/container'
import Notifications from './index'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ConfigGen from '../../actions/config-gen'

type OwnProps = {||}
const mapStateToProps = (state, ownProps: {}) => ({
  ...state.settings.notifications,
  mobileHasPermissions: state.push.hasPermissions,
  sound: state.config.notifySound,
  waitingForResponse: state.settings.waitingForResponse,
})

const mapDispatchToProps = (dispatch: any, ownProps: {}) => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onRefresh: () => dispatch(SettingsGen.createNotificationsRefresh()),
  onToggle: (group: Types.NotificationGroups, name?: string) =>
    dispatch(SettingsGen.createNotificationsToggle({group, name})),
  onToggleSound: (sound: boolean) => dispatch(ConfigGen.createSetNotifySound({sound, writeFile: true})),
  onToggleUnsubscribeAll: (group: Types.NotificationGroups) =>
    dispatch(SettingsGen.createNotificationsToggle({group})),
  title: 'Notifications',
})

const ReloadableNotifications = props => (
  <Reloadable
    onBack={isMobile ? props.onBack : undefined}
    waitingKeys={refreshNotificationsWaitingKey}
    onReload={props.onRefresh}
    reloadOnMount={true}
    title={props.title}
  >
    <Notifications {...props} />
  </Reloadable>
)

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(ReloadableNotifications)
