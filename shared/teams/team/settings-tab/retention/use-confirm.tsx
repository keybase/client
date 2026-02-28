import * as Z from '@/util/zustand'
import type * as T from '@/constants/types'

type Store = T.Immutable<{
  confirmed: T.Retention.RetentionPolicy | undefined
  modalOpen: boolean
}>
const initialStore: Store = {
  confirmed: undefined,
  modalOpen: false,
}
type State = Store & {
  dispatch: {
    resetState: 'default'
    openModal: () => void
    closeModal: () => void
    updateConfirm: (rt: T.Retention.RetentionPolicy | undefined) => void
  }
}

export const useConfirm = Z.createZustand<State>(set => {
  const dispatch: State['dispatch'] = {
    closeModal: () => {
      set(s => {
        s.modalOpen = false
      })
    },
    openModal: () => {
      set(s => {
        s.modalOpen = true
      })
    },
    resetState: 'default',
    updateConfirm: rt => {
      set(s => {
        s.modalOpen = false
        s.confirmed = rt
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
