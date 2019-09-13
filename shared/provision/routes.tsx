import CodePage from './code-page/container'
import ErrorView from './error/container'
import ForgotUsername from './forgot-username/container'
import GpgSign from './gpg-sign/container'
import Paperkey from './paper-key/container'
import Password from './password/container'
import SelectOtherDevice from './select-other-device/container'
import SetPublicName from './set-public-name/container'
import Username from './username-or-email/container'

export const newRoutes = {
  // TODO broken connect
  codePage: {getScreen: (): typeof CodePage => require('./code-page/container').default},
  error: {getScreen: (): typeof ErrorView => require('./error/container').default},
  forgotUsername: {getScreen: (): typeof ForgotUsername => require('./forgot-username/container').default},
  gpgSign: {getScreen: (): typeof GpgSign => require('./gpg-sign/container').default},
  paperkey: {getScreen: (): typeof Paperkey => require('./paper-key/container').default},
  password: {getScreen: (): typeof Password => require('./password/container').default},
  selectOtherDevice: {
    getScreen: (): typeof SelectOtherDevice => require('./select-other-device/container').default,
  },
  setPublicName: {getScreen: (): typeof SetPublicName => require('./set-public-name/container').default},
  username: {getScreen: (): typeof Username => require('./username-or-email/container').default},
}
export const newModalRoutes = {}
