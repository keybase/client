// @flow
import forms from './forms/index.stories'
import login from './login/index.stories'
import register from './register/index.stories'

const load = () => {
  forms()
  login()
  register()
}

export default load
