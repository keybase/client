// @flow
import * as SettingsGen from '../../actions/settings-gen'
import * as Types from '../../constants/types/settings'
import {connect, type TypedState, lifecycle, compose} from '../../util/container'
import Notifications from './index'
import {navigateUp} from '../../actions/route-tree'
import * as ConfigGen from '../../actions/config-gen'

const mapStateToProps = (state: TypedState, ownProps: {}) => ({
  ...state.settings.notifications,
  mobileHasPermissions: state.push.hasPermissions,
  waitingForResponse: state.settings.waitingForResponse,
  sound: state.config.notifySound,
})

const mapDispatchToProps = (dispatch: any, ownProps: {}) => ({
  onBack: () => dispatch(navigateUp()),
  onToggle: (group: Types.NotificationGroups, name?: string) =>
    dispatch(SettingsGen.createNotificationsToggle({group, name})),
  onToggleUnsubscribeAll: (group: Types.NotificationGroups) =>
    dispatch(SettingsGen.createNotificationsToggle({group})),
  onRefresh: () => dispatch(SettingsGen.createNotificationsRefresh()),
  title: 'Notifications',
  onToggleSound: (sound: boolean) => dispatch(ConfigGen.createSetNotifySound({sound, writeFile: true})),
})
export default compose(
  connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d})),
  lifecycle({
    componentDidMount() {
      this.props.onRefresh()
    },
  })
)(Notifications)
