import * as C from '@/constants'
import * as RPCGen from '@/constants/rpc/rpc-gen'
import * as React from 'react'
import type * as T from '@/constants/types'
import type {RPCError} from '@/util/errors'

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

export type CryptoInputRouteParams = {
  entryNonce?: string
  seedInputPath?: string
  seedInputType?: 'text' | 'file'
}

export type CommonOutputRouteParams = CommonState

type CryptoKind = 'decrypt' | 'encrypt' | 'sign' | 'verify'

export const getStatusCodeMessage = (
  error: RPCError,
  kind: CryptoKind,
  type: T.Crypto.InputTypes
): string => {
  const inputType = type === 'text' ? (kind === 'verify' ? 'signed message' : 'ciphertext') : 'file'
  const action = type === 'text' ? (kind === 'verify' ? 'enter a' : 'enter') : 'drop a'
  const addInput = type === 'text' ? (kind === 'verify' ? 'signed message' : 'ciphertext') : 'encrypted file'

  const offlineMessage = 'You are offline.'
  const genericMessage = `Failed to ${kind} ${type}.`

  let wrongTypeHelpText = ''
  if (kind === 'verify') {
    wrongTypeHelpText = ' Did you mean to decrypt it?'
  } else if (kind === 'decrypt') {
    wrongTypeHelpText = ' Did you mean to verify it?'
  }

  const fields = error.fields as Array<{key: string; value: RPCGen.StatusCode}> | undefined
  const field = fields?.[1]
  const causeStatusCode = field?.key === 'Code' ? field.value : RPCGen.StatusCode.scgeneric
  const causeStatusCodeToMessage = new Map([
    [RPCGen.StatusCode.scapinetworkerror, offlineMessage],
    [
      RPCGen.StatusCode.scdecryptionkeynotfound,
      "This message was encrypted for someone else or for a key you don't have.",
    ],
    [
      RPCGen.StatusCode.scverificationkeynotfound,
      "This message couldn't be verified, because the signing key wasn't recognized.",
    ],
    [RPCGen.StatusCode.scwrongcryptomsgtype, `This Saltpack format is unexpected.${wrongTypeHelpText}`],
  ])

  const statusCodeToMessage = new Map([
    [RPCGen.StatusCode.scapinetworkerror, offlineMessage],
    [
      RPCGen.StatusCode.scgeneric,
      error.message.includes('API network error') ? offlineMessage : genericMessage,
    ],
    [RPCGen.StatusCode.scwrongcryptomsgtype, causeStatusCodeToMessage.get(error.code) || genericMessage],
    [
      RPCGen.StatusCode.scstreamunknown,
      `This ${inputType} is not in a valid Saltpack format. Please ${action} Saltpack ${addInput}.`,
    ],
    [RPCGen.StatusCode.scsigcannotverify, causeStatusCodeToMessage.get(causeStatusCode) || genericMessage],
    [RPCGen.StatusCode.scdecryptionerror, causeStatusCodeToMessage.get(causeStatusCode) || genericMessage],
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

export function resetWarnings<State extends CommonState>(state: State): State {
  return {
    ...state,
    errorMessage: '',
    warningMessage: '',
  } as State
}

export function resetOutput<State extends CommonState>(state: State): State {
  return {
    ...resetWarnings(state),
    bytesComplete: 0,
    bytesTotal: 0,
    output: '',
    outputSenderFullname: undefined,
    outputSenderUsername: undefined,
    outputSigned: false,
    outputStatus: undefined,
    outputType: undefined,
    outputValid: false,
  } as State
}

export function beginRun<State extends CommonState>(state: State): State {
  return {
    ...resetWarnings(state),
    bytesComplete: 0,
    bytesTotal: 0,
    inProgress: true,
    outputStatus: 'pending',
    outputValid: false,
  } as State
}

export function clearInputState<State extends CommonState>(state: State): State {
  return {
    ...resetOutput(state),
    input: '',
    inputType: 'text',
    outputValid: true,
  } as State
}

export function nextInputState<State extends CommonState>(
  state: State,
  type: T.Crypto.InputTypes,
  value: string
): State {
  const next = {
    ...resetWarnings(state),
    input: value,
    inputType: type,
    outputValid: state.input === value,
  }
  return (type === 'file' ? resetOutput(next) : next) as State
}

export function nextOpenedFileState<State extends CommonState>(state: State, path: string): State {
  return {
    ...resetOutput(state),
    input: path,
    inputType: 'file',
  } as State
}

export function useCommittedState<State>(createInitialState: () => State) {
  const [state, setState] = React.useState(createInitialState)
  const stateRef = React.useRef(state)

  const commitState = React.useCallback((next: State) => {
    stateRef.current = next
    setState(next)
    return next
  }, [])

  return {commitState, state, stateRef}
}

export function maybeAutoRunTextOperation<State extends CommonState>(
  snapshot: State,
  run: (destinationDir?: string, snapshot?: State) => Promise<unknown>
) {
  if (snapshot.inputType !== 'text' || C.isMobile) return
  const f = async () => {
    await run('', snapshot)
  }
  C.ignorePromise(f())
}

export const useSeededCryptoInput = (
  params: CryptoInputRouteParams | undefined,
  openFile: (path: string) => void,
  setInput: (type: T.Crypto.InputTypes, value: string) => void
) => {
  React.useEffect(() => {
    if (!params?.seedInputPath) return
    if ((params.seedInputType ?? 'file') === 'file') {
      openFile(params.seedInputPath)
    } else {
      setInput('text', params.seedInputPath)
    }
  }, [openFile, params?.entryNonce, params?.seedInputPath, params?.seedInputType, setInput])
}
