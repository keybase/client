import * as T from '@/constants/types'
import {RPCError} from '@/util/errors'

export type OutputStatus = 'success' | 'pending'

export type CommonState = {
  bytesComplete: number
  bytesTotal: number
  errorMessage: string
  inProgress: boolean
  input: string
  inputType: 'text' | 'file'
  output: string
  outputSenderFullname?: string
  outputSenderUsername?: string
  outputSigned: boolean
  outputStatus?: OutputStatus
  outputType?: 'text' | 'file'
  outputValid: boolean
  warningMessage: string
}

export type EncryptOptions = {
  includeSelf: boolean
  sign: boolean
}

export type EncryptMeta = {
  hasRecipients: boolean
  hasSBS: boolean
  hideIncludeSelf: boolean
}

export type EncryptState = CommonState & {
  meta: EncryptMeta
  options: EncryptOptions
  recipients: Array<string>
}

export type CryptoInputRouteParams = {
  entryNonce?: string
  seedInputPath?: string
  seedInputType?: 'text' | 'file'
}

export type CryptoTeamBuilderResult = Array<{
  serviceId: T.TB.ServiceIdWithContact
  username: string
}>

export type EncryptRouteParams = CryptoInputRouteParams & {
  teamBuilderNonce?: string
  teamBuilderUsers?: CryptoTeamBuilderResult
}

export type CommonOutputRouteParams = CommonState

export type EncryptOutputRouteParams = CommonOutputRouteParams & {
  hasRecipients: boolean
  includeSelf: boolean
  recipients: Array<string>
}

type CryptoKind = 'decrypt' | 'encrypt' | 'sign' | 'verify'

export const getStatusCodeMessage = (
  error: RPCError,
  kind: CryptoKind,
  type: T.Crypto.InputTypes
): string => {
  const inputType =
    type === 'text' ? (kind === 'verify' ? 'signed message' : 'ciphertext') : 'file'
  const action = type === 'text' ? (kind === 'verify' ? 'enter a' : 'enter') : 'drop a'
  const addInput =
    type === 'text' ? (kind === 'verify' ? 'signed message' : 'ciphertext') : 'encrypted file'

  const offlineMessage = 'You are offline.'
  const genericMessage = `Failed to ${kind} ${type}.`

  let wrongTypeHelpText = ''
  if (kind === 'verify') {
    wrongTypeHelpText = ' Did you mean to decrypt it?'
  } else if (kind === 'decrypt') {
    wrongTypeHelpText = ' Did you mean to verify it?'
  }

  const fields = error.fields as Array<{key: string; value: T.RPCGen.StatusCode}> | undefined
  const field = fields?.[1]
  const causeStatusCode = field?.key === 'Code' ? field.value : T.RPCGen.StatusCode.scgeneric
  const causeStatusCodeToMessage = new Map([
    [T.RPCGen.StatusCode.scapinetworkerror, offlineMessage],
    [
      T.RPCGen.StatusCode.scdecryptionkeynotfound,
      "This message was encrypted for someone else or for a key you don't have.",
    ],
    [
      T.RPCGen.StatusCode.scverificationkeynotfound,
      "This message couldn't be verified, because the signing key wasn't recognized.",
    ],
    [T.RPCGen.StatusCode.scwrongcryptomsgtype, `This Saltpack format is unexpected.${wrongTypeHelpText}`],
  ])

  const statusCodeToMessage = new Map([
    [T.RPCGen.StatusCode.scapinetworkerror, offlineMessage],
    [
      T.RPCGen.StatusCode.scgeneric,
      error.message.includes('API network error') ? offlineMessage : genericMessage,
    ],
    [
      T.RPCGen.StatusCode.scstreamunknown,
      `This ${inputType} is not in a valid Saltpack format. Please ${action} Saltpack ${addInput}.`,
    ],
    [T.RPCGen.StatusCode.scsigcannotverify, causeStatusCodeToMessage.get(causeStatusCode) || genericMessage],
    [T.RPCGen.StatusCode.scdecryptionerror, causeStatusCodeToMessage.get(causeStatusCode) || genericMessage],
  ])

  return statusCodeToMessage.get(error.code) ?? genericMessage
}

export const createCommonState = (params?: CryptoInputRouteParams): CommonState => ({
  bytesComplete: 0,
  bytesTotal: 0,
  errorMessage: '',
  inProgress: false,
  input: params?.seedInputPath ?? '',
  inputType: params?.seedInputType ?? 'text',
  output: '',
  outputSenderFullname: undefined,
  outputSenderUsername: undefined,
  outputSigned: false,
  outputStatus: undefined,
  outputType: undefined,
  outputValid: false,
  warningMessage: '',
})

export const createEncryptState = (params?: EncryptRouteParams): EncryptState => ({
  ...createCommonState(params),
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
})

export const encryptToOutputParams = (state: EncryptState): EncryptOutputRouteParams => ({
  ...state,
  hasRecipients: state.meta.hasRecipients,
  includeSelf: state.options.includeSelf,
  recipients: state.recipients,
})

export const outputParamsToCommonState = (params: CommonOutputRouteParams): CommonState => ({...params})

export const teamBuilderResultToRecipients = (
  users: ReadonlyArray<{serviceId: T.TB.ServiceIdWithContact; username: string}>
) => {
  let hasSBS = false
  const recipients = users.map(user => {
    if (user.serviceId === 'email') {
      hasSBS = true
      return `[${user.username}]@email`
    }
    if (user.serviceId !== 'keybase') {
      hasSBS = true
      return `${user.username}@${user.serviceId}`
    }
    return user.username
  })
  return {hasSBS, recipients}
}
