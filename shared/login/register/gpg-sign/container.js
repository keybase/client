// @flow
import * as LoginGen from '../../../actions/login-gen'
import {connect, type Dispatch} from '../../../util/container'
import {type RouteProps} from '../../../route-tree/render-route'
import GPGSign from '.'

type OwnProps = RouteProps<{}, {}>

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  onBack: () => dispatch(ownProps.navigateUp()),
  onSubmit: exportKey => dispatch(LoginGen.createSubmitProvisionGPGMethod({exportKey})),
})

export default connect(undefined, mapDispatchToProps)(GPGSign)
