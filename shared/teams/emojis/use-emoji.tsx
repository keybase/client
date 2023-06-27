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
    resetState: 'default'
  }
}

export const useEmojiState = Z.createZustand<State>(set => {
  const dispatch: State['dispatch'] = {
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
