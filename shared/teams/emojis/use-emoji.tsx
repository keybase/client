import type * as T from '@/constants/types'
import * as Z from '@/util/zustand'
type Store = T.Immutable<{
  emojiUpdatedTrigger: number
}>

const initialStore: Store = {
  emojiUpdatedTrigger: 0,
}

interface State extends Store {
  dispatch: {
    triggerEmojiUpdated: () => void
    resetState: () => void
  }
}

export const useEmojiState = Z.createZustand<State>(set => {
  const dispatch: Z.InitialDispatch<State['dispatch']> = {
    resetState: 'default',
    triggerEmojiUpdated: () => {
      set(state => {
        state.emojiUpdatedTrigger++
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
