// @flow
import * as ProvisionGen from '../../../actions/provision-gen'
import CodePage2 from '.'
import {
  withProps,
  compose,
  withStateHandlers,
  connect,
  type TypedState,
  type Dispatch,
} from '../../../util/container'
import HiddenString from '../../../util/hidden-string'
import {openAppSettings} from '../../../actions/platform-specific'

const mapStateToProps = (state: TypedState) => ({})

let lastSubmitTextCode = ''

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onOpenSettings: () => openAppSettings(),
  onSubmitTextCode: (code: string) => {
    // Don't keep on submitting the same code. The barcode scanner calls this a bunch of times
    if (lastSubmitTextCode !== code) {
      dispatch(ProvisionGen.createSubmitTextCode({phrase: new HiddenString(code)}))
      lastSubmitTextCode = code
    }
  },
})

const mergeProps = (stateProps, dispatchProps) => ({
  onOpenSettings: dispatchProps.onOpenSettings,
  onSubmitTextCode: dispatchProps.onSubmitTextCode,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withStateHandlers({mountKey: 0}, {incrementMountKey: ({mountKey}) => () => ({mountKey: mountKey + 1})}),
  withProps(p => ({
    onOpenSettings: () => {
      // When they click open settings we force a remount
      p.onOpenSettings()
      setTimeout(() => p.incrementMountKey(), 1000)
    },
  }))
)(CodePage2)
