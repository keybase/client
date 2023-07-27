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
import logger from '../../logger'
import {RPCError} from '../../util/errors'

const makeThreadSearchInfo = (): Types.ThreadSearchInfo => ({
  hits: [],
  status: 'initial',
  visible: false,
})

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
  threadSearchInfo: Types.ThreadSearchInfo
  threadSearchQuery: string
  replyTo: Types.Ordinal
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
  replyTo: 0,
  threadSearchInfo: makeThreadSearchInfo(),
  threadSearchQuery: '',
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
    setReplyTo: (o: Types.Ordinal) => void
    setTyping: (t: Set<string>) => void
    unfurlTogglePrompt: (messageID: Types.MessageID, domain: string, show: boolean) => void
    unreadUpdated: (unread: number) => void
    // this is how you set the unset value, including ''
    setUnsentText: (u: string) => void
    threadSearch: (query: string) => void
    setThreadSearchQuery: (query: string) => void
    toggleThreadSearch: (hide?: boolean) => void
    hideSearch: () => void
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
    hideSearch: () => {
      set(s => {
        s.threadSearchInfo.visible = false
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
    setReplyTo: o => {
      set(s => {
        s.replyTo = o
      })
    },
    setThreadSearchQuery: query => {
      set(s => {
        s.threadSearchQuery = query
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
    threadSearch: query => {
      set(s => {
        s.threadSearchInfo.hits = []
      })
      const f = async () => {
        const Constants = await import('./index')
        const conversationIDKey = get().id
        const {username, getLastOrdinal, devicename} = Constants.getMessageStateExtras(
          getReduxState(),
          conversationIDKey
        )
        const onDone = () => {
          set(s => {
            s.threadSearchInfo.status = 'done'
          })
        }
        try {
          await RPCChatTypes.localSearchInboxRpcListener(
            {
              incomingCallMap: {
                'chat.1.chatUi.chatSearchDone': onDone,
                'chat.1.chatUi.chatSearchHit': hit => {
                  const message = Constants.uiMessageToMessage(
                    conversationIDKey,
                    hit.searchHit.hitMessage,
                    username,
                    getLastOrdinal,
                    devicename
                  )

                  if (message) {
                    set(s => {
                      s.threadSearchInfo.hits = [message]
                    })
                  }
                },
                'chat.1.chatUi.chatSearchInboxDone': onDone,
                'chat.1.chatUi.chatSearchInboxHit': resp => {
                  const messages = (resp.searchHit.hits || []).reduce<Array<Types.Message>>((l, h) => {
                    const uiMsg = Constants.uiMessageToMessage(
                      conversationIDKey,
                      h.hitMessage,
                      username,
                      getLastOrdinal,
                      devicename
                    )
                    if (uiMsg) {
                      l.push(uiMsg)
                    }
                    return l
                  }, [])
                  set(s => {
                    if (messages.length > 0) {
                      s.threadSearchInfo.hits = messages
                    }
                  })
                },
                'chat.1.chatUi.chatSearchInboxStart': () => {
                  set(s => {
                    s.threadSearchInfo.status = 'inprogress'
                  })
                },
              },
              params: {
                identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
                namesOnly: false,
                opts: {
                  afterContext: 0,
                  beforeContext: 0,
                  convID: Types.keyToConversationID(conversationIDKey),
                  isRegex: false,
                  matchMentions: false,
                  maxBots: 0,
                  maxConvsHit: 0,
                  maxConvsSearched: 0,
                  maxHits: 1000,
                  maxMessages: -1,
                  maxNameConvs: 0,
                  maxTeams: 0,
                  reindexMode: RPCChatTypes.ReIndexingMode.postsearchSync,
                  sentAfter: 0,
                  sentBefore: 0,
                  sentBy: '',
                  sentTo: '',
                  skipBotCache: false,
                },
                query,
              },
            },
            Z.dummyListenerApi
          )
        } catch (error) {
          if (error instanceof RPCError) {
            logger.error('search failed: ' + error.message)
            set(s => {
              s.threadSearchInfo.status = 'done'
            })
          }
        }
      }
      Z.ignorePromise(f())
    },
    toggleThreadSearch: hide => {
      set(s => {
        // TODO >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
        const {threadSearchInfo /*, messageCenterOrdinals*/} = s
        threadSearchInfo.hits = []
        threadSearchInfo.status = 'initial'
        if (hide !== undefined) {
          threadSearchInfo.visible = !hide
        } else {
          threadSearchInfo.visible = !threadSearchInfo.visible
        }
        //   messageCenterOrdinals.delete(conversationIDKey)
      })

      const f = async () => {
        const visible = get().threadSearchInfo.visible
        if (!visible) {
          await RPCChatTypes.localCancelActiveSearchRpcPromise()
        }
      }
      Z.ignorePromise(f())
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
