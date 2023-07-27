import * as React from 'react'
import * as Z from '../../util/zustand'
import {type StoreApi, type UseBoundStore, useStore} from 'zustand'
import * as Types from '../types/chat2'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as RPCTypes from '../types/rpc-gen'
import {noConversationIDKey} from '../types/chat2/common'

// per convo store
type ConvoStore = {
  id: Types.ConversationIDKey
  // temp cache for requestPayment and sendPayment message data,
  accountsInfoMap: Map<RPCChatTypes.MessageID, Types.ChatRequestInfo | Types.ChatPaymentInfo>
  badge: number
  unread: number
  muted: boolean
  draft?: string
  unsentText?: string
  dismissedInviteBanners: boolean
}

const initialConvoStore: ConvoStore = {
  accountsInfoMap: new Map(),
  badge: 0,
  dismissedInviteBanners: false,
  draft: undefined,
  id: noConversationIDKey,
  muted: false,
  unread: 0,
  unsentText: undefined,
}
export type ConvoState = ConvoStore & {
  dispatch: {
    badgesUpdated: (badge: number) => void
    dismissBottomBanner: () => void
    mute: (m: boolean) => void
    paymentInfoReceived: (messageID: RPCChatTypes.MessageID, paymentInfo: Types.ChatPaymentInfo) => void
    requestInfoReceived: (messageID: RPCChatTypes.MessageID, requestInfo: Types.ChatRequestInfo) => void
    resetState: 'default'
    setDraft: (d?: string) => void
    setMuted: (m: boolean) => void
    unreadUpdated: (unread: number) => void
    // this is how you set the unset value, including ''
    setUnsentText: (u: string) => void
    resetUnsentText: () => void
  }
}

const createSlice: Z.ImmerStateCreator<ConvoState> = (set, get) => {
  const dispatch: ConvoState['dispatch'] = {
    badgesUpdated: badge => {
      set(s => {
        s.badge = badge
      })
    },
    dismissBottomBanner: () => {
      set(s => {
        s.dismissedInviteBanners = true
      })
    },
    mute: m => {
      const f = async () => {
        await RPCChatTypes.localSetConversationStatusLocalRpcPromise({
          conversationID: Types.keyToConversationID(get().id),
          identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
          status: m ? RPCChatTypes.ConversationStatus.muted : RPCChatTypes.ConversationStatus.unfiled,
        })
      }
      Z.ignorePromise(f())
    },
    paymentInfoReceived: (messageID, paymentInfo) => {
      set(s => {
        s.accountsInfoMap.set(messageID, paymentInfo)
      })
    },
    requestInfoReceived: (messageID, requestInfo) => {
      set(s => {
        s.accountsInfoMap.set(messageID, requestInfo)
      })
    },
    resetState: 'default',
    resetUnsentText: () => {
      set(s => {
        s.unsentText = undefined
      })
    },
    setDraft: d => {
      set(s => {
        s.draft = d
      })
    },
    setMuted: m => {
      set(s => {
        s.muted = m
      })
    },
    setUnsentText: u => {
      set(s => {
        s.unsentText = u
      })
    },
    unreadUpdated: unread => {
      set(s => {
        s.unread = unread
      })
    },
  }
  return {
    ...initialConvoStore,
    dispatch,
  }
}

type MadeStore = UseBoundStore<StoreApi<ConvoState>>
export const stores = new Map<Types.ConversationIDKey, MadeStore>()

const createConvoStore = (id: Types.ConversationIDKey) => {
  const existing = stores.get(id)
  if (existing) return existing
  const next = Z.createZustand<ConvoState>(createSlice)
  next.setState({id})
  stores.set(id, next)
  return next
}

export function getConvoState(id: Types.ConversationIDKey) {
  const store = createConvoStore(id)
  return store.getState()
}

const Context = React.createContext<MadeStore | null>(null)

type ConvoProviderProps = React.PropsWithChildren<{id: Types.ConversationIDKey; canBeNull?: boolean}>
export function Provider({canBeNull, children, ...props}: ConvoProviderProps) {
  if (!canBeNull && (!props.id || props.id === noConversationIDKey)) {
    throw new Error('No convo id in provider')
  }
  return <Context.Provider value={createConvoStore(props.id)}>{children}</Context.Provider>
}

export function useContext<T>(
  selector: (state: ConvoState) => T,
  equalityFn?: (left: T, right: T) => boolean
): T {
  const store = React.useContext(Context)
  if (!store) throw new Error('Missing ConvoContext.Provider in the tree')
  return useStore(store, selector, equalityFn)
}
