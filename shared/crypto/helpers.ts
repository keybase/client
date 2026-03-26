import * as C from '@/constants'
import * as React from 'react'
import type * as T from '@/constants/types'
import type {CommonState, CryptoInputRouteParams} from './state'

export const resetWarnings = <State extends CommonState>(state: State): State =>
  ({
    ...state,
    errorMessage: '',
    warningMessage: '',
  }) as State

export const resetOutput = <State extends CommonState>(state: State): State =>
  ({
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
  }) as State

export const beginRun = <State extends CommonState>(state: State): State =>
  ({
    ...resetWarnings(state),
    bytesComplete: 0,
    bytesTotal: 0,
    inProgress: true,
    outputStatus: 'pending',
    outputValid: false,
  }) as State

export const clearInputState = <State extends CommonState>(state: State): State =>
  ({
    ...resetOutput(state),
    input: '',
    inputType: 'text',
    outputValid: true,
  }) as State

export const nextInputState = <State extends CommonState>(
  state: State,
  type: T.Crypto.InputTypes,
  value: string
): State => {
  const next = {
    ...resetWarnings(state),
    input: value,
    inputType: type,
    outputValid: state.input === value,
  }
  return (type === 'file' ? resetOutput(next) : next) as State
}

export const nextOpenedFileState = <State extends CommonState>(state: State, path: string): State =>
  ({
    ...resetOutput(state),
    input: path,
    inputType: 'file',
  }) as State

export const useCommittedState = <State>(createInitialState: () => State) => {
  const [state, setState] = React.useState(createInitialState)
  const stateRef = React.useRef(state)

  const commitState = React.useCallback((next: State) => {
    stateRef.current = next
    setState(next)
    return next
  }, [])

  return {commitState, state, stateRef}
}

export const maybeAutoRunTextOperation = <State extends CommonState>(
  snapshot: State,
  run: (destinationDir?: string, snapshot?: State) => Promise<unknown>
) => {
  if (snapshot.inputType !== 'text' || C.isMobile) return
  C.ignorePromise(run('', snapshot))
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
