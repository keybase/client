// @flow
import codePage from './code-page/index.stories'
import codePage2 from './code-page2/index.stories'
import error from './error/index.stories'
import gpgSign from './gpg-sign/index.stories'
import paperKey from './paper-key/index.stories'
import passphrase from './passphrase/index.stories'
import selectOtherDevice from './select-other-device/index.stories'
import setPublicName from './set-public-name/index.stories'
// import success from './succes/index.stories'
// import usernameOrEmail from './username-or-email/index.stories'

const load = () => {
  ;[
    codePage,
    codePage2,
    error,
    gpgSign,
    paperKey,
    passphrase,
    selectOtherDevice,
    setPublicName,
    // success,
    // usernameOrEmail,
  ].forEach(load => load())
}

export default load
