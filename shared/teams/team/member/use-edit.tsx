import * as Z from '../../../util/zustand'

type Store = {
  editUpdatedTrigger: number
}
const initialStore: Store = {
  editUpdatedTrigger: 0,
}
type State = Store & {
  dispatch: {
    triggerEditUpdated: () => void
    resetState: () => void
  }
}
export const useEditState = Z.createZustand<State>(set => {
  const dispatch = {
    resetState: () => {
      set(s => ({...s, ...initialStore}))
    },
    triggerEditUpdated: () => {
      set(s => {
        s.editUpdatedTrigger++
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
