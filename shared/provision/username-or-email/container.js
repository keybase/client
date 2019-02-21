// @flow
import * as ProvisionGen from '../../actions/provision-gen'
import * as SignupGen from '../../actions/signup-gen'
import UsernameOrEmail from '.'
import {compose, connect, safeSubmit, withStateHandlers} from '../../util/container'
import {type RouteProps} from '../../route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  error: state.provision.error.stringValue(),
  inlineError: state.provision.inlineError,
  // So we can clear the error if the name is changed
  submittedUsernameOrEmail: state.provision.usernameOrEmail,
})

const dispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onBack: () => dispatch(ownProps.navigateUp()),
  onGoToSignup: () => dispatch(SignupGen.createRequestAutoInvite()),
  onSubmit: (usernameOrEmail: string) =>
    dispatch(ProvisionGen.createSubmitUsernameOrEmail({usernameOrEmail})),
})

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    dispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  withStateHandlers(
    {usernameOrEmail: ''},
    {
      setUsernameOrEmail: () => usernameOrEmail => ({usernameOrEmail}),
    }
  ),
  safeSubmit(['onBack', 'onSubmit'], ['error', 'inlineError'])
)(UsernameOrEmail)
