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

const addTags = component => ({
  component,
  // We don't use the statusbar which removes the padding for iphone X so force that back in
  tags: makeLeafTags({hideStatusBar: true}),
})

const children = {
  codePage: {
    component: CodePage,
    tags: makeLeafTags({hideStatusBar: true, underNotch: true}),
  },
  error: addTags(RegisterError),
  gpgSign: addTags(GPGSign),
  paperkey: addTags(PaperKey),
  passphrase: addTags(Passphrase),
  selectOtherDevice: addTags(SelectOtherDevice),
  setPublicName: addTags(SetPublicName),
  usernameOrEmail: addTags(UsernameOrEmail),
}

export default children

export const newRoutes = {
  codePage: {getScreen: () => CodePage, upgraded: true},
  error: {getScreen: () => RegisterError, upgraded: true},
  gpgSign: {getScreen: () => GPGSign, upgraded: true},
  paperkey: {getScreen: () => PaperKey, upgraded: true},
  passphrase: {getScreen: () => Passphrase, upgraded: true},
  selectOtherDevice: {getScreen: () => SelectOtherDevice, upgraded: true},
  setPublicName: {getScreen: () => SetPublicName, upgraded: true},
  usernameOrEmail: {getScreen: () => UsernameOrEmail, upgraded: true},
}
export const newModalRoutes = {}
