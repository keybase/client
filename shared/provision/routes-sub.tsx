// this is loaded up by login/routes
import type CodePage from './code-page/container'
import type ErrorView from './error/container'
import type ForgotUsername from './forgot-username'
import type GpgSign from './gpg-sign/container'
import type Paperkey from './paper-key/container'
import type Password from './password/container'
import type SelectOtherDevice from './select-other-device/container'
import type SetPublicName from './set-public-name/container'
import type Username from './username-or-email/container'

export const newRoutes = {
  codePage: {getScreen: (): typeof CodePage => require('./code-page/container').default},
  error: {getScreen: (): typeof ErrorView => require('./error/container').default},
  forgotUsername: {getScreen: (): typeof ForgotUsername => require('./forgot-username').default},
  gpgSign: {getScreen: (): typeof GpgSign => require('./gpg-sign/container').default},
  paperkey: {getScreen: (): typeof Paperkey => require('./paper-key/container').default},
  password: {getScreen: (): typeof Password => require('./password/container').default},
  selectOtherDevice: {
    getScreen: (): typeof SelectOtherDevice => require('./select-other-device/container').default,
  },
  setPublicName: {getScreen: (): typeof SetPublicName => require('./set-public-name/container').default},
  username: {getScreen: (): typeof Username => require('./username-or-email/container').default},
}

// No modal routes while not logged in. More plumbing would be necessary to add them, so there is not
// an empty newModalRoutes here.
