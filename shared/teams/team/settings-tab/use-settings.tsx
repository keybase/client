import type * as T from '@/constants/types'
import * as Z from '@/util/zustand'

type Store = T.Immutable<{
  allowOpenTrigger: number
}>

const initialStore: Store = {
  allowOpenTrigger: 0,
}

interface State extends Store {
  dispatch: {
    triggerAllowOpen: () => void
    resetState: 'default'
  }
}
// just to plumb the state, really the settings tab should change how it works, its quite
// old and creaky
export const useSettingsState = Z.createZustand<State>(set => {
  const dispatch: State['dispatch'] = {
    resetState: 'default',
    triggerAllowOpen: () => {
      set(state => {
        state.allowOpenTrigger++
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
