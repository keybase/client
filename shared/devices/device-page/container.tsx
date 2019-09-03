import * as Container from '../../util/container'
import * as Constants from '../../constants/devices'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import DevicePage from '.'

type OwnProps = Container.RouteProps<{deviceID: string}>

// TODO(newRouter) after committing to new router:
// remove action and code that sets state.devices.selectedDeviceID.
// It's a bad pattern to have navigation distributed across react-navigation
// and our store. device id is purely an argument to the screen, the store
// doesn't care about it.
export default Container.connect(
  (state: Container.TypedState, ownProps: OwnProps) => {
    const id = Container.getRouteProps(ownProps, 'deviceID', '')
    return {iconNumber: Constants.getDeviceIconNumber(state, id), id}
  },
  dispatch => ({
    onBack: () => {
      Container.isMobile && dispatch(RouteTreeGen.createNavigateUp())
    },
  }),
  (stateProps, dispatchProps) => ({
    iconNumber: stateProps.iconNumber,
    id: stateProps.id,
    onBack: dispatchProps.onBack,
  })
)(DevicePage)
