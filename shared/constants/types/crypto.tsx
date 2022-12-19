import type * as TeamBuildingTypes from './team-building'
import type HiddenString from '../../util/hidden-string'
import type {IconType} from '../../common-adapters/icon.constants-gen'

export type StringWaitingKey =
  | 'crypto:encrypt:string'
  | 'crypto:decrypt:string'
  | 'crypto:sign:string'
  | 'crypto:verify:string'
export type FileWaitingKey =
  | 'crypto:encrypt:file'
  | 'crypto:decrypt:file'
  | 'crypto:sign:file'
  | 'crypto:verify:file'

type EncryptTab = 'encryptTab'
type DecryptTab = 'decryptTab'
type SignTab = 'signTab'
type VerifyTab = 'verifyTab'

type EncryptOutput = 'encryptOutput'
type DecryptOutput = 'decryptOutput'
type SignOutput = 'signOutput'
type VerifyOutput = 'verifyOutput'

export type TabTitles = 'Encrypt' | 'Decrypt' | 'Sign' | 'Verify'
export type CryptoSubTab = EncryptTab | DecryptTab | SignTab | VerifyTab
// Mobile only
export type CryptoOutputRoute = EncryptOutput | DecryptOutput | SignOutput | VerifyOutput

export type Tab = {
  title: TabTitles
  description: string
  tab: CryptoSubTab
  icon: IconType
  illustration: IconType
}

export type TextType = 'cipher' | 'plain'

export type Operations = 'encrypt' | 'decrypt' | 'sign' | 'verify'
export type InputTypes = 'text' | 'file'
export type OutputType = 'text' | 'file'
export type OutputStatus = 'success' | 'pending' | 'error'

export type CommonState = {
  bytesComplete: number
  bytesTotal: number
  errorMessage: HiddenString
  inProgress: boolean
  input: HiddenString
  inputType: InputTypes
  output: HiddenString
  outputFileDestination: HiddenString
  outputSenderFullname?: HiddenString
  outputSenderUsername?: HiddenString
  outputSigned?: boolean
  outputStatus?: OutputStatus
  outputType?: OutputType
  warningMessage: HiddenString
  // to ensure what the user types matches the input
  outputValid: boolean
}

export type EncryptOptions = {
  includeSelf: boolean
  sign: boolean
}
export type DecryptOptions = {}
export type SignOptions = {}
export type VerifyOptions = {}
export type OperationsOptions = EncryptOptions | DecryptOptions | SignOptions | VerifyOptions

export type EncrypState = CommonState & {
  meta: {
    hasRecipients: boolean
    hasSBS: boolean
    hideIncludeSelf: boolean
  }
  options: EncryptOptions
  recipients: Array<string> // Only for encrypt operation
}

export type DecryptState = CommonState & {}

export type SignState = CommonState & {}

export type VerifyState = CommonState & {}

export type State = {
  readonly decrypt: DecryptState
  readonly encrypt: EncrypState
  readonly sign: SignState
  readonly teamBuilding: TeamBuildingTypes.TeamBuildingSubState
  readonly verify: VerifyState
}
