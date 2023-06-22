import type HiddenString from '../../util/hidden-string'

// Mobile only
export type TextType = 'cipher' | 'plain'
export type Operations = 'encrypt' | 'decrypt' | 'sign' | 'verify'

export type InputTypes = 'text' | 'file'
export type OutputType = 'text' | 'file'

export type CommonState = {
  bytesComplete: number
  bytesTotal: number
  errorMessage: HiddenString
  inProgress: boolean
  input: HiddenString
  inputType: 'text' | 'file'
  output: HiddenString
  outputFileDestination: HiddenString
  outputSenderFullname?: HiddenString
  outputSenderUsername?: HiddenString
  outputSigned?: boolean
  outputStatus?: 'success' | 'pending' | 'error'
  outputType?: 'text' | 'file'
  warningMessage: HiddenString
  // to ensure what the user types matches the input
  outputValid: boolean
}

export type EncryptOptions = {
  includeSelf: boolean
  sign: boolean
}

export type State = {
  decrypt: CommonState
  encrypt: CommonState & {
    meta: {
      hasRecipients: boolean
      hasSBS: boolean
      hideIncludeSelf: boolean
    }
    options: EncryptOptions
    recipients: Array<string> // Only for encrypt operation
  }
  sign: CommonState
  verify: CommonState
}
