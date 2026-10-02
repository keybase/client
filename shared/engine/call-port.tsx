// Generated rpc code calls the engine through this port; it must not import engine/index, which
// imports the generated code (the cycle would leave one side undefined at module init).
import type {SessionID, WaitingKey} from './types'

export type CallParams = {
  method: string
  params: object | undefined
  callback: (...args: Array<any>) => void
  incomingCallMap?: object
  customResponseIncomingCallMap?: object
  waitingKey?: WaitingKey
  globalFallthrough?: ReadonlyArray<string>
}

export type ListenParams = {
  method: string
  params?: object
  incomingCallMap?: object
  customResponseIncomingCallMap?: object
  waitingKey?: WaitingKey
  onSessionCreated?: (cancel: () => void) => void
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
