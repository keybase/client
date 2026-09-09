import * as Common from '@/constants/chat/common'
import * as Meta from '@/constants/chat/meta'
import * as React from 'react'
import * as Strings from '@/constants/strings'
import * as T from '@/constants/types'
import {getVisibleScreen, navigateAppend, navigateToThread, navigateUp, setChatRootParams} from '@/constants/router'
import {isPhone} from '@/constants/platform'
import logger from '@/logger'
import {findLast} from '@/util/arrays'
import {ignorePromise} from '@/constants/utils'
import {RPCError} from '@/util/errors'
import {useCurrentUserState} from '@/stores/current-user'
import {useConfigState} from '@/stores/config'
import {useShellState} from '@/stores/shell'
import {produce, type Draft} from 'immer'
import {useStore} from 'zustand'
import {createStore, type StoreApi} from 'zustand/vanilla'
import {useIsFocused} from '@react-navigation/core'
import {
  type ThreadLoadReconcile,
  addMessagesToThreadState,
  applyOptimisticReactionsToMessage,
  completeAttachmentDownloadInThreadState,
  clearOptimisticReactionsForUpdatesInThreadState,
  clearOptimisticReactionsForMessagesInThreadState,
  deleteMessagesFromThreadState,
  explodeMessagesInThreadState,
  failAttachmentDownloadInThreadState,
  finishAttachmentDownloadInThreadState,
  type OptimisticReaction,
  retryMessageInThreadState,
  setMessageSubmitStateInThreadState,
  setMessageErroredInThreadState,
  setAttachmentMobileSavingInThreadState,
  startAttachmentDownloadInThreadState,
  updateAttachmentDownloadProgressInThreadState,
  updateAttachmentUploadProgressInThreadState,
  updateReactionsInThreadState,
} from './thread-message-state'
import {getInboxConversationMeta, metasReceived, useInboxMetadataState} from '@/chat/inbox/metadata'
import {loadThreadMessageIDAtIndex, markConversationRead} from './thread-rpc'
import {
  cancelConversationPost,
  createAdhocConversation,
  dismissConversationJourneycardRPC,
  postConversationDelete,
  postConversationReaction,
} from './message-rpc'
import {cancelActiveThreadSearchRPC} from '../search-rpc'
import {
  emptyConversationMeta,
  getClientPrevFromSnapshot,
  getExplodingModeFromConfig,
  getMeta,
  persistExplodingMode,
} from './thread-load'
import {useThreadEngineListeners} from './thread-engine'

const sameStringSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => {
  if (a.size !== b.size) {
    return false
  }
  for (const value of a) {
    if (!b.has(value)) {
      return false
    }
  }
  return true
}

const formatTextForQuoting = (text: string) =>
  text
    .split('\n')
    .map(line => `> ${line}\n`)
    .join('')

const ConversationThreadIDContext = React.createContext<T.Chat.ConversationIDKey | undefined>(undefined)
ConversationThreadIDContext.displayName = 'ConversationThreadIDContext'

export type ConversationThreadState = {
  accountsInfoMap: Map<T.RPCChat.MessageID, T.Chat.ChatRequestInfo | T.Chat.ChatPaymentInfo>
  // The identity of the loaded window: bumped whenever the window is dropped (messagesClear) or the
  // conversation under it changes. Two things read it. thread-window refuses any response fetched
  // against an older generation, and the desktop list remounts on it - LegendList cannot recover
  // from a non-empty -> empty -> non-empty data transition (it resets its layout state and waits
  // for a container layout event that never comes), so the thread renders blank forever.
  generation: number
  explodingMode: number
  flipStatusMap: Map<string, T.RPCChat.UICoinFlipStatus>
  loaded: boolean
  liveUpdateVersion: number
  messageIDToOrdinal: Map<T.Chat.MessageID, T.Chat.Ordinal>
  messageMap: Map<T.Chat.Ordinal, T.Chat.Message>
  messageOrdinals?: ReadonlyArray<T.Chat.Ordinal>
  // Set between a messagesClear and the reload that refills the window, so a notification arriving
  // in that gap cannot install itself as the new window. thread-window decides which load may take
  // it down; see releaseWindowGate.
  windowCleared?: boolean
  messageTypeMap: Map<T.Chat.Ordinal, T.Chat.RenderMessageType>
  moreToLoadBack: boolean
  moreToLoadForward: boolean
  optimisticReactionMap: Map<T.Chat.OutboxID, OptimisticReaction>
  paymentStatusMap: Map<T.Wallets.PaymentID, T.Chat.ChatPaymentInfo>
  pendingOutboxToOrdinal: Map<T.Chat.OutboxID, T.Chat.Ordinal>
  typing: Set<string>
  unfurlPrompt: Map<T.Chat.MessageID, Set<string>>
}

export type ConversationThreadStore = StoreApi<ConversationThreadState>
const ConversationThreadStoreContext = React.createContext<ConversationThreadStore | undefined>(undefined)
ConversationThreadStoreContext.displayName = 'ConversationThreadStoreContext'

const makeEmptyThreadState = (): ConversationThreadState =>
  produce(
    {
      accountsInfoMap: new Map<T.RPCChat.MessageID, T.Chat.ChatRequestInfo | T.Chat.ChatPaymentInfo>(),
      generation: 0,
      explodingMode: 0,
      flipStatusMap: new Map<string, T.RPCChat.UICoinFlipStatus>(),
      liveUpdateVersion: 0,
      loaded: false,
      messageIDToOrdinal: new Map<T.Chat.MessageID, T.Chat.Ordinal>(),
      messageMap: new Map<T.Chat.Ordinal, T.Chat.Message>(),
      messageOrdinals: undefined as ReadonlyArray<T.Chat.Ordinal> | undefined,
      messageTypeMap: new Map<T.Chat.Ordinal, T.Chat.RenderMessageType>(),
      moreToLoadBack: false,
      moreToLoadForward: false,
      optimisticReactionMap: new Map<T.Chat.OutboxID, OptimisticReaction>(),
      paymentStatusMap: new Map<T.Wallets.PaymentID, T.Chat.ChatPaymentInfo>(),
      pendingOutboxToOrdinal: new Map<T.Chat.OutboxID, T.Chat.Ordinal>(),
      typing: new Set<string>(),
      unfurlPrompt: new Map<T.Chat.MessageID, Set<string>>(),
    },
    () => {}
  )

const makeInitialThreadState = (id: T.Chat.ConversationIDKey) => {
  return produce(makeEmptyThreadState(), s => {
    s.explodingMode = getExplodingModeFromConfig(id)
  })
}

const makeThreadStore = (id: T.Chat.ConversationIDKey) =>
  createStore<ConversationThreadState>(() => makeInitialThreadState(id))

export type ScrollDirection = 'none' | 'back' | 'forward'
export type ConversationThreadActions = {
  addMessages: (
    messages: ReadonlyArray<T.Chat.Message>,
    opt?: {
      liveUpdate?: boolean
      markAsRead?: boolean
    }
  ) => void
  applyThreadLoad: (p: {
    centered: boolean
    disableActiveMarkRead?: boolean
    enableActiveMarkRead: boolean
    messages: ReadonlyArray<T.Chat.Message>
    moreToLoad: boolean
    reconcile?: ThreadLoadReconcile
    scrollDirection: ScrollDirection
  }) => void
  bumpWindowGeneration: () => void
  clearUnfurlPrompt: (messageID: T.Chat.MessageID, domain: string) => void
  deleteMessages: (p: {
    messageIDs?: ReadonlyArray<T.Chat.MessageID>
    upToMessageID?: T.Chat.MessageID
    deletableMessageTypes?: ReadonlySet<T.Chat.MessageType>
    ordinals?: ReadonlyArray<T.Chat.Ordinal>
    liveUpdate?: boolean
  }) => void
  explodeMessages: (
    messageIDs: ReadonlyArray<T.Chat.MessageID>,
    explodedBy?: string,
    liveUpdate?: boolean
  ) => void
  getSnapshot: () => ConversationThreadState
  markThreadAsRead: () => void
  setMarkReadBlocked: (blocked: boolean) => void
  messageDelete: (ordinal: T.Chat.Ordinal) => void
  messageReplyPrivately: (ordinal: T.Chat.Ordinal) => void
  messagesClear: () => void
  receivePaymentInfo: (messageID: T.Chat.MessageID, paymentInfo: T.Chat.ChatPaymentInfo) => void
  receiveRequestInfo: (messageID: T.Chat.MessageID, requestInfo: T.Chat.ChatRequestInfo) => void
  releaseWindowGate: () => void
  retryMessage: (outboxID: T.Chat.OutboxID) => void
  setExplodingMode: (seconds: number, incoming?: boolean) => void
  setMessageErrored: (outboxID: T.Chat.OutboxID, reason: string, errorTyp?: number) => void
  setMessageSubmitState: (ordinal: T.Chat.Ordinal, submitState: T.Chat.Message['submitState']) => void
  setMarkAsUnread: (readMsgID?: T.Chat.MessageID | false) => void
  setTyping: (typing: ReadonlySet<string>) => void
  showUnfurlPrompt: (messageID: T.Chat.MessageID, domain: string) => void
  addOptimisticReaction: (outboxID: T.Chat.OutboxID, reaction: OptimisticReaction) => void
  removeOptimisticReaction: (outboxID: T.Chat.OutboxID) => void
  updateOptimisticReactionDecorated: (outboxID: T.Chat.OutboxID, decorated: string) => void
  toggleMessageCollapse: (messageID: T.Chat.MessageID, ordinal: T.Chat.Ordinal) => void
  toggleMessageReaction: (ordinal: T.Chat.Ordinal, emoji: string) => void
  unfurlRemove: (messageID: T.Chat.MessageID) => void
  updateReactions: (
    updates: ReadonlyArray<{targetMsgID: T.Chat.MessageID; reactions?: T.Chat.Reactions}>
  ) => void
  updateCoinFlipStatuses: (statuses: ReadonlyArray<T.RPCChat.UICoinFlipStatus>) => void
  startAttachmentDownload: (ordinal: T.Chat.Ordinal) => void
  finishAttachmentDownload: (ordinal: T.Chat.Ordinal, path: string) => void
  failAttachmentDownload: (ordinal: T.Chat.Ordinal, errMsg: string) => void
  setAttachmentMobileSaving: (ordinal: T.Chat.Ordinal, saving: boolean) => void
  updateAttachmentDownloadProgress: (msgID: number, bytesComplete: number, bytesTotal: number) => void
  completeAttachmentDownload: (msgID: number) => void
  updateAttachmentUploadProgress: (
    outboxID: Uint8Array,
    bytesComplete?: number,
    bytesTotal?: number
  ) => void
}

const ConversationThreadActionsContext = React.createContext<ConversationThreadActions | undefined>(
  undefined
)
ConversationThreadActionsContext.displayName = 'ConversationThreadActionsContext'

export const useConversationThreadID = () => {
  const conversationIDKey = React.useContext(ConversationThreadIDContext)
  if (!conversationIDKey) {
    throw new Error('Missing ConversationThreadProvider in the tree')
  }
  return conversationIDKey
}

export const useConversationThreadActions = () => {
  const actions = React.useContext(ConversationThreadActionsContext)
  if (!actions) {
    throw new Error('Missing ConversationThreadProvider actions in the tree')
  }
  return actions
}

export const useConversationThreadSelector = <TValue,>(
  selector: (snapshot: ConversationThreadState) => TValue
) => {
  const store = React.useContext(ConversationThreadStoreContext)
  if (!store) {
    throw new Error('Missing ConversationThreadProvider state in the tree')
  }
  return useStore(store, selector)
}

export const useConversationThreadStore = () => {
  const store = React.useContext(ConversationThreadStoreContext)
  if (!store) {
    throw new Error('Missing ConversationThreadProvider state in the tree')
  }
  return store
}

// Reads the meta for the current thread from its single owner (the inbox metadata
// store). Pass a narrow selector (wrap object results in C.useShallow) so render-hot
// callers don't re-render on unrelated meta churn (e.g. draft updates).
export const useThreadMeta = <TValue,>(
  selector: (meta: T.Immutable<T.Chat.ConversationMeta>) => TValue
): TValue => {
  const id = useConversationThreadID()
  return useInboxMetadataState(s => selector(s.metas.get(id) ?? emptyConversationMeta))
}

type ConversationThreadProviderProps = React.PropsWithChildren<{
  id: T.Chat.ConversationIDKey
}>

const ConversationThreadContextProvider = (p: {
  actions: ConversationThreadActions
  children: React.ReactNode
  id: T.Chat.ConversationIDKey
  store: ConversationThreadStore
}) => (
  <ConversationThreadIDContext value={p.id}>
    <ConversationThreadActionsContext value={p.actions}>
      <ConversationThreadStoreContext value={p.store}>{p.children}</ConversationThreadStoreContext>
    </ConversationThreadActionsContext>
  </ConversationThreadIDContext>
)

const ConversationThreadProviderInner = (p: ConversationThreadProviderProps) => {
  const {children, id} = p
  const [threadStore] = React.useState(() => makeThreadStore(id))
  const active = useShellState(s => s.active)
  const appFocused = useShellState(s => s.appFocused)
  const routeFocused = useIsFocused()
  // Mark-read attempts bail while we're not looking at the thread (backgrounded,
  // covered by another route, or idle on desktop), so re-fire when any of those
  // gates reopen. On mobile `active` never changes; appFocused/routeFocused are
  // the only signals that we came back.
  const lookingAtThread = active && appFocused && routeFocused
  const previousLookingAtThreadRef = React.useRef(lookingAtThread)
  const activeMarkReadEnabledRef = React.useRef(false)
  const markReadBlockedRef = React.useRef(false)

  const getSnapshot = React.useEffectEvent(() => threadStore.getState())
  const updateThreadState = React.useEffectEvent(
    (updater: (draft: Draft<ConversationThreadState>) => void) => {
      const current = threadStore.getState()
      const next = produce(current, draft => updater(draft))
      if (current === next) {
        return
      }
      threadStore.setState(next, true)
    }
  )
  const markThreadAsRead = React.useEffectEvent(() => {
    const f = async () => {
      if (!useConfigState.getState().loggedIn) {
        logger.info('mark read bail on not logged in')
        return
      }
      if (!T.Chat.isValidConversationIDKey(id)) {
        logger.info('mark read bail on no selected conversation')
        return
      }
      if (!activeMarkReadEnabledRef.current) {
        logger.info('mark read bail on no eligible thread load')
        return
      }
      if (markReadBlockedRef.current) {
        logger.info('mark read bail on blocked thread load')
        return
      }
      if (!appFocused || !active || !routeFocused) {
        logger.info('mark read bail on not looking at this thread')
        return
      }
      const snapshot = getSnapshot()
      if (!snapshot.loaded) {
        logger.info('mark read bail on unloaded thread')
        return
      }
      // Marking read overwrites the read position, so it must not run before we know what that
      // position was. An unlocalized conversation reads -1, which a db nuke makes the norm, and
      // localization races the thread load - mark-read needs neither, it reads the newest message
      // out of the window. If it wins that race the true read position is gone before useOrangeLine
      // ever sees it, localization then lands already advanced, and the thread shows no unread
      // divider at all. Wait for localization; the effect below runs this again once it lands.
      if ((getInboxConversationMeta(id)?.readMsgID ?? T.Chat.numberToMessageID(-1)) < 0) {
        logger.info('mark read bail on unlocalized conversation')
        return
      }
      if (snapshot.moreToLoadForward) {
        logger.info('mark read bail on not containing latest message')
        return
      }
      const ordinal = findLast([...(snapshot.messageOrdinals ?? [])], (o: T.Chat.Ordinal) => {
        const m = snapshot.messageMap.get(o)
        return m ? !!m.id : false
      })
      const message = ordinal ? snapshot.messageMap.get(ordinal) : undefined
      const readMsgID = message?.id
      if (!readMsgID) {
        logger.info(`marking read messages ${id} failed due to no id`)
        return
      }
      if (readMsgID === getInboxConversationMeta(id)?.readMsgID) {
        logger.info(`marking read messages is noop bail: ${id} ${readMsgID}`)
        return
      }
      logger.info(`marking read messages ${id} ${readMsgID}`)
      await markConversationRead({conversationIDKey: id, forceUnread: false, msgID: readMsgID})
    }
    ignorePromise(f())
  })
  React.useEffect(() => {
    const wasLookingAtThread = previousLookingAtThreadRef.current
    previousLookingAtThreadRef.current = lookingAtThread
    if (!wasLookingAtThread && lookingAtThread && activeMarkReadEnabledRef.current) {
      markThreadAsRead()
    }
  }, [lookingAtThread])
  // The other half of the unlocalized bail above: whatever mark-read attempt was refused for want of
  // a read position, run it again now that there is one. Only on the transition, so an ordinary
  // mark-read moving readMsgID does not bounce back through here.
  //
  // Safe against the orange line: useOrangeLine latches the read position into state on the commit
  // localization lands in, so the position it later asks the unreadline about does not depend on
  // beating this mark-read to it.
  const metaReadMsgID = useInboxMetadataState(
    s => (s.metas.get(id) ?? emptyConversationMeta).readMsgID
  )
  const wasUnlocalizedRef = React.useRef(metaReadMsgID < 0)
  React.useEffect(() => {
    const wasUnlocalized = wasUnlocalizedRef.current
    wasUnlocalizedRef.current = metaReadMsgID < 0
    if (wasUnlocalized && metaReadMsgID >= 0) {
      markThreadAsRead()
    }
  }, [metaReadMsgID])
  const addMessages = React.useEffectEvent(
    (
      messages: ReadonlyArray<T.Chat.Message>,
      opt: {
        liveUpdate?: boolean
        markAsRead?: boolean
      } = {}
    ) => {
      updateThreadState(s => {
        if (opt.liveUpdate) {
          s.liveUpdateVersion += 1
        }
        addMessagesToThreadState(s, messages, {
          // Only thread loads may extend the window downward; a notification must not.
          dropNewBelowWindow: true,
        })
        clearOptimisticReactionsForMessagesInThreadState(s, messages)
      })
      if (opt.markAsRead) {
        markThreadAsRead()
      }
    }
  )
  const setMarkReadBlocked = React.useEffectEvent((blocked: boolean) => {
    markReadBlockedRef.current = blocked
    if (blocked) {
      activeMarkReadEnabledRef.current = false
    }
  })
  const applyThreadLoad = React.useEffectEvent(
    (p: {
      centered: boolean
      disableActiveMarkRead?: boolean
      enableActiveMarkRead: boolean
      messages: ReadonlyArray<T.Chat.Message>
      moreToLoad: boolean
      reconcile?: ThreadLoadReconcile
      scrollDirection: ScrollDirection
    }) => {
      updateThreadState(s => {
        s.loaded = true
        // The reconciling pass runs even with nothing to add: the warm reload where nothing changed
        // answers with an empty full pass, and the span its earlier pass covered is authoritative
        // all the same - the stale rows inside it are exactly what the prune is for. A pass with
        // neither is skipped rather than passed through: addMessagesToThreadState always leaves a
        // messageOrdinals array behind, and an empty one reads as a loaded, empty thread - the top
        // of the conversation renders against it and then swaps when the real page arrives.
        if (p.messages.length || p.reconcile?.prune) {
          addMessagesToThreadState(s, p.messages, {reconcile: p.reconcile})
          clearOptimisticReactionsForMessagesInThreadState(s, p.messages)
        }
        switch (p.scrollDirection) {
          case 'forward':
            s.moreToLoadForward = p.moreToLoad
            break
          case 'back':
            s.moreToLoadBack = p.moreToLoad
            break
          case 'none': {
            s.moreToLoadBack = p.moreToLoad
            // A centered window may already include the latest message; leaving
            // moreToLoadForward true would drop live incoming messages and block mark-read.
            let containsLatest = false
            if (p.centered) {
              const {maxVisibleMsgID} = getMeta(id)
              const ordinal = findLast(s.messageOrdinals ?? [], o => !!s.messageMap.get(o)?.id)
              const message = ordinal ? s.messageMap.get(ordinal) : undefined
              containsLatest = !!message?.id && maxVisibleMsgID > 0 && message.id >= maxVisibleMsgID
            }
            s.moreToLoadForward = p.centered && !containsLatest
            break
          }
        }
      })
      if (p.scrollDirection === 'forward' && !p.moreToLoad) {
        // User scrolled all the way to the latest message; release any mark-read
        // block left from jumping to a highlighted message.
        markReadBlockedRef.current = false
      }
      if (p.disableActiveMarkRead) {
        activeMarkReadEnabledRef.current = false
      } else if (p.enableActiveMarkRead && !markReadBlockedRef.current) {
        activeMarkReadEnabledRef.current = true
      }
    }
  )
  const deleteMessages = React.useEffectEvent(
    (p: {
      messageIDs?: ReadonlyArray<T.Chat.MessageID>
      upToMessageID?: T.Chat.MessageID
      deletableMessageTypes?: ReadonlySet<T.Chat.MessageType>
      ordinals?: ReadonlyArray<T.Chat.Ordinal>
      liveUpdate?: boolean
    }) => {
      updateThreadState(s => {
        if (p.liveUpdate) {
          s.liveUpdateVersion += 1
        }
        deleteMessagesFromThreadState(s, {
          deletableMessageTypes: p.deletableMessageTypes ?? Common.allMessageTypes,
          messageIDs: p.messageIDs,
          ordinals: p.ordinals,
          upToMessageID: p.upToMessageID,
        })
      })
    }
  )
  const explodeMessages = React.useEffectEvent(
    (messageIDs: ReadonlyArray<T.Chat.MessageID>, explodedBy?: string, liveUpdate?: boolean) => {
      updateThreadState(s => {
        if (liveUpdate) {
          s.liveUpdateVersion += 1
        }
        explodeMessagesInThreadState(s, messageIDs, explodedBy)
      })
    }
  )
  const setMessageErrored = React.useEffectEvent(
    (outboxID: T.Chat.OutboxID, reason: string, errorTyp?: number) => {
      updateThreadState(s => {
        setMessageErroredInThreadState(s, outboxID, reason, errorTyp)
      })
    }
  )
  const retryMessage = React.useEffectEvent((outboxID: T.Chat.OutboxID) => {
    updateThreadState(s => {
      retryMessageInThreadState(s, outboxID)
    })
    ignorePromise(
      (async () => {
        await T.RPCChat.localRetryPostRpcPromise({outboxID: T.Chat.outboxIDToRpcOutboxID(outboxID)})
      })()
    )
  })
  const setExplodingMode = React.useEffectEvent((seconds: number, incoming?: boolean) => {
    updateThreadState(s => {
      s.explodingMode = seconds
    })
    if (!incoming) {
      persistExplodingMode(id, getMeta(id), seconds)
    }
  })
  const setMarkAsUnread = React.useEffectEvent((readMsgID?: T.Chat.MessageID | false) => {
    if (readMsgID === false) {
      return
    }
    const f = async () => {
      if (!useConfigState.getState().loggedIn) {
        logger.info('mark unread bail on not logged in')
        return
      }
      const snapshot = getSnapshot()
      const unreadLineID = readMsgID ? readMsgID : getMeta(id).maxVisibleMsgID
      let msgID = unreadLineID

      if (snapshot.messageMap.size) {
        const ord =
          snapshot.messageOrdinals &&
          findLast(snapshot.messageOrdinals, o => {
            const message = snapshot.messageMap.get(o)
            return !!(message && message.id < unreadLineID)
          })
        const message = ord ? snapshot.messageMap.get(ord) : undefined
        if (message) {
          msgID = message.id
        }
      } else {
        try {
          const loadedMsgID = await loadThreadMessageIDAtIndex(id, 1)
          if (loadedMsgID) {
            msgID = loadedMsgID
          }
        } catch {}
      }

      if (!msgID) {
        logger.info(`marking unread messages ${id} failed due to no id`)
        return
      }

      logger.info(`marking unread messages ${id} ${msgID}`)
      await markConversationRead({conversationIDKey: id, forceUnread: true, msgID})
    }
    ignorePromise(f())
  })
  const messageDelete = React.useEffectEvent((ordinal: T.Chat.Ordinal) => {
    updateThreadState(s => {
      const m = s.messageMap.get(ordinal)
      if (m?.type === 'text') {
        m.submitState = 'deleting'
      }
    })
    const revertDeleting = () => {
      updateThreadState(s => {
        const m = s.messageMap.get(ordinal)
        if (m?.type === 'text' && m.submitState === 'deleting') {
          m.submitState = undefined
        }
      })
    }

    const f = async () => {
      const snapshot = getSnapshot()
      const message = snapshot.messageMap.get(ordinal)
      if (!message) {
        logger.warn('Deleting invalid message')
        revertDeleting()
        return
      }
      if (!getInboxConversationMeta(id)) {
        logger.warn('Deleting message w/ no meta')
        revertDeleting()
        return
      }
      try {
        if (!message.id) {
          if (message.outboxID) {
            await cancelConversationPost(message.outboxID)
            deleteMessages({ordinals: [message.ordinal]})
          } else {
            logger.warn('Delete of no message id and no outboxid')
            revertDeleting()
          }
          return
        }
        await postConversationDelete({
          conversationIDKey: id,
          messageID: message.id,
          tlfName: getMeta(id).tlfname,
        })
      } catch (error) {
        revertDeleting()
        if (error instanceof RPCError) {
          logger.warn(`messageDelete: failed to delete: ${error.message}`)
        } else {
          throw error
        }
      }
    }
    ignorePromise(f())
  })
  const messageReplyPrivately = React.useEffectEvent((ordinal: T.Chat.Ordinal) => {
    const f = async () => {
      const message = getSnapshot().messageMap.get(ordinal)
      if (!message) {
        logger.warn("messageReplyPrivately: can't find message to reply to", ordinal)
        return
      }
      const username = useCurrentUserState.getState().username
      if (!username) {
        throw new Error('messageReplyPrivately: making a convo while logged out?')
      }
      const result = await createAdhocConversation([username, message.author], Strings.waitingKeyChatCreating)
      const newThreadCID = T.Chat.conversationIDToKey(result.conv.info.id)
      if (!newThreadCID) {
        logger.warn("messageReplyPrivately: couldn't make a new conversation?")
        return
      }
      const meta = Meta.inboxUIItemToConversationMeta(result.uiConv)
      if (!meta) {
        logger.warn('messageReplyPrivately: unable to make meta')
        return
      }
      if (message.type !== 'text') {
        return
      }

      const text = formatTextForQuoting(message.text.stringValue())
      metasReceived([meta])
      navigateToThread(newThreadCID, 'createdMessagePrivately', {intent: {text, type: 'injectText'}})
    }
    ignorePromise(f())
  })
  const addOptimisticReaction = React.useEffectEvent(
    (outboxID: T.Chat.OutboxID, reaction: OptimisticReaction) => {
      updateThreadState(s => {
        s.optimisticReactionMap.set(outboxID, reaction)
      })
    }
  )
  const removeOptimisticReaction = React.useEffectEvent((outboxID: T.Chat.OutboxID) => {
    updateThreadState(s => {
      s.optimisticReactionMap.delete(outboxID)
    })
  })
  const updateOptimisticReactionDecorated = React.useEffectEvent(
    (outboxID: T.Chat.OutboxID, decorated: string) => {
      updateThreadState(s => {
        const reaction = s.optimisticReactionMap.get(outboxID)
        if (reaction) {
          s.optimisticReactionMap.set(outboxID, {...reaction, decorated})
        }
      })
    }
  )
  const toggleMessageCollapse = React.useEffectEvent(
    (messageID: T.Chat.MessageID, ordinal: T.Chat.Ordinal) => {
      const f = async () => {
        const snapshot = getSnapshot()
        const m = snapshot.messageMap.get(ordinal)
        let isCollapsed = false

        if (T.Chat.messageIDToNumber(messageID) !== T.Chat.ordinalToNumber(ordinal)) {
          const unfurlInfos = [...(m?.unfurls?.values() ?? [])]
          const ui = unfurlInfos.find(u => u.unfurlMessageID === messageID)
          if (ui) {
            isCollapsed = ui.isCollapsed
          }
        } else {
          isCollapsed = m?.isCollapsed ?? false
        }
        await T.RPCChat.localToggleMessageCollapseRpcPromise({
          collapse: !isCollapsed,
          convID: T.Chat.keyToConversationID(id),
          msgID: messageID,
        })
      }
      ignorePromise(f())
    }
  )
  const toggleMessageReaction = React.useEffectEvent((ordinal: T.Chat.Ordinal, emoji: string) => {
    const f = async () => {
      if (!emoji) {
        return
      }
      const snapshot = getSnapshot()
      const message = snapshot.messageMap.get(ordinal)
      if (!message) {
        logger.warn(`toggleMessageReaction: no message found`)
        return
      }
      const {type, exploded, id: messageID} = message
      if ((type === 'text' || type === 'attachment') && exploded) {
        logger.warn(`toggleMessageReaction: message is exploded`)
        return
      }
      if (!messageID) {
        logger.warn(`toggleMessageReaction: message has no id yet`)
        return
      }
      const username = useCurrentUserState.getState().username
      if (!username) {
        logger.warn(`toggleMessageReaction: no current username`)
        return
      }
      const displayMessage = applyOptimisticReactionsToMessage(message, snapshot.optimisticReactionMap)
      const add =
        !displayMessage?.reactions?.get(emoji)?.users.some(reaction => reaction.username === username)
      const outboxID = Common.generateOutboxID()
      const localOutboxID = T.Chat.rpcOutboxIDToOutboxID(outboxID)
      addOptimisticReaction(localOutboxID, {
        add,
        decorated: emoji,
        emoji,
        targetOrdinal: ordinal,
        timestamp: Date.now(),
        username,
      })
      try {
        await postConversationReaction({
          body: emoji,
          clientPrev: getClientPrevFromSnapshot(snapshot),
          conversationIDKey: id,
          messageID,
          outboxID,
          tlfName: getMeta(id).tlfname,
        })
      } catch (error) {
        removeOptimisticReaction(localOutboxID)
        if (error instanceof RPCError) {
          logger.info(`toggleMessageReaction: failed to post` + error.message)
        }
      }
    }
    ignorePromise(f())
  })
  const unfurlRemove = React.useEffectEvent((messageID: T.Chat.MessageID) => {
    const f = async () => {
      if (!getInboxConversationMeta(id)) {
        logger.debug('unfurl remove no meta found, aborting!')
        return
      }
      await postConversationDelete({
        conversationIDKey: id,
        messageID,
        tlfName: getMeta(id).tlfname,
      })
    }
    ignorePromise(f())
  })
  const setMessageSubmitState = React.useEffectEvent(
    (ordinal: T.Chat.Ordinal, submitState: T.Chat.Message['submitState']) => {
      updateThreadState(s => {
        setMessageSubmitStateInThreadState(s, ordinal, submitState)
      })
    }
  )
  const updateReactions = React.useEffectEvent(
    (updates: ReadonlyArray<{targetMsgID: T.Chat.MessageID; reactions?: T.Chat.Reactions}>) => {
      const missingTargetMsgIDs = new Array<T.Chat.MessageID>()
      updateThreadState(s => {
        missingTargetMsgIDs.push(...updateReactionsInThreadState(s, updates))
        if (missingTargetMsgIDs.length !== updates.length) {
          s.liveUpdateVersion += 1
        }
        clearOptimisticReactionsForUpdatesInThreadState(s, updates)
      })
      for (const targetMsgID of missingTargetMsgIDs) {
        logger.info(
          `updateReactions: couldn't find target ordinal for targetMsgID=${targetMsgID} in convID=${id}`
        )
      }
      markThreadAsRead()
    }
  )
  // Which load may take the gate down is thread-window's decision; this only performs it.
  const releaseWindowGate = React.useEffectEvent(() => {
    updateThreadState(d => {
      d.windowCleared = false
    })
  })
  const bumpWindowGeneration = React.useEffectEvent(() => {
    updateThreadState(d => {
      d.generation += 1
    })
  })
  const messagesClear = React.useEffectEvent(() => {
    activeMarkReadEnabledRef.current = false
    updateThreadState(s => {
      s.generation += 1
      s.pendingOutboxToOrdinal.clear()
      s.loaded = false
      // Mark the gap. A notification landing between here and the reload would otherwise face an
      // empty window, install itself as the whole of it, and strand once the load response arrives.
      // Both callers reload a region disjoint from the one being dropped - a centered jump an
      // arbitrary one, jumpToRecent the newest page - so nothing arriving first can be placed
      // against what is coming.
      s.windowCleared = true
      s.messageIDToOrdinal.clear()
      s.messageMap.clear()
      s.messageOrdinals = undefined
      s.messageTypeMap.clear()
      s.optimisticReactionMap.clear()
    })
  })
  const setTyping = React.useEffectEvent((typing: ReadonlySet<string>) => {
    updateThreadState(s => {
      if (sameStringSet(s.typing, typing)) {
        return
      }
      s.typing = new Set(typing)
    })
  })
  const receiveRequestInfo = React.useEffectEvent(
    (messageID: T.Chat.MessageID, requestInfo: T.Chat.ChatRequestInfo) => {
      updateThreadState(s => {
        s.accountsInfoMap.set(messageID, requestInfo)
      })
    }
  )
  const receivePaymentInfo = React.useEffectEvent(
    (messageID: T.Chat.MessageID, paymentInfo: T.Chat.ChatPaymentInfo) => {
      updateThreadState(s => {
        s.accountsInfoMap.set(messageID, paymentInfo)
        s.paymentStatusMap.set(paymentInfo.paymentID, paymentInfo)
      })
    }
  )
  const showUnfurlPrompt = React.useEffectEvent((messageID: T.Chat.MessageID, domain: string) => {
    updateThreadState(s => {
      let prompts = s.unfurlPrompt.get(messageID)
      if (!prompts) {
        prompts = new Set()
        s.unfurlPrompt.set(messageID, prompts)
      }
      prompts.add(domain)
    })
  })
  const clearUnfurlPrompt = React.useEffectEvent((messageID: T.Chat.MessageID, domain: string) => {
    updateThreadState(s => {
      const prompts = s.unfurlPrompt.get(messageID)
      prompts?.delete(domain)
    })
  })
  const updateCoinFlipStatuses = React.useEffectEvent(
    (statuses: ReadonlyArray<T.RPCChat.UICoinFlipStatus>) => {
      updateThreadState(s => {
        statuses.forEach(status => {
          s.flipStatusMap.set(status.gameID, T.castDraft(status))
        })
      })
    }
  )
  const updateAttachmentDownloadProgress = React.useEffectEvent(
    (msgID: number, bytesComplete: number, bytesTotal: number) => {
      updateThreadState(s => {
        updateAttachmentDownloadProgressInThreadState(s, msgID, bytesComplete, bytesTotal)
      })
    }
  )
  const completeAttachmentDownload = React.useEffectEvent((msgID: number) => {
    updateThreadState(s => {
      completeAttachmentDownloadInThreadState(s, msgID)
    })
  })
  const startAttachmentDownload = React.useEffectEvent((ordinal: T.Chat.Ordinal) => {
    updateThreadState(s => {
      startAttachmentDownloadInThreadState(s, ordinal)
    })
  })
  const finishAttachmentDownload = React.useEffectEvent((ordinal: T.Chat.Ordinal, path: string) => {
    updateThreadState(s => {
      finishAttachmentDownloadInThreadState(s, ordinal, path)
    })
  })
  const failAttachmentDownload = React.useEffectEvent((ordinal: T.Chat.Ordinal, errMsg: string) => {
    updateThreadState(s => {
      failAttachmentDownloadInThreadState(s, ordinal, errMsg)
    })
  })
  const setAttachmentMobileSaving = React.useEffectEvent(
    (ordinal: T.Chat.Ordinal, saving: boolean) => {
      updateThreadState(s => {
        setAttachmentMobileSavingInThreadState(s, ordinal, saving)
      })
    }
  )
  const updateAttachmentUploadProgress = React.useEffectEvent(
    (outboxID: Uint8Array, bytesComplete?: number, bytesTotal?: number) => {
      updateThreadState(s => {
        updateAttachmentUploadProgressInThreadState(s, outboxID, bytesComplete, bytesTotal)
      })
    }
  )
  const [threadActions] = React.useState<ConversationThreadActions>(() => {
    const threadActions: ConversationThreadActions = {
      addMessages,
      addOptimisticReaction,
      applyThreadLoad,
      bumpWindowGeneration,
      clearUnfurlPrompt,
      completeAttachmentDownload,
      deleteMessages,
      explodeMessages,
      failAttachmentDownload,
      finishAttachmentDownload,
      getSnapshot,
      markThreadAsRead,
      messageDelete,
      messageReplyPrivately,
      messagesClear,
      receivePaymentInfo,
      receiveRequestInfo,
      releaseWindowGate,
      removeOptimisticReaction,
      retryMessage,
      setAttachmentMobileSaving,
      setExplodingMode,
      setMarkAsUnread,
      setMarkReadBlocked,
      setMessageErrored,
      setMessageSubmitState,
      setTyping,
      showUnfurlPrompt,
      startAttachmentDownload,
      toggleMessageCollapse,
      toggleMessageReaction,
      unfurlRemove,
      updateAttachmentDownloadProgress,
      updateAttachmentUploadProgress,
      updateCoinFlipStatuses,
      updateOptimisticReactionDecorated,
      updateReactions,
    }
    return threadActions
  })
  useThreadEngineListeners(id, threadActions)

  return (
    <ConversationThreadContextProvider id={id} actions={threadActions} store={threadStore}>
      {children}
    </ConversationThreadContextProvider>
  )
}

export const ConversationThreadProvider = (p: ConversationThreadProviderProps) => {
  const currentConversationIDKey = React.useContext(ConversationThreadIDContext)
  const currentActions = React.useContext(ConversationThreadActionsContext)
  const currentStore = React.useContext(ConversationThreadStoreContext)
  if (currentConversationIDKey === p.id && currentActions && currentStore) {
    // Same-thread wrappers should share the live message/meta state instead of replacing it.
    return <>{p.children}</>
  }
  return <ConversationThreadProviderInner {...p} />
}

export const LiveConversationThreadProvider = (p: ConversationThreadProviderProps) => (
  <ConversationThreadProviderInner {...p} />
)

export const useConversationThreadSetExplodingMode = () => useConversationThreadActions().setExplodingMode

const displayMessageCache = new WeakMap<
  T.Chat.Message,
  {
    displayMessage: T.Chat.Message | undefined
    optimisticReactionMap: ConversationThreadState['optimisticReactionMap']
  }
>()

export const getConversationThreadDisplayMessage = (
  snapshot: ConversationThreadState,
  ordinal: T.Chat.Ordinal
) => {
  const message = snapshot.messageMap.get(ordinal)
  if (!message) {
    return undefined
  }
  const cached = displayMessageCache.get(message)
  if (cached?.optimisticReactionMap === snapshot.optimisticReactionMap) {
    return cached.displayMessage
  }
  const displayMessage = applyOptimisticReactionsToMessage(message, snapshot.optimisticReactionMap)
  displayMessageCache.set(message, {displayMessage, optimisticReactionMap: snapshot.optimisticReactionMap})
  return displayMessage
}

export const useConversationThreadMessage = (ordinal: T.Chat.Ordinal) =>
  useConversationThreadSelector(snapshot => getConversationThreadDisplayMessage(snapshot, ordinal))

export const useConversationThreadMarkThreadAsRead = () => useConversationThreadActions().markThreadAsRead

export const useConversationThreadSetMarkAsUnread = () => useConversationThreadActions().setMarkAsUnread

export const useConversationThreadSetMarkReadBlocked = () => useConversationThreadActions().setMarkReadBlocked

export const useConversationThreadMessageActions = () => {
  const {messageDelete, messageReplyPrivately, toggleMessageCollapse, toggleMessageReaction, unfurlRemove} =
    useConversationThreadActions()
  return {messageDelete, messageReplyPrivately, toggleMessageCollapse, toggleMessageReaction, unfurlRemove}
}

export const useConversationThreadToggleSearch = () => {
  const conversationIDKey = useConversationThreadID()
  return (hide?: boolean, query?: string) => {
    toggleConversationThreadSearch(conversationIDKey, hide, query)
  }
}

export const toggleConversationThreadSearch = (
  conversationIDKey: T.Chat.ConversationIDKey,
  hide?: boolean,
  query?: string
) => {
  const visible = getVisibleScreen()
  const params = visible?.params as
    | {conversationIDKey?: T.Chat.ConversationIDKey; threadSearch?: {query?: string}}
    | undefined
  const nextVisible = hide !== undefined ? !hide : !params?.threadSearch

  const threadSearch = nextVisible ? (query ? {query} : {}) : undefined
  if (Common.isSplit) {
    setChatRootParams({conversationIDKey, threadSearch})
  } else {
    navigateAppend({name: Common.threadRouteName, params: {conversationIDKey, threadSearch}}, true)
  }

  const f = async () => {
    if (!nextVisible) {
      await cancelActiveThreadSearchRPC()
    }
  }
  ignorePromise(f())
}

export type ConversationInfoPanelTab = 'settings' | 'members' | 'attachments' | 'bots' | undefined

export const showConversationInfoPanel = (
  conversationIDKey: T.Chat.ConversationIDKey,
  show: boolean,
  tab: ConversationInfoPanelTab
) => {
  if (isPhone) {
    const visibleScreen = getVisibleScreen()
    if (show) {
      navigateAppend(
        {
          name: 'chatInfoPanel',
          params: {conversationIDKey, tab},
        },
        visibleScreen?.name === 'chatInfoPanel'
      )
    } else if (visibleScreen?.name === 'chatInfoPanel') {
      navigateUp()
    }
    return
  }
  setChatRootParams({conversationIDKey, infoPanel: show ? {tab} : undefined})
}

export const useConversationShowInfoPanel = () => {
  const conversationIDKey = useConversationThreadID()
  return (show: boolean, tab: ConversationInfoPanelTab) => {
    showConversationInfoPanel(conversationIDKey, show, tab)
  }
}

export const useConversationThreadDismissJourneycard = () => {
  const conversationIDKey = useConversationThreadID()
  const {deleteMessages} = useConversationThreadActions()
  return (cardType: T.RPCChat.JourneycardType, ordinal: T.Chat.Ordinal) => {
    const f = async () => {
      await dismissConversationJourneycardRPC(conversationIDKey, cardType).catch((error: unknown) => {
        if (error instanceof RPCError) {
          logger.error(`Failed to dismiss journeycard: ${error.message}`)
        }
      })
      deleteMessages({ordinals: [ordinal]})
    }
    ignorePromise(f())
  }
}

export const useConversationThreadUnfurlResolvePrompt = () => {
  const conversationIDKey = useConversationThreadID()
  const {clearUnfurlPrompt} = useConversationThreadActions()
  return (messageID: T.Chat.MessageID, domain: string, result: T.RPCChat.UnfurlPromptResult) => {
    clearUnfurlPrompt(messageID, domain)
    const f = async () => {
      await T.RPCChat.localResolveUnfurlPromptRpcPromise({
        convID: T.Chat.keyToConversationID(conversationIDKey),
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
        msgID: T.Chat.messageIDToNumber(messageID),
        result,
      })
    }
    ignorePromise(f())
  }
}
