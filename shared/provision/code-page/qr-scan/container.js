// @flow
import * as ProvisionGen from '../../../actions/provision-gen'
import CodePage2 from '.'
import {connect, type TypedState, type Dispatch} from '../../../util/container'
import HiddenString from '../../../util/hidden-string'
import {openAppSettings} from '../../../actions/platform-specific'

const mapStateToProps = (state: TypedState) => {
  // TODO key on remount
  return {}
}

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

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(CodePage2)
