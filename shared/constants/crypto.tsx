import * as TeamBuildingConstants from './team-building'
import * as Types from './types/crypto'
import HiddenString from '../util/hidden-string'
import {IconType} from '../common-adapters/icon.constants-gen'

export const encryptTab = 'encryptTab'
export const decryptTab = 'decryptTab'
export const signTab = 'signTab'
export const verifyTab = 'verifyTab'

export const TabTitles: {[k in Types.CryptoSubTab]: Types.TabTitles} = {
  decryptTab: 'Decrypt',
  encryptTab: 'Encrypt',
  signTab: 'Sign',
  verifyTab: 'Verify',
}

export const Tabs: Array<Types.Tab> = [
  {
    icon: 'iconfont-lock',
    tab: encryptTab,
    title: TabTitles[encryptTab],
  },
  {
    icon: 'iconfont-unlock',
    tab: decryptTab,
    title: TabTitles[decryptTab],
  },
  {
    icon: 'iconfont-check',
    tab: signTab,
    title: TabTitles[signTab],
  },
  {
    icon: 'iconfont-verify',
    tab: verifyTab,
    title: TabTitles[verifyTab],
  },
]

export const Operations: {[key: string]: Types.Operations} = {
  Decrypt: 'decrypt',
  Encrypt: 'encrypt',
  Sign: 'sign',
  Verify: 'verify',
}

const operationToInputFileIcon: {[K in Types.Operations]: IconType} = {
  decrypt: 'icon-file-saltpack-encrypted-64',
  encrypt: 'icon-file-64',
  sign: 'icon-file-64',
  verify: 'icon-file-saltpack-signed-64',
} as const

const operationToOutputFileIcon: {[k in Types.Operations]: IconType} = {
  decrypt: 'icon-file-64',
  encrypt: 'icon-file-saltpack-encrypted-64',
  sign: 'icon-file-saltpack-signed-64',
  verify: 'icon-file-64',
} as const

export const getInputFileIcon = (operation: Types.Operations) => operationToInputFileIcon[operation]
export const getOutputFileIcon = (operation: Types.Operations) => operationToOutputFileIcon[operation]

const defaultCommonState = {
  bytesComplete: 0,
  bytesTotal: 0,
  errorMessage: new HiddenString(''),
  errorType: '' as Types.ErrorTypes,
  input: new HiddenString(''),
  inputType: 'text' as Types.InputTypes,
  output: new HiddenString(''),
  outputSender: undefined,
  outputSigned: false,
  outputStatus: undefined,
  outputType: undefined,
}

export const makeState = (): Types.State => ({
  decrypt: {
    ...defaultCommonState,
  },
  encrypt: {
    ...defaultCommonState,
    meta: {
      hasRecipients: false,
      noIncludeSelf: false,
    },
    options: {
      includeSelf: true,
      sign: true,
    },
    recipients: [],
  },
  sign: {
    ...defaultCommonState,
  },
  teamBuilding: TeamBuildingConstants.makeSubState(),
  verify: {
    ...defaultCommonState,
  },
})
