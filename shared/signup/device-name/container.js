// @flow
import * as SignupGen from '../../actions/signup-gen'
import DeviceName from '.'
import {compose, connect, withStateHandlers, withHandlers} from '../../util/container'

type OwnProps = {||}

const mapStateToProps = state => ({
  devicename: state.signup.devicename,
  error: state.signup.devicenameError,
})

const mapDispatchToProps = dispatch => ({
  _onSubmit: (devicename: string) => dispatch(SignupGen.createRestartSignup()), // dispatch(SignupGen.createCheckDevicename({devicename})),
  onBack: () => dispatch(SignupGen.createGoBackAndClearErrors()),
})

const Connected = compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  withStateHandlers({deviceName: ''}, {onChangeDevicename: () => deviceName => ({deviceName})}),
  withHandlers({
    onContinue: ({_onSubmit, deviceName}) => () => {
      _onSubmit(deviceName)
    },
  })
)(DeviceName)

// $FlowIssue lets fix this
Connected.navigationOptions = {
  header: undefined,
  headerHideBorder: true,
  headerTransparent: true,
}

export default Connected
