import * as TeamBuildingTypes from './team-building'
import HiddenString from '../../util/hidden-string'
import {IconType} from '../../common-adapters/icon.constants-gen'

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

export type TabTitles = 'Encrypt' | 'Decrypt' | 'Sign' | 'Verify'
export type CryptoSubTab = EncryptTab | DecryptTab | SignTab | VerifyTab

export type Tab = {
  title: TabTitles
  tab: CryptoSubTab
  icon: IconType
}

export type TextType = 'cipher' | 'plain'

export type Operations = 'encrypt' | 'decrypt' | 'sign' | 'verify'
export type InputTypes = 'text' | 'file'
export type OutputType = 'text' | 'file'
export type ErrorTypes = ''
export type OutputStatus = 'success' | 'error'

export type CommonState = {
  bytesComplete: number
  bytesTotal: number
  errorMessage: HiddenString
  errorType: ErrorTypes
  input: HiddenString
  inputType: InputTypes
  output: HiddenString
  outputSender?: HiddenString
  outputSigned?: boolean
  outputStatus?: OutputStatus
  outputType?: OutputType
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
    noIncludeSelf: boolean
  }
  options: EncryptOptions
  recipients: Array<string> // Only for encrypt operation
}

export type DecryptState = CommonState & {}

export type SignState = CommonState & {}

export type VerifyState = CommonState & {}

export type State = Readonly<{
  decrypt: DecryptState
  encrypt: EncrypState
  sign: SignState
  teamBuilding: TeamBuildingTypes.TeamBuildingSubState
  verify: VerifyState
}>
