import * as React from 'react'
import * as Z from '../../util/zustand'
import * as Chat2Gen from '../../actions/chat2-gen'
import {type StoreApi, type UseBoundStore, useStore} from 'zustand'
import * as Types from '../types/chat2'
import type * as TeamsTypes from '../types/teams'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as RPCTypes from '../types/rpc-gen'
import {noConversationIDKey} from '../types/chat2/common'
import isEqual from 'lodash/isEqual'
import {mapGetEnsureValue} from '../../util/map'
import HiddenString from '../../util/hidden-string'

// per convo store
type ConvoStore = {
  id: Types.ConversationIDKey
  // temp cache for requestPayment and sendPayment message data,
  accountsInfoMap: Map<RPCChatTypes.MessageID, Types.ChatRequestInfo | Types.ChatPaymentInfo>
  badge: number
  dismissedInviteBanners: boolean
  draft?: string
  giphyResult?: RPCChatTypes.GiphySearchResults
  giphyWindow: boolean
  muted: boolean
  mutualTeams: Array<TeamsTypes.TeamID>
  typing: Set<string>
  unfurlPrompt: Map<Types.MessageID, Set<string>>
  unread: number
  unsentText?: string
}

const initialConvoStore: ConvoStore = {
  accountsInfoMap: new Map(),
  badge: 0,
  dismissedInviteBanners: false,
  draft: undefined,
  giphyResult: undefined,
  giphyWindow: false,
  id: noConversationIDKey,
  muted: false,
  mutualTeams: [],
  typing: new Set(),
  unfurlPrompt: new Map(),
  unread: 0,
  unsentText: undefined,
}
export type ConvoState = ConvoStore & {
  dispatch: {
    badgesUpdated: (badge: number) => void
    dismissBottomBanner: () => void
    giphyGotSearchResult: (results: RPCChatTypes.GiphySearchResults) => void
    giphySend: (result: RPCChatTypes.GiphySearchResult) => void
    giphyToggleWindow: (show: boolean) => void
    mute: (m: boolean) => void
    paymentInfoReceived: (messageID: RPCChatTypes.MessageID, paymentInfo: Types.ChatPaymentInfo) => void
    refreshMutualTeamsInConv: () => void
    requestInfoReceived: (messageID: RPCChatTypes.MessageID, requestInfo: Types.ChatRequestInfo) => void
    resetState: 'default'
    resetUnsentText: () => void
    setDraft: (d?: string) => void
    setMuted: (m: boolean) => void
    setTyping: (t: Set<string>) => void
    unfurlTogglePrompt: (messageID: Types.MessageID, domain: string, show: boolean) => void
    unreadUpdated: (unread: number) => void
    // this is how you set the unset value, including ''
    setUnsentText: (u: string) => void
  }
}

const createSlice: Z.ImmerStateCreator<ConvoState> = (set, get) => {
  const getReduxState = Z.getReduxStore()
  const reduxDispatch = Z.getReduxDispatch()
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
    giphyGotSearchResult: results => {
      set(s => {
        s.giphyResult = results
      })
    },
    giphySend: result => {
      set(s => {
        s.giphyWindow = false
      })
      const f = async () => {
        const Constants = await import('./index')
        const conversationIDKey = get().id
        const replyTo = Constants.getReplyToMessageID(getReduxState(), conversationIDKey)
        try {
          await RPCChatTypes.localTrackGiphySelectRpcPromise({result})
        } catch {}
        const url = new HiddenString(result.targetUrl)
        Constants.getConvoState(conversationIDKey).dispatch.setUnsentText('')
        reduxDispatch(
          Chat2Gen.createMessageSend({conversationIDKey, replyTo: replyTo || undefined, text: url})
        )
      }
      Z.ignorePromise(f())
    },
    giphyToggleWindow: (show: boolean) => {
      set(s => {
        s.giphyWindow = show
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
    refreshMutualTeamsInConv: () => {
      const f = async () => {
        const Constants = await import('./index')
        const ConfigConstants = await import('../config')
        const conversationIDKey = get().id
        const participantInfo = Constants.getParticipantInfo(getReduxState(), conversationIDKey)
        const username = ConfigConstants.useCurrentUserState.getState().username
        const otherParticipants = Constants.getRowParticipants(participantInfo, username || '')
        const results = await RPCChatTypes.localGetMutualTeamsLocalRpcPromise(
          {usernames: otherParticipants},
          Constants.waitingKeyMutualTeams(conversationIDKey)
        )
        set(s => {
          s.mutualTeams = results.teamIDs ?? []
        })
      }
      Z.ignorePromise(f())
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
    setTyping: t => {
      set(s => {
        if (!isEqual(s.typing, t)) {
          s.typing = t
        }
      })
    },
    setUnsentText: u => {
      set(s => {
        s.unsentText = u
      })
    },
    unfurlTogglePrompt: (messageID, domain, show) => {
      set(s => {
        const prompts = mapGetEnsureValue(s.unfurlPrompt, messageID, new Set())
        if (show) {
          prompts.add(domain)
        } else {
          prompts.delete(domain)
        }
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
