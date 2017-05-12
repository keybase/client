// @flow
import Render from './index.render'
import type {DumbComponentMap} from '../../../constants/types/more'
import {convertToRPCError} from '../../../util/errors'
import {ConstantsStatusCode} from '../../../constants/types/flow-types'

const baseMock = {
  onBack: () => console.log('onBack'),
  error: convertToRPCError({
    code: 901,
    desc: "You don't have a public key; try `keybase pgp select` or `keybase pgp import` if you have a key; or `keybase pgp gen` if you don't",
  }),
}

const dumbComponentMap: DumbComponentMap<Render> = {
  component: Render,
  mocks: {
    Normal: baseMock,
    DeviceNoProvision: {
      ...baseMock,
      error: convertToRPCError({
        code: ConstantsStatusCode.scdevicenoprovision,
        desc: '',
      }),
    },
    KeyNoMatchingGPG: {
      ...baseMock,
      error: convertToRPCError({
        code: ConstantsStatusCode.sckeynomatchinggpg,
        desc: '',
      }),
    },
    KeyNotFound: {
      ...baseMock,
      error: convertToRPCError({
        code: ConstantsStatusCode.sckeynotfound,
        desc: '',
      }),
    },
    UserNotFound: {
      ...baseMock,
      error: convertToRPCError({
        code: ConstantsStatusCode.scnotfound,
        desc: '',
      }),
    },
    BadLoginPassword: {
      ...baseMock,
      error: convertToRPCError({
        code: ConstantsStatusCode.scbadloginpassword,
        desc: '',
      }),
    },
    KeyNoSecret: {
      ...baseMock,
      error: convertToRPCError({
        code: ConstantsStatusCode.sckeynosecret,
        desc: '',
      }),
    },
  },
}

export default dumbComponentMap
