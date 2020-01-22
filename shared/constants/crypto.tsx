import * as TeamBuildingConstants from './team-building'
import * as Types from './types/crypto'
import HiddenString from '../util/hidden-string'
import {IconType} from '../common-adapters/icon.constants-gen'

export const saltpackDocumentation = 'https://saltpack.org'

// String waiting keys
export const encryptStringWaitingKey = 'crypto:encrypt:string' as Types.StringWaitingKey
export const decryptStringWaitingKey = 'crypto:decrypt:string' as Types.StringWaitingKey
export const signStringWaitingKey = 'crypto:sign:string' as Types.StringWaitingKey
export const verifyStringWaitingKey = 'crypto:verify:string' as Types.StringWaitingKey
export const allStringWaitingKeys = [
  encryptStringWaitingKey,
  decryptStringWaitingKey,
  signStringWaitingKey,
  verifyStringWaitingKey,
]

// File waiting keys
export const encryptFileWaitingKey = 'crypto:encrypt:file' as Types.FileWaitingKey
export const decryptFileWaitingKey = 'crypto:decrypt:file' as Types.FileWaitingKey
export const signFileWaitingKey = 'crypto:sign:file' as Types.FileWaitingKey
export const verifyFileWaitingKey = 'crypto:verify:file' as Types.FileWaitingKey
export const allFileWaitingKeys = [
  encryptFileWaitingKey,
  decryptFileWaitingKey,
  signFileWaitingKey,
  verifyFileWaitingKey,
]

// Tab keys
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

const operationToInputFileIcon: {[k in Types.Operations]: IconType} = {
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

const operationToStringWaitingKey: {[k in Types.Operations]: Types.StringWaitingKey} = {
  decrypt: decryptStringWaitingKey,
  encrypt: encryptStringWaitingKey,
  sign: signStringWaitingKey,
  verify: verifyStringWaitingKey,
} as const

const operationToFileWaitingKey: {[k in Types.Operations]: Types.FileWaitingKey} = {
  decrypt: decryptFileWaitingKey,
  encrypt: encryptFileWaitingKey,
  sign: signFileWaitingKey,
  verify: verifyFileWaitingKey,
} as const

export const getInputFileIcon = (operation: Types.Operations) => operationToInputFileIcon[operation]
export const getOutputFileIcon = (operation: Types.Operations) => operationToOutputFileIcon[operation]
export const getStringWaitingKey = (operation: Types.Operations) => operationToStringWaitingKey[operation]
export const getFileWaitingKey = (operation: Types.Operations) => operationToFileWaitingKey[operation]

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
      hasSBS: false,
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
