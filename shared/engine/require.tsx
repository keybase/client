// Helper to get engine and break require loops
import type {Engine} from '.'
export type {ListenerApi} from '../util/redux-toolkit'

let _engine: Engine
export function initEngine(e: Engine) {
  _engine = e
}
export function getEngine(): Engine {
  return _engine
}

let _engineListener: any
export function initEngineListener(l: any) {
  _engineListener = l
}
export function getEngineListener() {
  return _engineListener
}
