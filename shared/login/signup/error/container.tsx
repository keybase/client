import Error from '.'
import * as Container from '../../../util/container'
import * as SignupGen from '../../../actions/signup-gen'

type OwnProps = {}

const ConnectedSignupError = Container.connect(
  state => ({
    error: state.signup.signupError,
  }),
  dispatch => ({
    onBack: () => dispatch(SignupGen.createGoBackAndClearErrors()),
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    let header = 'Ah Shoot! Something went wrong, try again?'
    let body = stateProps.error ? stateProps.error.desc : ''
    if (!!stateProps.error && Container.isNetworkErr(stateProps.error.code)) {
      header = 'Hit an unexpected error; try again?'
      body = 'This might be due to a bad connection.'
    }
    return {
      body,
      header,
      onBack: dispatchProps.onBack,
    }
  }
)(Error)

// @ts-ignore
ConnectedSignupError.navigationOptions = {
  gesturesEnabled: false,
  headerLeft: null,
}

export default ConnectedSignupError
