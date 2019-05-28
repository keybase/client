import * as React from 'react'
import {Reloadable} from '../../common-adapters'
import * as SettingsGen from '../../actions/settings-gen'
import {refreshNotificationsWaitingKey} from '../../constants/settings'
import {connect, isMobile} from '../../util/container'
import Notifications from './index'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ConfigGen from '../../actions/config-gen'

type OwnProps = {}
const mapStateToProps = (state, ownProps: {}) => ({
  allowEdit: state.settings.notifications.allowEdit,
  groups: state.settings.notifications.groups.toJS(),
  mobileHasPermissions: state.push.hasPermissions,
  sound: state.config.notifySound,
  waitingForResponse: state.settings.waitingForResponse,
})

const mapDispatchToProps = (dispatch: any, ownProps: {}) => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onRefresh: () => dispatch(SettingsGen.createNotificationsRefresh()),
  onToggle: (group: string, name?: string) => dispatch(SettingsGen.createNotificationsToggle({group, name})),
  onToggleSound: (sound: boolean) => dispatch(ConfigGen.createSetNotifySound({sound, writeFile: true})),
  onToggleUnsubscribeAll: (group: string) => dispatch(SettingsGen.createNotificationsToggle({group})),
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

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(ReloadableNotifications)
