// A conversation screen's providers, real: the conversation route of the real navigation tree, the
// signed-in account the thread is built for, and the real thread provider. For tests of a component
// or hook that lives inside a thread.
import * as React from 'react'
import type * as T from '@/constants/types'
import {useCurrentUserState} from '@/stores/current-user'
import {navigationWrapper} from '@/test/navigation'
import {ConversationThreadProvider, useConversationThreadStore} from '@/chat/conversation/thread-context'

export const signIn = (username = 'testuser') => {
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username,
  })
}

type ThreadStore = ReturnType<typeof useConversationThreadStore>

// Hands out the thread's own store once the provider has built it
function StoreReader(p: {onStore: (s: ThreadStore) => void}) {
  const store = useConversationThreadStore()
  const {onStore} = p
  React.useLayoutEffect(() => {
    onStore(store)
  }, [onStore, store])
  return null
}

// A testing-library wrapper rendering its children inside conversation `id`'s thread, on the
// conversation's route (chatRoot on a split layout, chatConversation on a phone). The account must be
// signed in (signIn) before rendering or the provider builds no thread. `params` adds to the route's
// params (a thread search, an info panel).
export const threadWrapper = (id: T.Chat.ConversationIDKey, p?: {phone?: boolean; params?: object}) => {
  const params = {conversationIDKey: id, ...p?.params}
  const nav = p?.phone
    ? navigationWrapper({layout: 'phone', params, route: 'chatConversation'})
    : navigationWrapper({params, route: 'chatRoot'})
  const {wrapper: Nav} = nav
  const ref: {store: ThreadStore | undefined} = {store: undefined}
  const onStore = (s: ThreadStore) => {
    ref.store = s
  }
  function ThreadWrapper({children}: {children?: React.ReactNode}) {
    return (
      <Nav>
        <ConversationThreadProvider id={id}>
          <StoreReader onStore={onStore} />
          {children}
        </ConversationThreadProvider>
      </Nav>
    )
  }
  return {
    ...nav,
    // The thread's store, as the provider built it; set only after the first render
    store: () => {
      if (!ref.store) throw new Error('thread-tree: the thread has not rendered')
      return ref.store
    },
    wrapper: ThreadWrapper,
  }
}
