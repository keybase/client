import * as Common from '@/constants/chat/common'
import * as Meta from '@/constants/chat/meta'
import {useInboxMetadataState, metasReceived, participantInfoReceived} from './metadata-store'
export {useInboxMetadataState, metasReceived, participantInfoReceived} from './metadata-store'
import * as T from '@/constants/types'
import type * as EngineGen from '@/constants/rpc'
import * as NavTree from '@/constants/nav-tree'
import type * as Router2 from '@/constants/router'
import logger from '@/logger'
import {ignorePromise, timeoutPromise} from '@/constants/utils'
import {RPCError} from '@/util/errors'
import * as Z from '@/util/zustand'
import {isChatSessionReady} from '@/stores/config'
import {withChatSessionRetry} from './session-rpc'
import {conversationGone, maybeChangeSelectedConversation} from './selection'
import {useCurrentUserState} from '@/stores/current-user'
import {useDaemonState} from '@/stores/daemon'
import {useUsersState} from '@/stores/users'
import {getAccountGeneration} from '@/engine/account-generation'

export const getInboxConversationMeta = (conversationIDKey: T.Chat.ConversationIDKey) =>
  useInboxMetadataState.getState().metas.get(conversationIDKey)

export const getInboxConversationParticipants = (conversationIDKey: T.Chat.ConversationIDKey) =>
  useInboxMetadataState.getState().participants.get(conversationIDKey)

export const updateInboxConversationMeta = (
  conversationIDKey: T.Chat.ConversationIDKey,
  partial: Partial<T.Chat.ConversationMeta>
) => {
  const oldMeta = getInboxConversationMeta(conversationIDKey)
  if (!oldMeta) {
    return
  }
  // Already merged from the current meta, so bypass version gating.
  metasReceived(
    [
      {
        ...oldMeta,
        ...partial,
        rekeyers: partial.rekeyers ? new Set(partial.rekeyers) : oldMeta.rekeyers,
        resetParticipants: partial.resetParticipants
          ? new Set(partial.resetParticipants)
          : oldMeta.resetParticipants,
      },
    ],
    undefined,
    {force: true}
  )
}

export const metaReceivedError = (
  conversationIDKey: T.Chat.ConversationIDKey,
  error: T.RPCChat.InboxUIItemError
) => {
  pendingUnboxRows.delete(conversationIDKey)
  failedUnboxRows.set(conversationIDKey, unboxGeneration())
  if (error.typ === T.RPCChat.ConversationErrorType.transient) {
    logger.info(
      `metaReceivedError: ignoring transient error for convID: ${conversationIDKey} error: ${error.message}`
    )
    return
  }
  logger.info(
    `metaReceivedError: displaying error for convID: ${conversationIDKey} error: ${error.message}`
  )
  const {meta, participants} = Meta.inboxUIItemErrorToConversationMetaAndParticipants(
    error,
    useCurrentUserState.getState().username,
    getInboxConversationMeta(conversationIDKey)
  )
  if (!meta) {
    return
  }
  // Error metas share the prior inbox version but flip trustedState to 'error';
  // gating would swallow that, so force the overwrite.
  metasReceived([meta], undefined, {force: true})
  if (participants) {
    participantInfoReceived(conversationIDKey, participants)
  }
}

const updateInboxParticipants = (inboxUIItems: ReadonlyArray<T.RPCChat.InboxUIItem>) => {
  const participantEntries = new Array<{
    conversationIDKey: T.Chat.ConversationIDKey
    participantInfo: T.Chat.ParticipantInfo
  }>()
  inboxUIItems.forEach(inboxUIItem => {
    const participantInfo: T.Chat.ParticipantInfo = Common.uiParticipantsToParticipantInfo(
      inboxUIItem.participants ?? []
    )
    if (participantInfo.all.length > 0) {
      const conversationIDKey = T.Chat.stringToConversationIDKey(inboxUIItem.convID)
      participantEntries.push({conversationIDKey, participantInfo})
    }
  })
  if (participantEntries.length > 0) {
    useInboxMetadataState.setState(s => {
      participantEntries.forEach(({conversationIDKey, participantInfo}) => {
        s.participants.set(conversationIDKey, T.castDraft(participantInfo))
      })
    })
  }
}

export const syncInboxParticipantsFromParticipantMap = (
  participantMap?: {[key: string]: ReadonlyArray<T.RPCChat.UIParticipant> | null} | null
) => {
  useInboxMetadataState.setState(s => {
    Object.keys(participantMap ?? {}).forEach(convIDStr => {
      const participants = participantMap?.[convIDStr]
      if (!participants) {
        return
      }
      const participantInfo = Common.uiParticipantsToParticipantInfo(participants)
      if (participantInfo.all.length > 0) {
        s.participants.set(
          T.Chat.stringToConversationIDKey(convIDStr),
          T.castDraft(participantInfo)
        )
      }
    })
  })
}

const updateInboxUserInfo = (inboxUIItems: ReadonlyArray<T.RPCChat.InboxUIItem>) => {
  const usernameToFullname = inboxUIItems.reduce<{[username: string]: string}>((map, inboxUIItem) => {
    inboxUIItem.participants?.forEach(part => {
      if (part.fullName) {
        map[part.assertion] = part.fullName
      }
    })
    return map
  }, {})
  const usernames = Object.keys(usernameToFullname)
  if (usernames.length === 0) {
    return
  }
  useUsersState.getState().dispatch.updates(
    usernames.map(name => ({
      info: {fullname: usernameToFullname[name]},
      name,
    }))
  )
}

export const onChatRouteChanged = (
  prev: T.Immutable<Router2.NavState>,
  next: T.Immutable<Router2.NavState>
) => {
  const wasModal = prev && NavTree.modalStack(prev).length > 0
  const isModal = next && NavTree.modalStack(next).length > 0
  if (wasModal || isModal) {
    return
  }
  const p = NavTree.visibleScreen(prev)
  const n = NavTree.visibleScreen(next)
  const wasChat = p?.name === Common.threadRouteName()
  const isChat = n?.name === Common.threadRouteName()
  if (!wasChat && !isChat) {
    return
  }
  const pParams = p?.params as undefined | {conversationIDKey?: T.Chat.ConversationIDKey}
  const nParams = n?.params as undefined | {conversationIDKey?: T.Chat.ConversationIDKey}
  const wasID = pParams?.conversationIDKey
  const isID = nParams?.conversationIDKey

  logger.info('maybeChangeChatSelection ', {isChat, isID, wasChat, wasID})

  if (wasChat && isChat && wasID === isID) {
    return
  }
  if (wasChat && wasID && T.Chat.isValidConversationIDKey(wasID)) {
    unboxRows([wasID])
  }
}

export const hydrateInboxLayout = (layout: T.RPCChat.UIInboxLayout) => {
  const missingSnippetIds = (layout.smallTeams ?? [])
    .filter(row => !row.snippet)
    .map(row => T.Chat.stringToConversationIDKey(row.convID))
  if (missingSnippetIds.length > 0) {
    queueMetaToRequest(missingSnippetIds)
  }
}

export const hydrateInboxConversations = (inboxUIItems: ReadonlyArray<T.RPCChat.InboxUIItem>) => {
  const metas: Array<T.Chat.ConversationMeta> = []
  inboxUIItems.forEach(inboxUIItem => {
    const meta = Meta.inboxUIItemToConversationMeta(inboxUIItem)
    if (meta) {
      metas.push(meta)
    }
  })
  updateInboxParticipants(inboxUIItems)
  if (metas.length > 0) {
    metasReceived(metas)
  }
}

export const clearConversationsForInboxSync = () => {
  useInboxMetadataState.setState(s => {
    s.metas.clear()
    s.participants.clear()
  })
}

// The link and the account an unbox is asked on. A new handshake loses the answers in flight on the
// old link, and the next account answers none of the previous one's requests.
const unboxGeneration = () => `${useDaemonState.getState().handshakeGeneration}:${getAccountGeneration()}`

// Convs asked of the service with no answer yet. The service answers every conv while the session and
// the link last, so an entry ends with its answer, a store reset, or a new generation; none needs a
// timeout.
const pendingUnboxRows = new Map<T.Chat.ConversationIDKey, {generation: string}>()
const isUnboxPending = (id: T.Chat.ConversationIDKey) =>
  pendingUnboxRows.get(id)?.generation === unboxGeneration()

// Convs the service answered with a failure, each with the generation it failed in. Asking again
// would get the same answer, so only something that can change it asks again in that generation: a
// notification about the conv, a forced request, or the user opening it.
const failedUnboxRows = new Map<T.Chat.ConversationIDKey, string>()
const unboxFailed = (id: T.Chat.ConversationIDKey) => failedUnboxRows.get(id) === unboxGeneration()

const needsUnbox = (id: T.Chat.ConversationIDKey) =>
  getInboxConversationMeta(id)?.trustedState !== 'trusted' && !isUnboxPending(id) && !unboxFailed(id)

const untrustedConversationIDKeys = (ids: ReadonlyArray<T.Chat.ConversationIDKey>) => ids.filter(needsUnbox)

type ConvoMetaQueueState = T.Immutable<{
  generation: number
  inFlight: boolean
  pending: ReadonlySet<T.Chat.ConversationIDKey>
  dispatch: {
    queueMetaHandle: () => void
    queueMetaToRequest: (ids: ReadonlyArray<T.Chat.ConversationIDKey>) => void
    resetState: () => void
  }
}>

const useConvoMetaQueueState = Z.createZustand<ConvoMetaQueueState>('convo-meta-queue', (set, get) => ({
  dispatch: {
    queueMetaHandle: () => {
      const {generation, inFlight, pending} = get()
      if (inFlight || pending.size === 0) {
        return
      }
      set(s => {
        if (s.generation === generation && !s.inFlight && s.pending.size > 0) {
          s.inFlight = true
        }
      })
      if (get().generation === generation && get().inFlight) {
        ignorePromise(runMetaQueueWorker(generation))
      }
    },
    queueMetaToRequest: (ids: ReadonlyArray<T.Chat.ConversationIDKey>) => {
      const nextIDs = untrustedConversationIDKeys(ids)
      const changed = nextIDs.some(k => !get().pending.has(k))
      if (!changed) {
        logger.info('skipping meta queue run, queue unchanged')
        return
      }
      set(s => {
        const pending = new Set(s.pending)
        nextIDs.forEach(k => pending.add(k))
        s.pending = pending
      })
      get().dispatch.queueMetaHandle()
    },
    resetState: () => {
      pendingUnboxRows.clear()
      failedUnboxRows.clear()
      set(s => {
        s.generation += 1
        s.inFlight = false
        s.pending = new Set()
      })
    },
  },
  generation: 0,
  inFlight: false,
  pending: new Set(),
}))

async function runMetaQueueWorker(generation: number) {
  let shouldQueueNextRun = false
  try {
    while (true) {
      if (useConvoMetaQueueState.getState().generation !== generation) {
        break
      }

      const maxToUnboxAtATime = 10
      let maybeUnbox: Array<T.Chat.ConversationIDKey> = []
      useConvoMetaQueueState.setState(s => {
        if (s.generation !== generation) {
          return
        }
        const pending = [...s.pending]
        maybeUnbox = pending.slice(0, maxToUnboxAtATime)
        s.pending = new Set(pending.slice(maxToUnboxAtATime))
      })

      if (!maybeUnbox.length) {
        break
      }

      const conversationIDKeys = untrustedConversationIDKeys(maybeUnbox)
      if (conversationIDKeys.length) {
        unboxRows(conversationIDKeys)
      }

      const current = useConvoMetaQueueState.getState()
      if (current.generation !== generation || current.pending.size === 0) {
        break
      }
      if (conversationIDKeys.length) {
        await timeoutPromise(100)
      }
    }
  } finally {
    const current = useConvoMetaQueueState.getState()
    if (current.generation === generation) {
      useConvoMetaQueueState.setState(s => {
        if (s.generation === generation) {
          s.inFlight = false
        }
      })
      const next = useConvoMetaQueueState.getState()
      shouldQueueNextRun = next.generation === generation && next.pending.size > 0
    }
  }
  if (shouldQueueNextRun) {
    useConvoMetaQueueState.getState().dispatch.queueMetaHandle()
  }
}

// A forced request always goes: the service gives a conv it is already unboxing one more pass for it.
const requestInboxUnboxRows = (ids: ReadonlyArray<T.Chat.ConversationIDKey>, force: boolean) => {
  const f = async () => {
    if (!isChatSessionReady()) {
      return
    }
    const conversationIDKeys = [
      ...new Set(ids.filter(id => T.Chat.isValidConversationIDKey(id) && (force || needsUnbox(id)))),
    ]
    if (!conversationIDKeys.length) {
      return
    }
    const entry = {generation: unboxGeneration()}
    conversationIDKeys.forEach(id => pendingUnboxRows.set(id, entry))
    let asked: boolean | undefined
    logger.info(
      `unboxRows: unboxing len: ${conversationIDKeys.length} force: ${force} convs: ${conversationIDKeys.join(',')}`
    )
    try {
      asked = await withChatSessionRetry(async () => {
        await T.RPCChat.localRequestInboxUnboxRpcPromise({
          convIDs: conversationIDKeys.map(k => T.Chat.keyToConversationID(k)),
          force,
        })
        return true
      })
    } catch (error) {
      if (error instanceof RPCError) {
        logger.info(`unboxRows: failed ${error.desc}`)
      }
    }
    if (!asked) {
      // no answer is coming for these; a later request's entry is left alone
      conversationIDKeys.forEach(id => {
        if (pendingUnboxRows.get(id) === entry) {
          pendingUnboxRows.delete(id)
        }
      })
    }
  }
  ignorePromise(f())
}

// changed: a notification says the convs changed, which can change a failed answer too
export const unboxRows = (ids: ReadonlyArray<T.Chat.ConversationIDKey>, opts?: {changed?: boolean}) => {
  if (opts?.changed) {
    ids.forEach(id => failedUnboxRows.delete(id))
  }
  requestInboxUnboxRows(ids, false)
}

const conversationMetaIncomplete = (id: T.Chat.ConversationIDKey) => {
  const s = useInboxMetadataState.getState()
  const meta = s.metas.get(id)
  if (!meta) {
    return true
  }
  if (meta.trustedState === 'error') {
    // the error screen owns recovery; retrying would fight it
    return false
  }
  if (meta.trustedState !== 'trusted') {
    return true
  }
  // adhoc convs render the header from participants, which can lag the trusted meta
  return !meta.teamname && !s.participants.get(id)?.name.length
}

// Raced against a timeout so an engine reset (which orphans in-flight promises) can't wedge a
// caller; the timer goes when the race settles.
const fetchConversationDataWithin = async (id: T.Chat.ConversationIDKey, ms: number) => {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const fetched = fetchConversationData(id)
    await Promise.race([fetched, new Promise<void>(resolve => (timer = setTimeout(resolve, ms)))])
  } finally {
    clearTimeout(timer)
  }
}

const fetchConversationData = async (id: T.Chat.ConversationIDKey) => {
  const res = await T.RPCChat.localGetInboxAndUnboxUILocalRpcPromise({
    identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
    query: {
      computeActiveList: false,
      convIDs: [T.Chat.keyToConversationID(id)],
      readOnly: false,
      unreadOnly: false,
    },
  })
  res.conversations?.forEach(conv => {
    onIncomingInboxUIItem(conv)
  })
}

// The conversation's trusted meta, fetched first when the store doesn't hold one: a share decides
// where its text goes against the draft in it. Undefined when it can't be loaded.
export const loadConversationMeta = async (id: T.Chat.ConversationIDKey) => {
  const trusted = () => {
    const meta = getInboxConversationMeta(id)
    return meta?.conversationIDKey === id && meta.trustedState === 'trusted' ? meta : undefined
  }
  if (trusted()) return trusted()
  try {
    await fetchConversationDataWithin(id, 10000)
  } catch (error) {
    logger.info(`loadConversationMeta: load failed for ${id}`, error)
  }
  return trusted()
}

// For screens that render straight from this store (the thread header), which can open a conv
// before the inbox has unboxed it. The user opening the conv asks again even if it failed before. A
// trusted adhoc conv whose participants never came is forced, since an ordinary request skips trusted
// convs; it still waits on a request already pending, which fills the same gap.
export const requestIncompleteConversationMeta = (id: T.Chat.ConversationIDKey) => {
  if (T.Chat.isValidConversationIDKey(id) && conversationMetaIncomplete(id) && !isUnboxPending(id)) {
    failedUnboxRows.delete(id)
    requestInboxUnboxRows([id], getInboxConversationMeta(id)?.trustedState === 'trusted')
  }
}

export const forceUnboxRowsForService = (ids: ReadonlyArray<T.Chat.ConversationIDKey>) => {
  requestInboxUnboxRows(ids, true)
}

export const queueMetaHandle = () => {
  useConvoMetaQueueState.getState().dispatch.queueMetaHandle()
}

export const queueMetaToRequest = (ids: ReadonlyArray<T.Chat.ConversationIDKey>) => {
  useConvoMetaQueueState.getState().dispatch.queueMetaToRequest(ids)
}

const hasKnownMeta = (id: T.Chat.ConversationIDKey) =>
  useInboxMetadataState.getState().metas.has(id)

export const ensureWidgetMetas = (
  widgetList: ReadonlyArray<{convID: T.Chat.ConversationIDKey}> | null | undefined
) => {
  if (!widgetList) {
    return
  }
  const missing = widgetList.reduce<Array<T.Chat.ConversationIDKey>>((l, v) => {
    if (!hasKnownMeta(v.convID)) {
      l.push(v.convID)
    }
    return l
  }, [])
  if (missing.length === 0) {
    return
  }
  unboxRows(missing)
}

export const ensureInboxSearchMetas = (ids: ReadonlyArray<T.Chat.ConversationIDKey>) => {
  const missing = ids.reduce<Array<T.Chat.ConversationIDKey>>((arr, id) => {
    if (!hasKnownMeta(id)) {
      arr.push(id)
    }
    return arr
  }, [])
  if (missing.length > 0) {
    unboxRows(missing)
  }
}

export const onIncomingInboxUIItem = (inboxUIItem?: T.RPCChat.InboxUIItem) => {
  if (!inboxUIItem) {
    return
  }
  updateInboxUserInfo([inboxUIItem])
  hydrateInboxConversations([inboxUIItem])
}

export const onGetInboxConvsUnboxed = (
  action: EngineGen.EngineAction<'chat.1.chatUi.chatInboxConversation'>
) => {
  const {convs} = action.payload.params
  const inboxUIItems = JSON.parse(convs) as Array<T.RPCChat.InboxUIItem>
  inboxUIItems.forEach(item => {
    const id = T.Chat.stringToConversationIDKey(item.convID)
    pendingUnboxRows.delete(id)
    failedUnboxRows.delete(id)
  })
  updateInboxUserInfo(inboxUIItems)
  hydrateInboxConversations(inboxUIItems)
}

export const onGetInboxUnverifiedConvs = (
  action: EngineGen.EngineAction<'chat.1.chatUi.chatInboxUnverified'>
) => {
  const {inbox} = action.payload.params
  const result = JSON.parse(inbox) as T.RPCChat.UnverifiedInboxUIItems
  const items: ReadonlyArray<T.RPCChat.UnverifiedInboxUIItem> = result.items ?? []
  const metas = items.reduce<Array<T.Chat.ConversationMeta>>((arr, item) => {
    const meta = Meta.unverifiedInboxUIItemToConversationMeta(item)
    if (meta) {
      arr.push(meta)
    }
    return arr
  }, [])
  metasReceived(metas)
}

export const onInboxLayoutChanged = (inboxLayout: T.RPCChat.UIInboxLayout, hadInboxLoaded: boolean) => {
  maybeChangeSelectedConversation(inboxLayout)
  ensureWidgetMetas(inboxLayout.widgetList)
  if (!hadInboxLoaded) {
    hydrateInboxLayout(inboxLayout)
  }
}

export const onChatInboxSynced = async (
  action: EngineGen.EngineAction<'chat.1.NotifyChat.ChatInboxSynced'>,
  refreshInbox: (reason: T.Chat.RefreshReason) => void | Promise<void>
) => {
  const {syncRes} = action.payload.params

  switch (syncRes.syncType) {
    case T.RPCChat.SyncInboxResType.clear:
      await refreshInbox('inboxSyncedClear')
      clearConversationsForInboxSync()
      return
    case T.RPCChat.SyncInboxResType.current:
      return
    case T.RPCChat.SyncInboxResType.incremental: {
      const items = syncRes.incremental.items || []
      const metas = items.reduce<Array<T.Chat.ConversationMeta>>((arr, item) => {
        const meta = Meta.unverifiedInboxUIItemToConversationMeta(item.conv)
        if (meta) {
          arr.push(meta)
        }
        return arr
      }, [])
      const removals = syncRes.incremental.removals?.map(T.Chat.stringToConversationIDKey)
      if (metas.length || removals?.length) {
        // Incremental unverified sync is authoritative for these convs; force past gating.
        metasReceived(metas, removals, {force: true})
      }
      removals?.forEach(id => conversationGone(id, 'removed from the inbox'))

      forceUnboxRowsForService(
        items
          .filter(item => item.shouldUnbox)
          .map(item => T.Chat.stringToConversationIDKey(item.conv.convID))
      )
      return
    }
    default:
      await refreshInbox('inboxSyncedUnknown')
  }
}
