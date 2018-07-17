// @flow
import * as ProvisionGen from '../../actions/provision-gen'
import UsernameOrEmail from '.'
import {connect, type TypedState} from '../../util/container'
import {type RouteProps} from '../../route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = (state: TypedState) => ({
  error: state.provision.error.stringValue(),
  // So we can clear the error if the name is changed
  submittedUsernameOrEmail: state.provision.usernameOrEmail,
})

const dispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  onBack: () => dispatch(ownProps.navigateUp()),
  onSubmit: (usernameOrEmail: string) =>
    dispatch(ProvisionGen.createSubmitUsernameOrEmail({usernameOrEmail})),
})

export default connect(mapStateToProps, dispatchToProps)(UsernameOrEmail)
