import * as Z from '../../../util/zustand'

type Store = {
  allowOpenTrigger: number
}

const initialStore: Store = {
  allowOpenTrigger: 0,
}

type State = Store & {
  dispatch: {
    triggerAllowOpen: () => void
    resetState: () => void
  }
}
// just to plumb the state, really the settings tab should change how it works, its quite
// old and creaky
export const useSettingsState = Z.createZustand(
  Z.immerZustand<State>(set => {
    const dispatch = {
      resetState: () => {
        set(s => ({...s, ...initialStore}))
      },
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
)
