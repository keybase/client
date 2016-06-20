// @flow
import LoginError, {Mocks as loginErrorMocks} from './error.render'
import IntroMap from './forms/dumb.desktop'
import LoginMap from './login/dumb.desktop'

export default {
  'Login: Error': {component: LoginError, mocks: loginErrorMocks},
  ...IntroMap,
  ...LoginMap,
}
