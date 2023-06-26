import * as Z from '../../util/zustand'
type Store = {
  emojiUpdatedTrigger: number
}

const initialStore: Store = {
  emojiUpdatedTrigger: 0,
}

type State = Store & {
  dispatch: {
    triggerEmojiUpdated: () => void
    resetState: () => void
  }
}

export const useEmojiState = Z.createZustand(
  Z.immerZustand<State>(set => {
    const dispatch = {
      resetState: () => set(s => ({...s, ...initialStore})),
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
)
