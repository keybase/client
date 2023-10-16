// Helper to get engine and break require loops
import type {Engine} from '.'

let _engine: Engine | undefined
export function initEngine(e: Engine) {
  _engine = e
}
export function hasEngine(): boolean {
  return !!_engine
}
export function getEngine(): Engine {
  if (!_engine) {
    throw new Error('No engine?')
  }
  return _engine
}

let _engineListener: unknown
export function initEngineListener(l: typeof _engineListener) {
  _engineListener = l
}
export function getEngineListener<C, R>() {
  return _engineListener as (args: C & {method: string}) => R
}
