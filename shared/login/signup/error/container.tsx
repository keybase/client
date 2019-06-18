import Error from '.'
import {connect, networkErrorCodes} from '../../../util/container'

import * as SignupGen from '../../../actions/signup-gen'

type OwnProps = {}

const mapStateToProps = state => ({
  error: state.signup.signupError,
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(SignupGen.createGoBackAndClearErrors()),
})

const mergeProps = (stateProps, dispatchProps) => {
  let header = 'Ah Shoot! Something went wrong, try again?'
  let body = stateProps.error ? stateProps.error.desc : ''
  if (!!stateProps.error && networkErrorCodes.includes(stateProps.error.code)) {
    header = 'Hit an unexpected error; try again?'
    body = 'This might be due to a bad connection.'
  }
  return {
    body,
    header,
    onBack: dispatchProps.onBack,
  }
}

const ConnectedSignupError = connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Error)

// @ts-ignore
ConnectedSignupError.navigationOptions = {
  gesturesEnabled: false,
  headerLeft: null,
}

export default ConnectedSignupError
