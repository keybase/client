// this is loaded up by login/routes and device/routes
import codePage from './code-page/page'
import error from './error.page'
import forgotUsername from './forgot-username.page'
// import gpgSign from './gpg-sign/page'
import paperkey from './paper-key.page'
import password from './password.page'
import selectOtherDevice from './select-other-device.page'
import setPublicName from './set-public-name.page'
import username from './username-or-email/page'

export const newRoutes = {
  codePage,
  error,
  forgotUsername,
  // gpgSign,
  paperkey,
  password,
  selectOtherDevice,
  setPublicName,
  username,
}

// No modal routes while not logged in. More plumbing would be necessary to add them, so there is not
// an empty newModalRoutes here.
