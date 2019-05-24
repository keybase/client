// Helper to get engine and break require loops
import {Engine} from '.'
import {CallEffectNamedFn} from 'redux-saga/effects'

let _engine: Engine
export function initEngine(e: Engine) {
  _engine = e
}
export function getEngine(): Engine {
  return _engine
}

type WaitingKey = string | Array<string>
type EngineSaga = CallEffectNamedFn

let _engineSaga: EngineSaga
export function initEngineSaga(es: EngineSaga) {
  _engineSaga = es
}
export function getEngineSaga() {
  return _engineSaga
}
