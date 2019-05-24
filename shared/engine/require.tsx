// Helper to get engine and break require loops
import {Engine} from '.'
import {CallEffectFn, Func1} from 'redux-saga/effects'

let _engine: Engine
export function initEngine(e: Engine) {
  _engine = e
}
export function getEngine(): Engine {
  return _engine
}

let _engineSaga: Func1<any>

export function initEngineSaga(es: Func1<any>) {
  _engineSaga = es
}
export function getEngineSaga(): CallEffectFn<Func1<any>> {
  return _engineSaga
}
