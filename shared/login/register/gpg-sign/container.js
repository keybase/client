// @flow
import * as LoginGen from '../../../actions/login-gen'
import {connect, type Dispatch} from '../../../util/container'
import GPGSign from '.'

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(LoginGen.createOnBack()),
  onSubmit: exportKey => dispatch(LoginGen.createChooseGPGMethod({exportKey})),
})

export default connect(
  null,
  mapDispatchToProps
)(GPGSign)
