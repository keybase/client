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
    resetState: 'default'
  }
}
export const useEditState = Z.createZustand<State>(set => {
  const dispatch: State['dispatch'] = {
    resetState: 'default',
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
