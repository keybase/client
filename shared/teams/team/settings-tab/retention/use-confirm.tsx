import * as Z from '../../../../util/zustand'
import type * as T from '../../../../constants/types'

type Store = {
  confirmed: T.Retention.RetentionPolicy | undefined
}
const initialStore: Store = {
  confirmed: undefined,
}
type State = Store & {
  dispatch: {
    resetState: 'default'
    updateConfirm: (rt: T.Retention.RetentionPolicy | undefined) => void
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
