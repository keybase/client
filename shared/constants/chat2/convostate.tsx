import * as Chat2Gen from '../../actions/chat2-gen'
import * as Common from './common'
import * as Message from './message'
import * as Meta from './meta'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as RPCTypes from '../types/rpc-gen'
import * as React from 'react'
import * as Types from '../types/chat2'
import * as Z from '../../util/zustand'
import * as RouterConstants from '../router2'
import * as TeamsConstants from '../teams'
import HiddenString from '../../util/hidden-string'
import isEqual from 'lodash/isEqual'
import logger from '../../logger'
import type * as TeamsTypes from '../types/teams'
import {RPCError} from '../../util/errors'
import {mapGetEnsureValue} from '../../util/map'
import {noConversationIDKey} from '../types/chat2/common'
import {type StoreApi, type UseBoundStore, useStore} from 'zustand'

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
  botCommandsUpdateStatus: RPCChatTypes.UIBotCommandsUpdateStatusTyp
  botSettings: Map<string, RPCTypes.TeamBotSettings | undefined>
  botTeamRoleMap: Map<string, TeamsTypes.TeamRoleType | undefined>
  badge: number
  dismissedInviteBanners: boolean
  draft?: string
  explodingModeLock?: number // locks set on exploding mode while user is inputting text,
  explodingMode: number // seconds to exploding message expiration,
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
  botCommandsUpdateStatus: RPCChatTypes.UIBotCommandsUpdateStatusTyp.blank,
  botSettings: new Map(),
  botTeamRoleMap: new Map(),
  dismissedInviteBanners: false,
  draft: undefined,
  explodingMode: 0,
  explodingModeLock: undefined,
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
    addBotMember: (
      username: string,
      allowCommands: boolean,
      allowMentions: boolean,
      restricted: boolean,
      convs?: Array<string>
    ) => void
    removeBotMember: (username: string) => void
    badgesUpdated: (badge: number) => void
    dismissBottomBanner: () => void
    editBotSettings: (
      username: string,
      allowCommands: boolean,
      allowMentions: boolean,
      convs?: Array<string>
    ) => void
    giphyGotSearchResult: (results: RPCChatTypes.GiphySearchResults) => void
    giphySend: (result: RPCChatTypes.GiphySearchResult) => void
    giphyToggleWindow: (show: boolean) => void
    mute: (m: boolean) => void
    paymentInfoReceived: (messageID: RPCChatTypes.MessageID, paymentInfo: Types.ChatPaymentInfo) => void
    refreshBotRoleInConv: (username: string) => void
    refreshBotSettings: (username: string) => void
    refreshMutualTeamsInConv: () => void
    requestInfoReceived: (messageID: RPCChatTypes.MessageID, requestInfo: Types.ChatRequestInfo) => void
    resetState: 'default'
    resetUnsentText: () => void
    setExplodingMode: (seconds: number, incoming?: boolean) => void
    setDraft: (d?: string) => void
    setExplodingModeLocked: (locked: boolean) => void
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
    botCommandsUpdateStatus: (b: RPCChatTypes.UIBotCommandsUpdateStatus) => void
  }
  getExplodingMode: () => number
}

// don't bug the users with black bars for network errors. chat isn't going to work in general
const ignoreErrors = [
  RPCTypes.StatusCode.scgenericapierror,
  RPCTypes.StatusCode.scapinetworkerror,
  RPCTypes.StatusCode.sctimeout,
]

const createSlice: Z.ImmerStateCreator<ConvoState> = (set, get) => {
  const getReduxState = Z.getReduxStore()
  const reduxDispatch = Z.getReduxDispatch()
  const closeBotModal = () => {
    RouterConstants.useState.getState().dispatch.clearModals()
    const meta = getReduxState().chat2.metaMap.get(get().id)
    if (meta?.teamname) {
      TeamsConstants.useState.getState().dispatch.getMembers(meta.teamID)
    }
  }
  const dispatch: ConvoState['dispatch'] = {
    addBotMember: (username, allowCommands, allowMentions, restricted, convs) => {
      const f = async () => {
        const conversationIDKey = get().id
        try {
          await RPCChatTypes.localAddBotMemberRpcPromise(
            {
              botSettings: restricted ? {cmds: allowCommands, convs, mentions: allowMentions} : null,
              convID: Types.keyToConversationID(conversationIDKey),
              role: restricted ? RPCTypes.TeamRole.restrictedbot : RPCTypes.TeamRole.bot,
              username,
            },
            Common.waitingKeyBotAdd
          )
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info('addBotMember: failed to add bot member: ' + error.message)
          }
          return
        }
        closeBotModal()
      }
      Z.ignorePromise(f())
    },
    badgesUpdated: badge => {
      set(s => {
        s.badge = badge
      })
    },

    botCommandsUpdateStatus: status => {
      set(s => {
        s.botCommandsUpdateStatus = status.typ
        if (status.typ === RPCChatTypes.UIBotCommandsUpdateStatusTyp.uptodate) {
          const settingsMap = new Map<string, RPCTypes.TeamBotSettings | undefined>()
          Object.keys(status.uptodate.settings).forEach(u => {
            settingsMap.set(u, status.uptodate.settings[u])
          })
          s.botSettings = settingsMap
        }
      })
    },
    dismissBottomBanner: () => {
      set(s => {
        s.dismissedInviteBanners = true
      })
    },
    editBotSettings: (username, allowCommands, allowMentions, convs) => {
      const f = async () => {
        const conversationIDKey = get().id
        try {
          await RPCChatTypes.localSetBotMemberSettingsRpcPromise(
            {
              botSettings: {cmds: allowCommands, convs, mentions: allowMentions},
              convID: Types.keyToConversationID(conversationIDKey),
              username,
            },
            Common.waitingKeyBotAdd
          )
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info('addBotMember: failed to edit bot settings: ' + error.message)
          }
          return
        }
        closeBotModal()
      }
      Z.ignorePromise(f())
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
        const conversationIDKey = get().id
        const replyTo = Common.getReplyToMessageID(get().replyTo, getReduxState(), conversationIDKey)
        try {
          await RPCChatTypes.localTrackGiphySelectRpcPromise({result})
        } catch {}
        const url = new HiddenString(result.targetUrl)
        getConvoState(conversationIDKey).dispatch.setUnsentText('')
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
    refreshBotRoleInConv: username => {
      const f = async () => {
        const TeamsConstants = await import('../teams')
        let role: RPCTypes.TeamRole | undefined
        const conversationIDKey = get().id
        try {
          role = await RPCChatTypes.localGetTeamRoleInConversationRpcPromise({
            convID: Types.keyToConversationID(conversationIDKey),
            username,
          })
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info(`refreshBotRoleInConv: failed to refresh bot team role: ${error.message}`)
          }
          return
        }
        const trole = TeamsConstants.teamRoleByEnum[role]
        const r = !trole || trole === 'none' ? undefined : trole
        set(s => {
          const roles = s.botTeamRoleMap
          if (r !== undefined) {
            roles.set(username, r)
          } else {
            roles.delete(username)
          }
        })
      }
      Z.ignorePromise(f())
    },
    refreshBotSettings: username => {
      set(s => {
        s.botSettings.delete(username)
      })
      const conversationIDKey = get().id
      const f = async () => {
        try {
          const settings = await RPCChatTypes.localGetBotMemberSettingsRpcPromise({
            convID: Types.keyToConversationID(conversationIDKey),
            username,
          })
          set(s => {
            s.botSettings.set(username, settings)
          })
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info(`refreshBotSettings: failed to refresh settings for ${username}: ${error.message}`)
          }
          return
        }
      }
      Z.ignorePromise(f())
    },
    refreshMutualTeamsInConv: () => {
      const f = async () => {
        const ConfigConstants = await import('../config')
        const conversationIDKey = get().id
        const participantInfo = Common.getParticipantInfo(getReduxState(), conversationIDKey)
        const username = ConfigConstants.useCurrentUserState.getState().username
        const otherParticipants = Meta.getRowParticipants(participantInfo, username || '')
        const results = await RPCChatTypes.localGetMutualTeamsLocalRpcPromise(
          {usernames: otherParticipants},
          Common.waitingKeyMutualTeams(conversationIDKey)
        )
        set(s => {
          s.mutualTeams = results.teamIDs ?? []
        })
      }
      Z.ignorePromise(f())
    },
    removeBotMember: username => {
      const f = async () => {
        const convID = Types.keyToConversationID(get().id)
        try {
          await RPCChatTypes.localRemoveBotMemberRpcPromise({convID, username}, Common.waitingKeyBotRemove)
          closeBotModal()
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info('removeBotMember: failed to remove bot member: ' + error.message)
          }
        }
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
    setExplodingMode: (seconds, incoming) => {
      set(s => {
        s.explodingMode = seconds
      })
      if (incoming) return
      const conversationIDKey = get().id
      const f = async () => {
        logger.info(`Setting exploding mode for conversation ${conversationIDKey} to ${seconds}`)

        // unset a conversation exploding lock for this convo so we accept the new one
        get().dispatch.setExplodingModeLocked(false)

        const category = `${Common.explodingModeGregorKeyPrefix}${conversationIDKey}`
        // TODO remove redux
        const meta = Meta.getMeta(getReduxState(), conversationIDKey)
        const convRetention = Meta.getEffectiveRetentionPolicy(meta)
        if (seconds === 0 || seconds === convRetention.seconds) {
          // dismiss the category so we don't leave cruft in the push state
          await RPCTypes.gregorDismissCategoryRpcPromise({category})
        } else {
          // update the category with the exploding time
          try {
            await RPCTypes.gregorUpdateCategoryRpcPromise({
              body: seconds.toString(),
              category,
              dtime: {offset: 0, time: 0},
            })
            if (seconds !== 0) {
              logger.info(
                `Successfully set exploding mode for conversation ${conversationIDKey} to ${seconds}`
              )
            } else {
              logger.info(`Successfully unset exploding mode for conversation ${conversationIDKey}`)
            }
          } catch (error) {
            if (error instanceof RPCError) {
              if (seconds !== 0) {
                logger.error(
                  `Failed to set exploding mode for conversation ${conversationIDKey} to ${seconds}. Service responded with: ${error.message}`
                )
              } else {
                logger.error(
                  `Failed to unset exploding mode for conversation ${conversationIDKey}. Service responded with: ${error.message}`
                )
              }
              if (ignoreErrors.includes(error.code)) {
                return
              }
            }
            throw error
          }
        }
      }
      Z.ignorePromise(f())
    },
    setExplodingModeLocked: locked => {
      set(s => {
        s.explodingModeLock = locked ? get().explodingMode : undefined
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
        const conversationIDKey = get().id
        const {username, getLastOrdinal, devicename} = Message.getMessageStateExtras(
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
                  const message = Message.uiMessageToMessage(
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
                    const uiMsg = Message.uiMessageToMessage(
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
    getExplodingMode: (): number => {
      const mode = get().explodingModeLock ?? get().explodingMode
      const meta = Meta.getMeta(getReduxState(), get().id)
      const convRetention = Meta.getEffectiveRetentionPolicy(meta)
      return convRetention.type === 'explode' ? Math.min(mode || Infinity, convRetention.seconds) : mode
    },
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
