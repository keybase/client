// @flow
import * as ConfigGen from '../../../actions/config-gen'
import * as ProvisionGen from '../../../actions/provision-gen'
import * as Constants from '../../../constants/provision'
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

const mapStateToProps = (state: TypedState) => ({
  waiting: !!state.waiting.get(Constants.waitingKey),
})

let lastSubmitTextCode = ''

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onOpenSettings: () => dispatch(ConfigGen.createOpenAppSettings()),
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
  waiting: stateProps.waiting,
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
