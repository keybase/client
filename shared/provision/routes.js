// @flow
import {makeLeafTags} from '../route-tree'
import UsernameOrEmail from './username-or-email/container'
import SelectOtherDevice from './select-other-device/container'
import Passphrase from './passphrase/container'
import PaperKey from './paper-key/container'
import CodePage from './code-page/container'
import SetPublicName from './set-public-name/container'
import RegisterError from './error/container'
import GPGSign from './gpg-sign/container'
import {isIPhoneX} from '../constants/platform'

const addTags = component => ({
  component,
  // We don't use the statusbar which removes the padding for iphone X so force that back in
  tags: makeLeafTags({hideStatusBar: true, underStatusBar: !isIPhoneX}),
})

const children = {
  codePage: addTags(CodePage),
  error: addTags(RegisterError),
  gpgSign: addTags(GPGSign),
  paperkey: addTags(PaperKey),
  passphrase: addTags(Passphrase),
  selectOtherDevice: addTags(SelectOtherDevice),
  setPublicName: addTags(SetPublicName),
  usernameOrEmail: addTags(UsernameOrEmail),
}

export default children
