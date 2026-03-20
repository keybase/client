import * as Chat from '@/stores/chat'
import * as Z from '@/util/zustand'
import type * as T from '@/constants/types'

type Store = T.Immutable<{
  openedRow: T.Chat.ConversationIDKey
}>

const initialStore: Store = {
  openedRow: Chat.noConversationIDKey,
}

interface State extends Store {
  dispatch: {
    setOpenRow: (row: T.Chat.ConversationIDKey) => void
    resetState: () => void
  }
}

export const useOpenedRowState = Z.createZustand<State>(set => {
  const dispatch: Z.InitialDispatch<State['dispatch']> = {
    resetState: 'default',
    setOpenRow: row => {
      set(state => {
        state.openedRow = row
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
