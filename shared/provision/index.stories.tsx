import codePage from './code-page/index.stories'
import error from './error/index.stories'
import gpgSign from './gpg-sign/index.stories'
import paperKey from './paper-key/index.stories'
import password from './password/index.stories'
import selectOtherDevice from './select-other-device/index.stories'
import setPublicName from './set-public-name/index.stories'
import forgotUsername from './forgot-username/index.stories'
// import success from './succes/index.stories'
// import usernameOrEmail from './username-or-email/index.stories'

const load = () => {
  ;[
    codePage,
    error,
    forgotUsername,
    gpgSign,
    paperKey,
    password,
    selectOtherDevice,
    setPublicName,
    // success,
    // usernameOrEmail,
  ].forEach(load => load())
}

export default load
