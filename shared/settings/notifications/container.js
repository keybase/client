// @flow
import * as SettingsGen from '../../actions/settings-gen'
import * as Types from '../../constants/types/settings'
import {connect, lifecycle, compose} from '../../util/container'
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
export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  lifecycle({
    componentDidMount() {
      this.props.onRefresh()
    },
  })
)(Notifications)
