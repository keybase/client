// @flow
import * as ProvisionGen from '../../actions/provision-gen'
import UsernameOrEmail from '.'
import {compose, connect, safeSubmit} from '../../util/container'
import {type RouteProps} from '../../route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  error: state.provision.error.stringValue(),
  // So we can clear the error if the name is changed
  submittedUsernameOrEmail: state.provision.usernameOrEmail,
})

const dispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onBack: () => dispatch(ownProps.navigateUp()),
  onSubmit: (usernameOrEmail: string) =>
    dispatch(ProvisionGen.createSubmitUsernameOrEmail({usernameOrEmail})),
})

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    dispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  safeSubmit(['onBack', 'onSubmit'], ['error'])
)(UsernameOrEmail)
