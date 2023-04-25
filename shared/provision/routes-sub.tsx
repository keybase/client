// this is loaded up by login/routes
import type CodePage from './code-page/container'
import type ErrorView from './error'
import type ForgotUsername from './forgot-username'
import type GpgSign from './gpg-sign/container'
import type Paperkey from './paper-key'
import type Password from './password'
import type SelectOtherDevice from './select-other-device'
import type SetPublicName from './set-public-name'
import type Username from './username-or-email/container'

export const newRoutes = {
  codePage: {
    getOptions: () => require('./code-page/container').options,
    getScreen: (): typeof CodePage => require('./code-page/container').default,
  },
  error: {
    getOptions: () => require('./error').options,
    getScreen: (): typeof ErrorView => require('./error').default,
  },
  forgotUsername: {
    getOptions: () => require('./forgot-username').options,
    getScreen: (): typeof ForgotUsername => require('./forgot-username').default,
  },
  gpgSign: {getScreen: (): typeof GpgSign => require('./gpg-sign/container').default},
  paperkey: {
    getOptions: () => require('./paper-key').options,
    getScreen: (): typeof Paperkey => require('./paper-key').default,
  },
  password: {
    getOptions: () => require('./password').options,
    getScreen: (): typeof Password => require('./password').default,
  },
  selectOtherDevice: {
    getOptions: () => require('./select-other-device').options,
    getScreen: (): typeof SelectOtherDevice => require('./select-other-device').default,
  },
  setPublicName: {
    getOptions: () => require('./set-public-name').options,
    getScreen: (): typeof SetPublicName => require('./set-public-name').default,
  },
  username: {
    getOptions: () => require('./username-or-email/container').options,
    getScreen: (): typeof Username => require('./username-or-email/container').default,
  },
}

// No modal routes while not logged in. More plumbing would be necessary to add them, so there is not
// an empty newModalRoutes here.
