// helpers for redux / zustand
import type {TypedActions} from '../actions/typed-actions-gen'
import type {TypedState} from '../constants/reducer'
// import {create as _createZustand} from 'zustand'

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

// only in dev
// const autoResetStore = __DEV__ && false
const sanityCheckByResettingStoreAutomatically = __DEV__ && true
const sanityStores = new Array<any>()

// const checkResetStoreCZ: any = (p: any) => {
//   // @ts-ignore
//   const temp = _createZustand(p)
//   if (sanityCheckByResettingStoreAutomatically) {
//     sanityStores.push(temp)
//   }

//   try {
//     if (autoResetStore) {
//       temp.getState().dispatch.resetState()
//       // invalid resets can blow away dispatch!!
//       temp.getState().dispatch.resetState()
//     }
//   } catch (e) {
//     // eslint-disable-next-line
//     debugger
//     console.log('Store without a resetState or invalid reset state!!!!', e)
//   }
//   return temp
// }

// if (sanityCheckByResettingStoreAutomatically) {
//   console.log('Sanity check reset hookup')
//   setTimeout(() => {
//     const before = sanityStores.map(s => s.getState())
//     getReduxDispatch()({type: 'common:resetStore'} as any)
//     const after = sanityStores.map(s => s.getState())
//     before.forEach((b, idx) => {
//       if (b === after[idx]) {
//         // eslint-disable-next-line
//         // debugger
//         console.log("Store wasn't reset!", b)
//       } else {
//         console.log('Store was reset', b)
//       }
//     })
//   }, 1000)
// }
// // export const createZustand: typeof _createZustand = __DEV__ ? checkResetStoreCZ : _createZustand

import {create as _create, type StateCreator} from 'zustand'

const resetters: (() => void)[] = []

type HasReset = {dispatch: {resetState: () => void}}
const hasReset = (s: any): s is HasReset => {
  return typeof s?.dispatch?.resetState === 'function'
}

const create = (<T,>(f: StateCreator<T>) => {
  const store = _create(f)
  const initialState = store.getState()
  // custom reset
  if (hasReset(initialState)) {
    resetters.push(() => {
      initialState.dispatch.resetState()
    })
  } else {
    resetters.push(() => {
      store.setState(initialState, true)
    })
  }
  return store
}) as typeof _create

export const resetAllStores = () => {
  for (const resetter of resetters) {
    resetter()
  }
}

export const createZustand = create
export {immer as immerZustand} from 'zustand/middleware/immer'

type Store = {
  typingMap: Map<string, Set<string>>
}
const initialStore: Store = {
  typingMap: new Map(),
}
type State = Store & {
  dispatch: {
    resetState: () => void
  }
}

import {immer as immerZustand} from 'zustand/middleware/immer'
const useChatState = createZustand(
  immerZustand<State>(set => {
    const dispatch = {
      resetState: () => {
        set(s => ({...s, ...initialStore}))
      },
    }
    return {
      ...initialStore,
      dispatch,
    }
  })
)

console.log('aaa', useChatState)
