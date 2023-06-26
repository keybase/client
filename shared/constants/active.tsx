import * as Z from '../util/zustand'

type Store = {
  active: boolean
}
const initialStore: Store = {
  active: true,
}
type State = Store & {
  dispatch: {
    resetState: () => void
    setActive: (a: boolean) => void
  }
}
export const useActiveState = Z.createZustand(
  Z.immerZustand<State>(set => {
    const dispatch = {
      resetState: () => {
        set(s => ({...s, ...initialStore}))
      },
      setActive: (a: boolean) => {
        set(s => {
          s.active = a
        })
      },
    }
    return {
      ...initialStore,
      dispatch,
    }
  })
)
