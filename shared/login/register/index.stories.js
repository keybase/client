// @flow
import codePage from './code-page/index.stories.js'
import codePage2 from './code-page2/index.stories.js'
import error from './error/index.stories.js'
import gpgSign from './gpg-sign/index.stories.js'
import paperKey from './paper-key/index.stories.js'
import passphrase from './passphrase/index.stories.js'
import selectOtherDevice from './select-other-device/index.stories.js'
import setPublicName from './set-public-name/index.stories.js'
// import success from './succes/index.stories.js'
// import usernameOrEmail from './username-or-email/index.stories.js'

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
