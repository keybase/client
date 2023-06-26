import * as Z from '../../../../util/zustand'
import type {RetentionPolicy} from '../../../../constants/types/retention-policy'

type Store = {
  confirmed: RetentionPolicy | undefined
}
const initialStore: Store = {
  confirmed: undefined,
}
type State = Store & {
  dispatch: {
    resetState: () => void
    updateConfirm: (rt: RetentionPolicy | undefined) => void
  }
}

export const useConfirm = Z.createZustand(
  Z.immerZustand<State>(set => {
    const dispatch = {
      resetState: () => {
        set(s => ({...s, ...initialStore}))
      },
      updateConfirm: (rt: RetentionPolicy | undefined) => {
        set(state => {
          state.confirmed = rt
        })
      },
    }
    return {
      ...initialStore,
      dispatch,
    }
  })
)
