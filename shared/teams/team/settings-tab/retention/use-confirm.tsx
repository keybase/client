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
    resetState: 'default'
    updateConfirm: (rt: RetentionPolicy | undefined) => void
  }
}

export const useConfirm = Z.createZustand<State>(set => {
  const dispatch: State['dispatch'] = {
    resetState: 'default',
    updateConfirm: rt => {
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
