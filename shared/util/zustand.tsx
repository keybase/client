// helpers for redux / zustand
import type {TypedActions} from '../actions/typed-actions-gen'
import type {TypedState} from '../constants/reducer'
import {create as _createZustand} from 'zustand'

type TypedDispatch = (action: TypedActions) => void

export const getReduxDispatch: () => TypedDispatch = () => (a: TypedActions) =>
  require('../store/configure-store').getGlobalStore().dispatch(a)

export const getReduxStore: () => () => TypedState = () => () =>
  require('../store/configure-store').getGlobalStore().getState()

export const ignorePromise = (f: Promise<void>) => {
  f.then(() => {}).catch(() => {})
}

export const dummyListenerApi = {
  delay: async () => Promise.resolve(),
  dispatch: () => {},
  fork: () => {
    throw new Error('dummy')
  },
  getState: () => {
    throw new Error('dummy')
  },
  take: () => {
    throw new Error('dummy')
  },
}

export {immer as immerZustand} from 'zustand/middleware/immer'
const checkResetStoreCZ: any = (p: any) => {
  // @ts-ignore
  const temp = _createZustand(p)
  try {
    temp.getState().dispatch.resetState()
    // invalid resets can blow away dispatch!!
    temp.getState().dispatch.resetState()
  } catch (e) {
    // eslint-disable-next-line
    debugger
    console.log('Store without a resetState or invalid reset state!!!!', e)
  }
  return temp
}
export const createZustand: typeof _createZustand = __DEV__ ? checkResetStoreCZ : _createZustand
