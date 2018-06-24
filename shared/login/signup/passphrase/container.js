// @flow
import * as SignupGen from '../../../actions/signup-gen'
import {connect, type TypedState} from '../../../util/container'
import HiddenString from '../../../util/hidden-string'
import Passphrase from '.'

const mapStateToProps = (state: TypedState) => ({
  error: state.signup.passphraseError ? state.signup.passphraseError.stringValue() : '',
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
  onSubmit: (pass1: string, pass2: string) => {
    dispatch(
      SignupGen.createCheckPassphrase({pass1: new HiddenString(pass1), pass2: new HiddenString(pass2)})
    )
  },
})
export default connect(mapStateToProps, mapDispatchToProps)(Passphrase)
