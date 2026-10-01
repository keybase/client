import * as Common from '@/constants/chat/common'
import * as T from '@/constants/types'
import logger from '@/logger'
import throttle from 'lodash/throttle'
import {findLast} from '@/util/arrays'
import {ignorePromise} from '@/constants/utils'
import {useCurrentUserState} from '@/stores/current-user'
import {useConfigState} from '@/stores/config'
import {produce, type Draft} from 'immer'
import {createStore, type StoreApi} from 'zustand/vanilla'
import {
  type ThreadLoadReconcile,
  addMessagesToThreadState,
  completeAttachmentDownloadInThreadState,
  clearOptimisticReactionsForUpdatesInThreadState,
  clearOptimisticReactionsForMessagesInThreadState,
  clearPendingDeletesInThreadState,
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
import {getChatRpc, makeThreadChatRpc, type ChatThreadRpc} from './chat-rpc'
import {markConversationUnread} from './mark-unread'
import {
  getExplodingModeFromConfig,
  getMeta,
  loadConversationThreadMessages,
  persistExplodingMode,
} from './thread-load'

export type ConversationThreadState = {
  accountsInfoMap: Map<T.RPCChat.MessageID, T.Chat.ChatRequestInfo | T.Chat.ChatPaymentInfo>
  // Bumped on every messagesClear. The desktop list remounts on it: LegendList cannot recover
  // from a non-empty -> empty -> non-empty data transition (it resets its layout state and waits
  // for a container layout event that never comes), so the thread renders blank forever.
  clearVersion: number
  explodingMode: number
  flipStatusMap: Map<string, T.RPCChat.UICoinFlipStatus>
  loaded: boolean
  liveUpdateVersion: number
  messageIDToOrdinal: Map<T.Chat.MessageID, T.Chat.Ordinal>
  messageMap: Map<T.Chat.Ordinal, T.Chat.Message>
  messageOrdinals?: ReadonlyArray<T.Chat.Ordinal>
  // Set between a messagesClear and the reload that refills the window, so a notification arriving
  // in that gap cannot install itself as the new window. Cleared once that load settles, however it
  // settles - see clearWindowGate.
  windowCleared?: boolean
  // The load that owns the gate above: the first one to claim it after the clear, which is the
  // reload the clear issued. Only that load may drop the gate. clearVersion alone cannot tell two
  // loads of the same conversation apart, and a second load at the same generation - a
  // ChatThreadsStale reload, say - would otherwise settle first and take down a gate the reload is
  // still relying on.
  windowGateOwner?: number
  messageTypeMap: Map<T.Chat.Ordinal, T.Chat.RenderMessageType>
  moreToLoadBack: boolean
  moreToLoadForward: boolean
  optimisticReactionMap: Map<T.Chat.OutboxID, OptimisticReaction>
  paymentStatusMap: Map<T.Wallets.PaymentID, T.Chat.ChatPaymentInfo>
  // See PendingDeleteMap. Set by a delete, cleared by any update once the delete has landed (see
  // clearPendingDeletesInThreadState), when the delete fails (its RPC or, once queued, its outbox
  // entry) and by messagesClear. A thread load still carrying the row does not clear it: loads never
  // carry a queued delete, so they cannot tell a delete waiting to go out from one that failed.
  pendingDeleteMap: Map<T.Chat.OutboxID, T.Chat.Ordinal>
  pendingOutboxToOrdinal: Map<T.Chat.OutboxID, T.Chat.Ordinal>
  typing: Set<string>
  unfurlPrompt: Map<T.Chat.MessageID, Set<string>>
}

export type ThreadLoadStatusReporter = (
  conversationIDKey: T.Chat.ConversationIDKey,
  status: T.RPCChat.UIChatThreadStatusTyp
) => void

export type ThreadLoadStatusOptions = {
  isThreadLoadCurrent?: () => boolean
  onThreadLoadStatus?: ThreadLoadStatusReporter
}

export type ScrollDirection = 'none' | 'back' | 'forward'
export type LoadMoreMessagesParams = ThreadLoadStatusOptions & {
  allowMarkAsRead?: boolean
  centeredMessageID?: {
    conversationIDKey: T.Chat.ConversationIDKey
    highlightMode: T.Chat.CenterOrdinalHighlightMode
    messageID: T.Chat.MessageID
  }
  forceContainsLatestCalc?: boolean
  knownRemotes?: ReadonlyArray<string>
  messageIDControl?: T.RPCChat.MessageIDControl | null
  numberOfMessagesToLoad?: number
  reason: string
  // Internal: set only by the empty-back-page reload in thread-load.tsx, carrying the oldest
  // message ID the previous attempt saw. Each reload must reach strictly further back than that,
  // which is what stops it looping. Callers leave it unset.
  retryBelowMessageID?: T.Chat.MessageID
  // How many times the back-page reload has already chained. See maxBackPageReloads.
  retryCount?: number
  scrollDirection?: ScrollDirection
}
type LoadMoreMessages = ((p: LoadMoreMessagesParams) => void) & {cancel: () => void}

type ApplyThreadLoadParams = {
  centered: boolean
  disableActiveMarkRead?: boolean
  enableActiveMarkRead: boolean
  forceContainsLatestCalc?: boolean
  messages: ReadonlyArray<T.Chat.Message>
  moreToLoad: boolean
  reconcile?: ThreadLoadReconcile
  scrollDirection: ScrollDirection
}

type DeleteMessagesParams = {
  messageIDs?: ReadonlyArray<T.Chat.MessageID>
  upToMessageID?: T.Chat.MessageID
  deletableMessageTypes?: ReadonlySet<T.Chat.MessageType>
  ordinals?: ReadonlyArray<T.Chat.Ordinal>
  liveUpdate?: boolean
}

export type ConversationThreadActions = {
  addMessages: (
    messages: ReadonlyArray<T.Chat.Message>,
    opt?: {
      liveUpdate?: boolean
      markAsRead?: boolean
    }
  ) => void
  applyThreadLoad: (p: ApplyThreadLoadParams) => void
  clearUnfurlPrompt: (messageID: T.Chat.MessageID, domain: string) => void
  deleteMessages: (p: DeleteMessagesParams) => void
  explodeMessages: (
    messageIDs: ReadonlyArray<T.Chat.MessageID>,
    explodedBy?: string,
    liveUpdate?: boolean
  ) => void
  claimWindowGate: (loadID: number) => void
  clearWindowGate: (loadID: number) => void
  getSnapshot: () => ConversationThreadState
  // Whether the store's account has left (see makeThreadStore). Its actions and rpc already do
  // nothing then; this is for a continuation that was already past its await when it left.
  isRetired: () => boolean
  loadMoreMessages: LoadMoreMessages
  // What the thread's screen asks of the service: asks nothing once the store's account has left
  // (see makeThreadChatRpc).
  rpc: ChatThreadRpc
  markThreadAsRead: () => void
  setMarkReadBlocked: (blocked: boolean) => void
  messagesClear: () => void
  receivePaymentInfo: (messageID: T.Chat.MessageID, paymentInfo: T.Chat.ChatPaymentInfo) => void
  receiveRequestInfo: (messageID: T.Chat.MessageID, requestInfo: T.Chat.ChatRequestInfo) => void
  retryMessage: (outboxID: T.Chat.OutboxID) => void
  setExplodingMode: (seconds: number, incoming?: boolean) => void
  setMessageErrored: (outboxID: T.Chat.OutboxID, reason: string, errorTyp?: number) => void
  setMessageSubmitState: (ordinal: T.Chat.Ordinal, submitState: T.Chat.Message['submitState']) => void
  setMarkAsUnread: (readMsgID?: T.Chat.MessageID) => void
  setTyping: (typing: ReadonlySet<string>) => void
  showUnfurlPrompt: (messageID: T.Chat.MessageID, domain: string) => void
  addOptimisticReaction: (outboxID: T.Chat.OutboxID, reaction: OptimisticReaction) => void
  // outboxID: the delete's own
  addPendingDelete: (outboxID: T.Chat.OutboxID, ordinal: T.Chat.Ordinal) => void
  removePendingDelete: (outboxID: T.Chat.OutboxID) => void
  removeOptimisticReaction: (outboxID: T.Chat.OutboxID) => void
  updateOptimisticReactionDecorated: (outboxID: T.Chat.OutboxID, decorated: string) => void
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

// What the store reads from outside the thread. Service calls are not here: they go through
// getChatRpc() like the rest of the load pipeline, so a test swaps them with setChatRpc(). Nor is
// the conversation's meta: the inbox metadata store owns it, and the store, the load pipeline and
// the message commands all read it there, so a test sets real inbox metadata.
export type ThreadStoreDeps = {
  getSession: () => {loggedIn: boolean; uid: string}
  loadThreadMessages: (
    conversationIDKey: T.Chat.ConversationIDKey,
    p: LoadMoreMessagesParams,
    actions: ConversationThreadActions
  ) => void
}

const defaultDeps: ThreadStoreDeps = {
  getSession: () => ({
    loggedIn: useConfigState.getState().loggedIn,
    uid: useCurrentUserState.getState().uid,
  }),
  loadThreadMessages: (conversationIDKey, p, actions) =>
    loadConversationThreadMessages(conversationIDKey, p, actions),
}

export type ThreadStore = {
  actions: ConversationThreadActions
  // Drops the pending throttled load, and retires the store if its account has left. The store
  // otherwise stays usable: the provider calls this from an effect cleanup, which also runs when
  // <Activity> hides the screen and it comes back on the same store.
  dispose: () => void
  // Marks read if a load has armed it; for when the reader comes back to the thread.
  markReadIfArmed: () => void
  // Sticky username-header cache (see getMessageShowUsername): ordinal -> the author username it
  // has shown. Cleared on messagesClear.
  shownUsernameCache: Map<T.Chat.Ordinal, string>
  store: StoreApi<ConversationThreadState>
}

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

const makeEmptyThreadState = (): ConversationThreadState =>
  produce(
    {
      accountsInfoMap: new Map<T.RPCChat.MessageID, T.Chat.ChatRequestInfo | T.Chat.ChatPaymentInfo>(),
      clearVersion: 0,
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
      pendingDeleteMap: new Map<T.Chat.OutboxID, T.Chat.Ordinal>(),
      pendingOutboxToOrdinal: new Map<T.Chat.OutboxID, T.Chat.Ordinal>(),
      typing: new Set<string>(),
      unfurlPrompt: new Map<T.Chat.MessageID, Set<string>>(),
    },
    () => {}
  )

// Each of fns, doing nothing (undefined) once isRetired says so: the store's actions. What a thread's
// screen asks of the service goes through the thread's rpc, which retires with it.
const unlessRetired = <Fns extends {[K in keyof Fns]: (...args: never) => unknown}>(
  fns: Fns,
  isRetired: () => boolean
): {[K in keyof Fns]: (...args: Parameters<Fns[K]>) => ReturnType<Fns[K]> | undefined} => {
  const guarded: Partial<Record<keyof Fns, unknown>> = {}
  for (const key of Object.keys(fns) as Array<keyof Fns>) {
    const f = fns[key] as unknown as (...args: ReadonlyArray<unknown>) => unknown
    guarded[key] = (...args: ReadonlyArray<unknown>) => (isRetired() ? undefined : f(...args))
  }
  return guarded as {[K in keyof Fns]: (...args: Parameters<Fns[K]>) => ReturnType<Fns[K]> | undefined}
}

// uid: the account the thread belongs to. The store serves only that account: the first time it
// finds another account signed in, or none, it is retired for good (even if that account signs
// back in), and from then on every action, and every continuation of one (a load resolving late, a
// mark unread waiting on the service), does nothing. The provider builds a new store for whoever
// signs in next.
// isLookingAtThread: whether the reader is looking at this thread right now (app active and
// focused, route focused). Mark read asks it each time and refuses while they are not.
export const makeThreadStore = (
  id: T.Chat.ConversationIDKey,
  uid: string,
  isLookingAtThread: () => boolean,
  overrides?: Partial<ThreadStoreDeps>
): ThreadStore => {
  const deps: ThreadStoreDeps = {...defaultDeps, ...overrides}
  const store = createStore<ConversationThreadState>(() =>
    produce(makeEmptyThreadState(), s => {
      s.explodingMode = getExplodingModeFromConfig(id)
    })
  )
  const shownUsernameCache = new Map<T.Chat.Ordinal, string>()
  let retired = false
  const isRetired = () => (retired ||= deps.getSession().uid !== uid)
  let activeMarkReadEnabled = false
  // the message a mark read is on its way for; the inbox meta moves only once the service answers
  let markReadSending: T.Chat.MessageID | undefined
  let markReadBlocked = false

  const getSnapshot = () => store.getState()
  // Returns what the updater returns. The updater's result is never handed to immer, which would
  // take it as the replacement state.
  const updateThreadState = <R,>(updater: (draft: Draft<ConversationThreadState>) => R): R => {
    const current = store.getState()
    let result: R | undefined
    const next = produce(current, draft => {
      result = updater(draft)
      // A delete lands by whatever path changes the row, so every update settles pending deletes.
      if (draft.pendingDeleteMap.size) {
        clearPendingDeletesInThreadState(draft)
      }
    })
    if (current !== next) {
      store.setState(next, true)
    }
    return result as R
  }

  const markThreadAsRead = () => {
    const f = async () => {
      const session = deps.getSession()
      if (!session.loggedIn) {
        logger.info('mark read bail on not logged in')
        return
      }
      if (!T.Chat.isValidConversationIDKey(id)) {
        logger.info('mark read bail on no selected conversation')
        return
      }
      if (!activeMarkReadEnabled) {
        logger.info('mark read bail on no eligible thread load')
        return
      }
      if (markReadBlocked) {
        logger.info('mark read bail on blocked thread load')
        return
      }
      if (!isLookingAtThread()) {
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
      // divider at all. Wait for localization; the provider runs this again once it lands.
      if (getMeta(id).readMsgID < 0) {
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
      if (readMsgID === getMeta(id).readMsgID) {
        logger.info(`marking read messages is noop bail: ${id} ${readMsgID}`)
        return
      }
      if (readMsgID === markReadSending) {
        logger.info(`marking read messages already sending: ${id} ${readMsgID}`)
        return
      }
      logger.info(`marking read messages ${id} ${readMsgID}`)
      markReadSending = readMsgID
      try {
        await getChatRpc().markRead({conversationIDKey: id, forceUnread: false, msgID: readMsgID})
      } finally {
        if (markReadSending === readMsgID) {
          markReadSending = undefined
        }
      }
    }
    ignorePromise(f())
  }

  const addMessages: ConversationThreadActions['addMessages'] = (messages, opt = {}) => {
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

  const setMarkReadBlocked = (blocked: boolean) => {
    markReadBlocked = blocked
    if (blocked) {
      activeMarkReadEnabled = false
    }
  }

  const applyThreadLoad = (p: ApplyThreadLoadParams) => {
    const rendered = p.messages.filter(m => m.conversationMessage !== false && m.type !== 'deleted')
    // Judged on what this pass carried rather than on the state of the window, so the gate turns
    // on the one thing that decides it: whether this pass put a row on screen.
    const carriedRenderedMessage = rendered.length > 0
    // A 'none' load fetches the newest page, and a window with more to load forward does not
    // reach it. Merging the two leaves ordinals with a hole through the middle, and the branch
    // below then reports that window as containing the latest message - which is the gap this
    // whole invariant is about, arriving through a ChatThreadsStale reload while the reader sits
    // on a search result. Both conditions are needed: a window that already reaches the newest
    // message merges fine, and so does a page that overlaps what we hold, however far back the
    // reader is. Neither holds here, so the page is left alone rather than applied - the reader
    // keeps their window, and jumping to recent (which empties it first) is what replaces it.
    const beforeApply = store.getState()
    const windowOrdinals = beforeApply.messageOrdinals
    const floor = windowOrdinals?.[0]
    const ceiling = windowOrdinals?.[windowOrdinals.length - 1]
    if (
      p.scrollDirection === 'none' &&
      rendered.length &&
      beforeApply.moreToLoadForward &&
      floor !== undefined &&
      ceiling !== undefined
    ) {
      let lowest = Number.MAX_SAFE_INTEGER
      let highest = Number.MIN_SAFE_INTEGER
      for (const m of rendered) {
        lowest = Math.min(lowest, m.ordinal)
        highest = Math.max(highest, m.ordinal)
      }
      if (lowest > ceiling || highest < floor) {
        logger.info(
          `applyThreadLoad: page ${lowest}-${highest} does not reach window ${floor}-${ceiling}, ignoring`
        )
        return
      }
    }
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
      // Only a pass that actually rendered something drops the gate. A cold cache sends an empty
      // cached pass ahead of the full response, and a page can be all tombstones: dropping the
      // gate on either would let a notification arriving before the real page install itself as
      // the whole window and strand once that page lands. A load that ends without ever producing
      // an ordinal releases the gate in its own finally instead - see clearWindowGate.
      if (carriedRenderedMessage) {
        s.windowCleared = false
        s.windowGateOwner = undefined
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
          if (p.centered && p.forceContainsLatestCalc) {
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
      markReadBlocked = false
    }
    if (p.disableActiveMarkRead) {
      activeMarkReadEnabled = false
    } else if (p.enableActiveMarkRead && !markReadBlocked) {
      activeMarkReadEnabled = true
    }
  }

  const deleteMessages = (p: DeleteMessagesParams) => {
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

  const explodeMessages: ConversationThreadActions['explodeMessages'] = (
    messageIDs,
    explodedBy,
    liveUpdate
  ) => {
    updateThreadState(s => {
      if (liveUpdate) {
        s.liveUpdateVersion += 1
      }
      explodeMessagesInThreadState(s, messageIDs, explodedBy)
    })
  }

  const retryMessage = (outboxID: T.Chat.OutboxID) => {
    if (!updateThreadState(s => retryMessageInThreadState(s, outboxID))) {
      logger.warn(`retryMessage: no message for outbox id ${outboxID} in convID=${id}`)
      return
    }
    ignorePromise(
      (async () => {
        await getChatRpc().retryPost(outboxID)
      })()
    )
  }

  const setExplodingMode = (seconds: number, incoming?: boolean) => {
    updateThreadState(s => {
      s.explodingMode = seconds
    })
    if (!incoming) {
      persistExplodingMode(id, getMeta(id), seconds)
    }
  }

  const setMarkAsUnread = (readMsgID?: T.Chat.MessageID) => {
    markConversationUnread(id, readMsgID, {getWindow: getSnapshot, isRetired})
  }

  const updateReactions: ConversationThreadActions['updateReactions'] = updates => {
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
    if (missingTargetMsgIDs.length !== updates.length) {
      markThreadAsRead()
    }
  }

  // The reload a clear issues claims the gate, so a load that merely happens to be running at the
  // same clear generation cannot drop it out from under that reload. First claim wins: the clear
  // issues its reload synchronously, so that reload is the first to get here.
  const claimWindowGate = (loadID: number) => {
    const s = store.getState()
    if (!s.windowCleared || s.windowGateOwner !== undefined) {
      return
    }
    updateThreadState(d => {
      d.windowGateOwner = loadID
    })
  }

  // applyThreadLoad drops the gate when a load refills the window, but a load can end without ever
  // applying: offline, scchatnotinteam, or a response that carries no thread. Left alone the gate
  // would keep dropping notifications for the life of the store, with no window to correct it.
  const clearWindowGate = (loadID: number) => {
    const s = store.getState()
    if (!s.windowCleared) {
      return
    }
    // An unclaimed gate is released by whoever settles first: nothing claimed it, so there is no
    // reload in flight to protect, and leaving it up would strand the thread.
    if (s.windowGateOwner !== undefined && s.windowGateOwner !== loadID) {
      return
    }
    updateThreadState(d => {
      d.windowCleared = false
      d.windowGateOwner = undefined
    })
  }

  const messagesClear = () => {
    activeMarkReadEnabled = false
    shownUsernameCache.clear()
    updateThreadState(s => {
      s.clearVersion += 1
      s.pendingOutboxToOrdinal.clear()
      s.loaded = false
      // Mark the gap. A notification landing between here and the reload would otherwise face an
      // empty window, install itself as the whole of it, and strand once the load response arrives.
      // Both callers reload a region disjoint from the one being dropped - a centered jump an
      // arbitrary one, jumpToRecent the newest page - so nothing arriving first can be placed
      // against what is coming.
      s.windowCleared = true
      s.windowGateOwner = undefined
      s.messageIDToOrdinal.clear()
      s.messageMap.clear()
      s.messageOrdinals = undefined
      s.messageTypeMap.clear()
      s.optimisticReactionMap.clear()
      s.pendingDeleteMap.clear()
    })
  }

  // a throttled load runs later, and the load pipeline asks isThreadLoadCurrent after every await
  const loadImmediately = (p: LoadMoreMessagesParams) => {
    if (isRetired()) {
      return
    }
    const {isThreadLoadCurrent} = p
    deps.loadThreadMessages(
      id,
      {...p, isThreadLoadCurrent: () => !isRetired() && (isThreadLoadCurrent?.() ?? true)},
      actions
    )
  }
  const throttledLoad = throttle(loadImmediately, 500)
  // The throttle keeps only the last trailing call, so a centered or jump-to-recent
  // load issued between two other loads would be silently dropped — after
  // loadMessagesCentered already cleared the thread. Run those immediately instead.
  const loadMoreMessages: LoadMoreMessages = Object.assign(
    (p: LoadMoreMessagesParams) => {
      if (p.centeredMessageID || p.messageIDControl || p.reason === 'jump to recent') {
        throttledLoad.cancel()
        loadImmediately(p)
      } else {
        throttledLoad(p)
      }
    },
    {
      cancel: () => {
        throttledLoad.cancel()
      },
    }
  )

  const mutators: Omit<ConversationThreadActions, 'getSnapshot' | 'isRetired' | 'loadMoreMessages' | 'rpc'> = {
    addMessages,
    addOptimisticReaction: (outboxID, reaction) => {
      updateThreadState(s => {
        s.optimisticReactionMap.set(outboxID, reaction)
      })
    },
    addPendingDelete: (outboxID, ordinal) => {
      updateThreadState(s => {
        s.pendingDeleteMap.set(outboxID, ordinal)
      })
    },
    applyThreadLoad,
    claimWindowGate,
    clearUnfurlPrompt: (messageID, domain) => {
      updateThreadState(s => {
        const prompts = s.unfurlPrompt.get(messageID)
        prompts?.delete(domain)
      })
    },
    clearWindowGate,
    completeAttachmentDownload: msgID => {
      updateThreadState(s => {
        completeAttachmentDownloadInThreadState(s, msgID)
      })
    },
    deleteMessages,
    explodeMessages,
    failAttachmentDownload: (ordinal, errMsg) => {
      updateThreadState(s => {
        failAttachmentDownloadInThreadState(s, ordinal, errMsg)
      })
    },
    finishAttachmentDownload: (ordinal, path) => {
      updateThreadState(s => {
        finishAttachmentDownloadInThreadState(s, ordinal, path)
      })
    },
    markThreadAsRead,
    messagesClear,
    receivePaymentInfo: (messageID, paymentInfo) => {
      updateThreadState(s => {
        s.accountsInfoMap.set(messageID, paymentInfo)
        s.paymentStatusMap.set(paymentInfo.paymentID, paymentInfo)
      })
    },
    receiveRequestInfo: (messageID, requestInfo) => {
      updateThreadState(s => {
        s.accountsInfoMap.set(messageID, requestInfo)
      })
    },
    removeOptimisticReaction: outboxID => {
      updateThreadState(s => {
        s.optimisticReactionMap.delete(outboxID)
      })
    },
    removePendingDelete: outboxID => {
      updateThreadState(s => {
        s.pendingDeleteMap.delete(outboxID)
      })
    },
    retryMessage,
    setAttachmentMobileSaving: (ordinal, saving) => {
      updateThreadState(s => {
        setAttachmentMobileSavingInThreadState(s, ordinal, saving)
      })
    },
    setExplodingMode,
    setMarkAsUnread,
    setMarkReadBlocked,
    setMessageErrored: (outboxID, reason, errorTyp) => {
      updateThreadState(s => {
        setMessageErroredInThreadState(s, outboxID, reason, errorTyp)
        // the failed outbox entry can be a delete's, which names no row
        s.pendingDeleteMap.delete(outboxID)
      })
    },
    setMessageSubmitState: (ordinal, submitState) => {
      updateThreadState(s => {
        setMessageSubmitStateInThreadState(s, ordinal, submitState)
      })
    },
    setTyping: typing => {
      updateThreadState(s => {
        if (sameStringSet(s.typing, typing)) {
          return
        }
        s.typing = new Set(typing)
      })
    },
    showUnfurlPrompt: (messageID, domain) => {
      updateThreadState(s => {
        let prompts = s.unfurlPrompt.get(messageID)
        if (!prompts) {
          prompts = new Set()
          s.unfurlPrompt.set(messageID, prompts)
        }
        prompts.add(domain)
      })
    },
    startAttachmentDownload: ordinal => {
      updateThreadState(s => {
        startAttachmentDownloadInThreadState(s, ordinal)
      })
    },
    updateAttachmentDownloadProgress: (msgID, bytesComplete, bytesTotal) => {
      updateThreadState(s => {
        updateAttachmentDownloadProgressInThreadState(s, msgID, bytesComplete, bytesTotal)
      })
    },
    updateAttachmentUploadProgress: (outboxID, bytesComplete, bytesTotal) => {
      updateThreadState(s => {
        updateAttachmentUploadProgressInThreadState(s, outboxID, bytesComplete, bytesTotal)
      })
    },
    updateCoinFlipStatuses: statuses => {
      updateThreadState(s => {
        statuses.forEach(status => {
          s.flipStatusMap.set(status.gameID, T.castDraft(status))
        })
      })
    },
    updateOptimisticReactionDecorated: (outboxID, decorated) => {
      updateThreadState(s => {
        const reaction = s.optimisticReactionMap.get(outboxID)
        if (reaction) {
          s.optimisticReactionMap.set(outboxID, {...reaction, decorated})
        }
      })
    },
    updateReactions,
  }
  const actions: ConversationThreadActions = {
    ...unlessRetired(mutators, isRetired),
    getSnapshot,
    isRetired,
    loadMoreMessages: Object.assign(unlessRetired({loadMoreMessages}, isRetired).loadMoreMessages, {
      cancel: loadMoreMessages.cancel,
    }),
    rpc: makeThreadChatRpc(isRetired),
  }

  return {
    actions,
    dispose: () => {
      loadMoreMessages.cancel()
      // an unmount for an account switch runs after the reset, so the store is retired even if the
      // account signs back in before a late continuation of it asks
      isRetired()
    },
    markReadIfArmed: () => {
      if (!isRetired() && activeMarkReadEnabled) {
        markThreadAsRead()
      }
    },
    shownUsernameCache,
    store,
  }
}
