// @flow
import joinOrLogin from './join-or-login/index.stories'
import username from './username/index.stories'

const load = () => {
  joinOrLogin()
  username()
}

export default load
