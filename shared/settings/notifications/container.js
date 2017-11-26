// @flow
import * as SettingsGen from '../../actions/settings-gen'
import {connect, type TypedState, lifecycle, compose} from '../../util/container'
import Notifications from './index'
import {navigateUp} from '../../actions/route-tree'

const mapStateToProps = (state: TypedState, ownProps: {}) => ({
  ...state.settings.notifications,
  waitingForResponse: state.settings.waitingForResponse,
})

const mapDispatchToProps = (dispatch: any, ownProps: {}) => ({
  onBack: () => dispatch(navigateUp()),
  onToggle: (group: string, name?: string) => dispatch(SettingsGen.createNotificationsToggle({group, name})),
  onToggleUnsubscribeAll: (group: string) => dispatch(SettingsGen.createNotificationsToggle({group})),
  onRefresh: () => dispatch(SettingsGen.createNotificationsRefresh()),
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
