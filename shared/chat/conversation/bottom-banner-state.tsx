import type * as T from '@/constants/types'
import * as Z from '@/util/zustand'

type Store = T.Immutable<{
  inviteBannerDismissed: Set<T.Chat.ConversationIDKey>
}>

const initialStore: Store = {
  inviteBannerDismissed: new Set(),
}

type State = Store & {
  dispatch: {
    dismissInviteBanner: (conversationIDKey: T.Chat.ConversationIDKey) => void
    resetState: () => void
  }
}

export const useBottomBannerState = Z.createZustand<State>('chat-bottom-banner', set => {
  const dispatch: State['dispatch'] = {
    dismissInviteBanner: conversationIDKey => {
      set(s => {
        s.inviteBannerDismissed.add(conversationIDKey)
      })
    },
    resetState: Z.defaultReset,
  }

  return {
    ...initialStore,
    dispatch,
  }
})
