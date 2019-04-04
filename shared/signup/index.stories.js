// @flow
import joinOrLogin from './join-or-login/index.stories'
import username from './username/index.stories'
import devicename from './device-name/index.stories'
import email from './email/index.stories'

const load = () => {
  joinOrLogin()
  username()
  devicename()
  email()
}

export default load
