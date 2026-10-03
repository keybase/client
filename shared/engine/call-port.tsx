// Generated rpc code calls the engine through this port; it must not import engine/index, which
// imports the generated code (the cycle would leave one side undefined at module init).
import type {SessionID, WaitingKeys} from './types'

export type CallParams = {
  method: string
  params: object | undefined
  callback: (...args: Array<any>) => void
  incomingCallMap?: object
  customResponseIncomingCallMap?: object
  waitingKey?: WaitingKeys
  globalFallthrough?: ReadonlyArray<string>
}

export type ListenParams = {
  method: string
  params?: object
  incomingCallMap?: object
  customResponseIncomingCallMap?: object
  waitingKey?: WaitingKeys
  // holdServerWork: the service works on while the flow holds a prompt (see WaitingTracker)
  onSessionCreated?: (cancel: () => void, session: {holdServerWork: () => () => void}) => void
  globalFallthrough?: ReadonlyArray<string>
}

export type CallPort = {
  call: (p: CallParams) => SessionID
  listen: (p: ListenParams) => Promise<unknown>
  cancelOutstandingSessions: () => void
}

let port: CallPort | undefined

export const installCallPort = (p: CallPort) => {
  port = p
}

export const uninstallCallPort = () => {
  port = undefined
}

export const hasCallPort = () => !!port

export const getCallPort = (): CallPort => {
  if (!port) {
    throw new Error('No engine?')
  }
  return port
}
