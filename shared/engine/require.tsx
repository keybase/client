// Helper to get engine and break require loops
import {Engine} from '.'
export type {ListenerApi} from '../util/redux-toolkit'

let _engine: Engine
export function initEngine(e: Engine) {
  _engine = e
}
export function getEngine(): Engine {
  return _engine
}

type WaitingKey = string | Array<string>
type EngineSagaParam = {
  method: string
  params: Object | null
  incomingCallMap?: {[K in string]: any}
  customResponseIncomingCallMap?: {[K in string]: any}
  waitingKey?: WaitingKey
}
type EngineSaga = (p: EngineSagaParam) => IterableIterator<any>

let _engineSaga: EngineSaga
export function initEngineSaga(es: EngineSaga) {
  _engineSaga = es
}
export function getEngineSaga() {
  // TODO codemod issue
  return _engineSaga as any
}

let _engineListener: any
export function initEngineListener(l: any) {
  _engineListener = l
}
export function getEngineListener() {
  return _engineListener as any
}
