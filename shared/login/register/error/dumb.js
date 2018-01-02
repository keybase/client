// @flow
import ErrorRender from '.'
import {convertToRPCError} from '../../../util/errors'
import {constantsStatusCode} from '../../../constants/types/rpc-gen'

import type {DumbComponentMap} from '../../../constants/types/more'

const baseMock = {
  onBack: () => console.log('onBack'),
  error: convertToRPCError({
    code: 901,
    desc:
      "You don't have a public key; try `keybase pgp select` or `keybase pgp import` if you have a key; or `keybase pgp gen` if you don't",
  }),
}

const dumbComponentMap: DumbComponentMap<ErrorRender> = {
  component: ErrorRender,
  mocks: {
    Normal: baseMock,
    DeviceNoProvision: {
      ...baseMock,
      error: convertToRPCError({code: constantsStatusCode.scdevicenoprovision, desc: ''}),
    },
    KeyNoMatchingGPG: {
      ...baseMock,
      error: convertToRPCError({code: constantsStatusCode.sckeynomatchinggpg, desc: ''}),
    },
    KeyNotFound: {...baseMock, error: convertToRPCError({code: constantsStatusCode.sckeynotfound, desc: ''})},
    UserNotFound: {...baseMock, error: convertToRPCError({code: constantsStatusCode.scnotfound, desc: ''})},
    BadLoginPassword: {
      ...baseMock,
      error: convertToRPCError({code: constantsStatusCode.scbadloginpassword, desc: ''}),
    },
    KeyNoSecret: {...baseMock, error: convertToRPCError({code: constantsStatusCode.sckeynosecret, desc: ''})},
  },
}

export default dumbComponentMap
