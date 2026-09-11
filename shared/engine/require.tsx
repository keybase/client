// Helper to get engine and break require loops
import type {Engine} from '.'

// The engine as seen through this seam: only the members the generated RPC
// helpers, the listener and sessions actually reach for. Narrow on purpose, so a
// stand-in (test/fake-engine) can answer here without impersonating the whole
// transport.
export type EngineSeam = Pick<
  Engine,
  '_rpcOutgoing' | 'cancelSession' | 'createSession' | 'dispatchWaitingAction'
>

let _engine: EngineSeam | undefined
export function initEngine(e: EngineSeam) {
  _engine = e
}
export function resetEngine() {
  _engine = undefined
}
export function hasEngine(): boolean {
  return !!_engine
}
export function getEngine(): EngineSeam {
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
