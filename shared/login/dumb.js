// @flow
import IntroMap from './forms/dumb'
import LoginMap from './login/dumb'
import LoginError from './error.render'
import {Map} from 'immutable'

const loginErrorMocks = {
  Error: {currentPath: Map({a: 1, b: 2, c: 3})},
  Error2: {currentPath: Map({a: 3, b: 2, c: 1})},
}

export default {
  ...IntroMap,
  ...LoginMap,
  'Login: Generic Error': {component: LoginError, mocks: loginErrorMocks},
}
