// helpers for redux / zustand
import type {TypedActions} from '../actions/typed-actions-gen'
import type {TypedState} from '../constants/reducer'

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
export {create as createZustand} from 'zustand'
