// @flow
import * as SettingsGen from '../../actions/settings-gen'
import * as PushGen from '../../actions/push-gen'
import * as PushConstants from '../../constants/push'
import {connect, type TypedState, lifecycle, compose} from '../../util/container'
import Notifications from './index'
import {navigateUp} from '../../actions/route-tree'

const mapStateToProps = (state: TypedState, ownProps: {}) => ({
  ...state.settings.notifications,
  waitingForResponse: state.settings.waitingForResponse,
  showPushNotificationsButton: PushConstants.showSettingsBadge(state),
})

const mapDispatchToProps = (dispatch: any, ownProps: {}) => ({
  onBack: () => dispatch(navigateUp()),
  onToggle: (group: string, name?: string) => dispatch(SettingsGen.createNotificationsToggle({group, name})),
  onToggleUnsubscribeAll: (group: string) => dispatch(SettingsGen.createNotificationsToggle({group})),
  onRefresh: () => dispatch(SettingsGen.createNotificationsRefresh()),
  onAcceptPush: () => dispatch(PushGen.createPermissionsRequest({showIOSSettingsOnFail: true})),
  title: 'Notifications',
})
export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentWillMount: function() {
      this.props.onRefresh()
    },
  })
)(Notifications)
