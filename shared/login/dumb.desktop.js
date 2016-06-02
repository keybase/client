// @flow
import LoginError, {Mocks as loginErrorMocks} from './error.render'
import IntroMap from './forms/dumb'

export default {
  'Login: Error': {component: LoginError, mocks: loginErrorMocks},
  ...IntroMap
}
