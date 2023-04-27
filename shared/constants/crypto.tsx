import * as Platform from '../constants/platform'
import * as RPCTypes from './types/rpc-gen'
import * as TeamBuildingConstants from './team-building'
import HiddenString from '../util/hidden-string'
import type * as Types from './types/crypto'
import type {RPCError} from '../util/errors'

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
export const infoMessage: Map<Types.Operations, string> = new Map([
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
])

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

export const CryptoSubTabs = {
  decrypt: decryptTab,
  encrypt: encryptTab,
  sign: signTab,
  verify: verifyTab,
} as const

export const Operations = {
  Decrypt: 'decrypt',
  Encrypt: 'encrypt',
  Sign: 'sign',
  Verify: 'verify',
} as const

export const saltpackEncryptedExtension = '.encrypted.saltpack'
export const saltpackSignedExtension = '.signed.saltpack'
export const isPathSaltpackEncrypted = (path: string) => path.endsWith(saltpackEncryptedExtension)
export const isPathSaltpackSigned = (path: string) => path.endsWith(saltpackSignedExtension)
export const isPathSaltpack = (path: string) => isPathSaltpackEncrypted(path) || isPathSaltpackSigned(path)

export const getWarningMessageForSBS = (sbsAssertion: string) =>
  `Note: Encrypted for "${sbsAssertion}" who is not yet a Keybase user. One of your devices will need to be online after they join Keybase in order for them to decrypt the message.`

export const getStatusCodeMessage = (
  error: RPCError,
  operation: Types.Operations,
  type: Types.InputTypes
): string => {
  const inputType =
    type === 'text' ? (operation === Operations.Verify ? 'signed message' : 'ciphertext') : 'file'
  const action = type === 'text' ? (operation === Operations.Verify ? 'enter a' : 'enter') : 'drop a'
  const addInput =
    type === 'text' ? (operation === Operations.Verify ? 'signed message' : 'ciphertext') : 'encrypted file'

  const offlineMessage = `You are offline.`
  const genericMessage = `Failed to ${operation} ${type}.`

  let wrongTypeHelpText = ``
  if (operation === Operations.Verify) {
    wrongTypeHelpText = ` Did you mean to decrypt it?` // just a guess. could get specific expected type from Cause with more effort.
  } else if (operation === Operations.Decrypt) {
    wrongTypeHelpText = ` Did you mean to verify it?` // just a guess.
  }

  const causeStatusCode =
    error.fields && error.fields[1].key === 'Code' ? error.fields[1].value : RPCTypes.StatusCode.scgeneric
  const causeStatusCodeToMessage: any = {
    [RPCTypes.StatusCode.scapinetworkerror]: offlineMessage,
    [RPCTypes.StatusCode
      .scdecryptionkeynotfound]: `This message was encrypted for someone else or for a key you don't have.`,
    [RPCTypes.StatusCode
      .scverificationkeynotfound]: `This message couldn't be verified, because the signing key wasn't recognized.`,
    [RPCTypes.StatusCode.scwrongcryptomsgtype]: `This Saltpack format is unexpected.` + wrongTypeHelpText,
  } as const

  const statusCodeToMessage: any = {
    [RPCTypes.StatusCode.scapinetworkerror]: offlineMessage,
    [RPCTypes.StatusCode.scgeneric]: `${
      error.message.includes('API network error') ? offlineMessage : genericMessage
    }`,
    [RPCTypes.StatusCode
      .scstreamunknown]: `This ${inputType} is not in a valid Saltpack format. Please ${action} Saltpack ${addInput}.`,
    [RPCTypes.StatusCode.scsigcannotverify]: causeStatusCodeToMessage[causeStatusCode] || genericMessage,
    [RPCTypes.StatusCode.scdecryptionerror]: causeStatusCodeToMessage[causeStatusCode] || genericMessage,
  } as const

  return statusCodeToMessage[error.code] || genericMessage
}

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
