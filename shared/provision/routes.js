// @flow
import * as React from 'react'
import {makeLeafTags} from '../route-tree'
import UsernameOrEmail from './username-or-email/container'
import SelectOtherDevice from './select-other-device/container'
import Passphrase from './passphrase/container'
import PaperKey from './paper-key/container'
import CodePage from './code-page/container'
import SetPublicName from './set-public-name/container'
import RegisterError from './error/container'
import GPGSign from './gpg-sign/container'
import CancelProvisioningHelperHoc from './cancel-provisioning-helper'

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
  codePage: {
    getScreen: () => {
      const C = require('./code-page/container').default
      return CancelProvisioningHelperHoc<React.ElementConfig<typeof C>>(C)
    },
    upgraded: true,
  },
  error: {
    getScreen: () => {
      const C = require('./error/container').default
      return CancelProvisioningHelperHoc<React.ElementConfig<typeof C>>(C)
    },
    upgraded: true,
  },
  gpgSign: {
    getScreen: () => {
      const C = require('./gpg-sign/container').default
      return CancelProvisioningHelperHoc<React.ElementConfig<typeof C>>(C)
    },
    upgraded: true,
  },
  paperkey: {
    getScreen: () => {
      const C = require('./paper-key/container').default
      return CancelProvisioningHelperHoc<React.ElementConfig<typeof C>>(C)
    },
    upgraded: true,
  },
  passphrase: {
    getScreen: () => {
      const C = require('./passphrase/container').default
      return CancelProvisioningHelperHoc<React.ElementConfig<typeof C>>(C)
    },
    upgraded: true,
  },
  selectOtherDevice: {
    getScreen: () => {
      const C = require('./select-other-device/container').default
      return CancelProvisioningHelperHoc<React.ElementConfig<typeof C>>(C)
    },
    upgraded: true,
  },
  setPublicName: {
    getScreen: () => {
      const C = require('./set-public-name/container').default
      return CancelProvisioningHelperHoc<React.ElementConfig<typeof C>>(C)
    },
    upgraded: true,
  },
  usernameOrEmail: {
    getScreen: () => {
      const C = require('./username-or-email/container').default
      return CancelProvisioningHelperHoc<React.ElementConfig<typeof C>>(C)
    },
    upgraded: true,
  },
}
export const newModalRoutes = {}
