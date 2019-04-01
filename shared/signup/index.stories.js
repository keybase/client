// @flow
import joinOrLogin from './join-or-login/index.stories'
import username from './username/index.stories'
import devicename from './device-name/index.stories'

const load = () => {
  joinOrLogin()
  username()
  devicename()
}

export default load
