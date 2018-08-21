// @flow
// Helper to get engine and break require loops
import type {Engine} from '.'

let _engine: Engine
export function initEngine(e: Engine) {
  _engine = e
}

export function getEngine(): Engine {
  return _engine
}
