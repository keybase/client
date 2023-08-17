import * as Z from '../util/zustand'

type Store = {
  active: boolean
}
const initialStore: Store = {
  active: true,
}
type State = Store & {
  dispatch: {
    resetState: 'default'
    setActive: (a: boolean) => void
  }
}
export const _useState = Z.createZustand<State>(set => {
  const dispatch: State['dispatch'] = {
    resetState: 'default',
    setActive: a => {
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
