// @flow
import forms from './forms/index.stories'
import login from './login/index.stories'
import provision from './provision/index.stories'

const load = () => {
  forms()
  login()
  provision()
}

export default load
