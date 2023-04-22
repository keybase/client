import Error from '.'
import * as Container from '../../../util/container'
import * as SignupGen from '../../../actions/signup-gen'

const ConnectedSignupError = () => {
  const error = Container.useSelector(state => state.signup.signupError)
  const dispatch = Container.useDispatch()
  const onBack = () => dispatch(SignupGen.createGoBackAndClearErrors())
  let header = 'Ah Shoot! Something went wrong, try again?'
  let body = error ? error.desc : ''
  if (!!error && Container.isNetworkErr(error.code)) {
    header = 'Hit an unexpected error; try again?'
    body = 'This might be due to a bad connection.'
  }
  const props = {
    body,
    header,
    onBack,
  }
  return <Error {...props} />
}

ConnectedSignupError.navigationOptions = {
  gesturesEnabled: false,
  headerLeft: null,
}

export default ConnectedSignupError
