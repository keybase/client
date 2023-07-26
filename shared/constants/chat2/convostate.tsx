import * as React from 'react'
import * as Z from '../../util/zustand'
import {type StoreApi, type UseBoundStore, useStore} from 'zustand'
import * as Types from '../types/chat2'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import {noConversationIDKey} from '../types/chat2/common'

// per convo store
type ConvoStore = {
  id: Types.ConversationIDKey
  // temp cache for requestPayment and sendPayment message data,
  accountsInfoMap: Map<RPCChatTypes.MessageID, Types.ChatRequestInfo | Types.ChatPaymentInfo>
}

const initialConvoStore: ConvoStore = {
  accountsInfoMap: new Map(),
  id: noConversationIDKey,
}
export type ConvoState = ConvoStore & {
  dispatch: {
    paymentInfoReceived: (messageID: RPCChatTypes.MessageID, paymentInfo: Types.ChatPaymentInfo) => void
    requestInfoReceived: (messageID: RPCChatTypes.MessageID, requestInfo: Types.ChatRequestInfo) => void
    resetState: 'default'
  }
}

const createSlice: Z.ImmerStateCreator<ConvoState> = (set, _get) => {
  const dispatch: ConvoState['dispatch'] = {
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

type ConvoProviderProps = React.PropsWithChildren<{id: Types.ConversationIDKey}>
export function Provider({children, ...props}: ConvoProviderProps) {
  const storeRef = React.useRef<MadeStore>()
  if (!storeRef.current) {
    storeRef.current = createConvoStore(props.id)
  }
  return <Context.Provider value={storeRef.current}>{children}</Context.Provider>
}

export function useContext<T>(
  selector: (state: ConvoState) => T,
  equalityFn?: (left: T, right: T) => boolean
): T {
  const store = React.useContext(Context)
  if (!store) throw new Error('Missing ConvoContext.Provider in the tree')
  return useStore(store, selector, equalityFn)
}
