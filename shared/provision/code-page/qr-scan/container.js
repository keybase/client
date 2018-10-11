// @flow
import * as ConfigGen from '../../../actions/config-gen'
import * as ProvisionGen from '../../../actions/provision-gen'
import * as Constants from '../../../constants/provision'
import * as WaitingConstants from '../../../constants/waiting'
import CodePage2 from '.'
import {
  setDisplayName,
  withProps,
  compose,
  withStateHandlers,
  connect,
  safeSubmit,
  type TypedState,
} from '../../../util/container'
import HiddenString from '../../../util/hidden-string'

const mapStateToProps = (state: TypedState) => ({
  error: state.provision.error.stringValue(),
  waiting: WaitingConstants.anyWaiting(state, Constants.waitingKey),
})

const mapDispatchToProps = (dispatch) => ({
  onOpenSettings: () => dispatch(ConfigGen.createOpenAppSettings()),
  onSubmitTextCode: (code: string) =>
    dispatch(ProvisionGen.createSubmitTextCode({phrase: new HiddenString(code)})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  error: stateProps.error,
  onOpenSettings: dispatchProps.onOpenSettings,
  onSubmitTextCode: dispatchProps.onSubmitTextCode,
  waiting: stateProps.waiting,
})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  setDisplayName('QRScan'),
  safeSubmit(['onSubmitTextCode'], ['error']),
  withStateHandlers(
    {mountKey: '0'},
    {incrementMountKey: ({mountKey}) => () => ({mountKey: String(Number(mountKey) + 1)})}
  ),
  withProps(p => ({
    onOpenSettings: () => {
      // When they click open settings we force a remount
      p.onOpenSettings()
      setTimeout(() => p.incrementMountKey(), 1000)
    },
  }))
)(CodePage2)
