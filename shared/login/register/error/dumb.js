// @flow
import ErrorRender from '.'
import {convertToRPCError} from '../../../util/errors'
import {constantsStatusCode} from '../../../constants/types/rpc-gen'

import type {DumbComponentMap} from '../../../constants/types/more'

const baseMock = {}

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
