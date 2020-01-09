import * as TeamBuildingTypes from './team-building'
import {IconType} from '../../common-adapters/icon.constants-gen'

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
  errorMessage: string
  errorType: ErrorTypes
  input: string
  inputType: InputTypes
  output: string
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
