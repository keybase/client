import * as Platform from '../constants/platform'
import * as TeamBuildingConstants from './team-building'
import HiddenString from '../util/hidden-string'
import type * as Types from './types/crypto'

export const saltpackDocumentation = 'https://saltpack.org'

export const inputDesktopMaxHeight = {maxHeight: '30%'}
export const outputDesktopMaxHeight = {maxHeight: '70%'}

export const waitingKey = 'cryptoWaiting'

// Tab keys
export const encryptTab = 'encryptTab'
export const decryptTab = 'decryptTab'
export const signTab = 'signTab'
export const verifyTab = 'verifyTab'

// Output route keys - Mobile only
export const encryptOutput = 'encryptOutput'
export const decryptOutput = 'decryptOutput'
export const signOutput = 'signOutput'
export const verifyOutput = 'verifyOutput'

// Update me once Saltpack works with files on mobile.
export const infoMessage = new Map([
  [
    'decrypt',
    Platform.isMobile
      ? 'Decrypt messages encrypted with Saltpack.'
      : 'Decrypt any ciphertext or .encrypted.saltpack file.',
  ],
  ['encrypt', "Encrypt to anyone, even if they're not on Keybase yet."],
  ['sign', 'Add your cryptographic signature to a message or file.'],
  [
    'verify',
    Platform.isMobile ? 'Verify a signed message.' : 'Verify any signed text or .signed.saltpack file.',
  ],
] as const)

export const Tabs = [
  {
    description: infoMessage.get('encrypt') || '',
    icon: 'iconfont-lock',
    illustration: 'icon-encrypt-64',
    tab: encryptTab,
    title: 'Encrypt',
  },
  {
    description: infoMessage.get('decrypt') || '',
    icon: 'iconfont-unlock',
    illustration: 'icon-decrypt-64',
    tab: decryptTab,
    title: 'Decrypt',
  },
  {
    description: infoMessage.get('sign') || '',
    icon: 'iconfont-check',
    illustration: 'icon-sign-64',
    tab: signTab,
    title: 'Sign',
  },
  {
    description: infoMessage.get('verify') || '',
    icon: 'iconfont-verify',
    illustration: 'icon-verify-64',
    tab: verifyTab,
    title: 'Verify',
  },
] as const

export const Operations = {
  Decrypt: 'decrypt',
  Encrypt: 'encrypt',
  Sign: 'sign',
  Verify: 'verify',
} as const

export const isPathSaltpackEncrypted = (path: string) => path.endsWith('.encrypted.saltpack')
export const isPathSaltpackSigned = (path: string) => path.endsWith('.signed.saltpack')
export const isPathSaltpack = (path: string) => isPathSaltpackEncrypted(path) || isPathSaltpackSigned(path)

// State
const defaultCommonState = {
  bytesComplete: 0,
  bytesTotal: 0,
  errorMessage: new HiddenString(''),
  inProgress: false,
  input: new HiddenString(''),
  inputType: 'text' as Types.InputTypes,
  output: new HiddenString(''),
  outputFileDestination: new HiddenString(''),
  outputSenderFullname: undefined,
  outputSenderUsername: undefined,
  outputSigned: false,
  outputStatus: undefined,
  outputType: undefined,
  outputValid: false,
  warningMessage: new HiddenString(''),
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
      hideIncludeSelf: false,
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
