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
  codePage: {
    // @TODO broken connect
    getScreen: (): typeof CodePage => require('./code-page/container').default,
    upgraded: true as const,
  },
  error: {getScreen: (): typeof ErrorView => require('./error/container').default, upgraded: true as const},
  forgotUsername: {
    getScreen: (): typeof ForgotUsername => require('./forgot-username/container').default,
    upgraded: true as const,
  },
  gpgSign: {
    getScreen: (): typeof GpgSign => require('./gpg-sign/container').default,
    upgraded: true as const,
  },
  paperkey: {
    getScreen: (): typeof Paperkey => require('./paper-key/container').default,
    upgraded: true as const,
  },
  password: {
    getScreen: (): typeof Password => require('./password/container').default,
    upgraded: true as const,
  },
  selectOtherDevice: {
    getScreen: (): typeof SelectOtherDevice => require('./select-other-device/container').default,
    upgraded: true as const,
  },
  setPublicName: {
    getScreen: (): typeof SetPublicName => require('./set-public-name/container').default,
    upgraded: true as const,
  },
  username: {
    getScreen: (): typeof Username => require('./username-or-email/container').default,
    upgraded: true as const,
  },
}
export const newModalRoutes = {}
