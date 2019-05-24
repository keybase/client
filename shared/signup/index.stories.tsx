import joinOrLogin from './join-or-login/index.stories'
import username from './username/index.stories'
import devicename from './device-name/index.stories'
import email from './email/index.stories'
import phoneNumber from './phone-number/index.stories'

const load = () => {
  joinOrLogin()
  username()
  devicename()
  phoneNumber()
  email()
}

export default load
