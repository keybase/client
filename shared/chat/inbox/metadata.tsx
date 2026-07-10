import * as Common from '@/constants/chat/common'
import * as Meta from '@/constants/chat/meta'
import {useInboxMetadataState, metasReceived, participantInfoReceived} from './metadata-store'
export {useInboxMetadataState, metasReceived, participantInfoReceived} from './metadata-store'
import * as T from '@/constants/types'
import type * as EngineGen from '@/constants/rpc'
import {
  getModalStack,
  getVisibleScreen,
  navigateToInbox,
  navigateToThread as routerNavigateToThread,
} from '@/constants/router'
import type * as Router2 from '@/constants/router'
import logger from '@/logger'
import {ignorePromise, timeoutPromise} from '@/constants/utils'
import {RPCError} from '@/util/errors'
import * as Z from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useUsersState} from '@/stores/users'

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

export const maybeChangeSelectedConversation = (inboxLayout?: T.RPCChat.UIInboxLayout) => {
  const newConvID = inboxLayout?.reselectInfo?.newConvID
  const oldConvID = inboxLayout?.reselectInfo?.oldConvID

  const selectedConversation = Common.getSelectedConversation()

  if (!newConvID && !oldConvID) {
    return
  }

  const existingValid = T.Chat.isValidConversationIDKey(selectedConversation)
  if (!newConvID) {
    if (!existingValid && isMobile) {
      logger.info(`maybeChangeSelectedConversation: no new and no valid, so go to inbox`)
      navigateToInbox(false)
    }
    return
  }

  if (selectedConversation !== oldConvID) {
    if (!existingValid && isMobile) {
      logger.info(`maybeChangeSelectedConversation: no new and no valid, so go to inbox`)
      navigateToInbox(false)
    }
    return
  }

  if (isMobile) {
    if (T.Chat.isValidConversationIDKey(selectedConversation)) {
      logger.info(`maybeChangeSelectedConversation: mobile: navigating up on conv change`)
      navigateToInbox(false)
      return
    }
    logger.info(`maybeChangeSelectedConversation: mobile: ignoring conv change, no conv selected`)
    return
  }

  logger.info(
    `maybeChangeSelectedConversation: selecting new conv: new:${newConvID} old:${oldConvID} prevselected ${selectedConversation}`
  )
  routerNavigateToThread(newConvID, 'findNewestConversation')
}

export const onChatRouteChanged = (
  prev: T.Immutable<Router2.NavState>,
  next: T.Immutable<Router2.NavState>
) => {
  const wasModal = prev && getModalStack(prev).length > 0
  const isModal = next && getModalStack(next).length > 0
  if (wasModal || isModal) {
    return
  }
  const p = getVisibleScreen(prev)
  const n = getVisibleScreen(next)
  const wasChat = p?.name === Common.threadRouteName
  const isChat = n?.name === Common.threadRouteName
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

// Values are start timestamps: an engine reset orphans the RPC promise, so the finally
// that clears the marker never runs. Markers past the stale window are treated as dead
// so later unboxes (and the self-heal retries below) aren't blocked forever.
const inFlightUnboxRows = new Map<T.Chat.ConversationIDKey, number>()
const pendingForcedUnboxRows = new Set<T.Chat.ConversationIDKey>()
const unboxInFlightStaleMs = 20 * 1000

const isUnboxInFlight = (id: T.Chat.ConversationIDKey) => {
  const started = inFlightUnboxRows.get(id)
  if (started === undefined) {
    return false
  }
  if (Date.now() - started > unboxInFlightStaleMs) {
    inFlightUnboxRows.delete(id)
    return false
  }
  return true
}

// Trusted state now lives on the meta itself; a conv with no meta is 'requesting'
// while its unbox is in flight, otherwise 'untrusted'.
const trustedStateForConversation = (id: T.Chat.ConversationIDKey): T.Chat.MetaTrustedState =>
  useInboxMetadataState.getState().metas.get(id)?.trustedState ??
  (isUnboxInFlight(id) ? 'requesting' : 'untrusted')

const untrustedConversationIDKeys = (ids: ReadonlyArray<T.Chat.ConversationIDKey>) =>
  ids.filter(id => {
    const trustedState = trustedStateForConversation(id)
    return trustedState !== 'requesting' && trustedState !== 'trusted'
  })

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
      inFlightUnboxRows.clear()
      pendingForcedUnboxRows.clear()
      metaLoadRetries.forEach(entry => clearTimeout(entry.timer))
      metaLoadRetries.clear()
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

const requestInboxUnboxRows = (ids: ReadonlyArray<T.Chat.ConversationIDKey>, force: boolean) => {
  const f = async () => {
    if (!useConfigState.getState().loggedIn) {
      return
    }

    const conversationIDKeys = ids.reduce<Array<string>>((arr, id) => {
      if (id && T.Chat.isValidConversationIDKey(id)) {
        const trustedState = trustedStateForConversation(id)
        if (isUnboxInFlight(id)) {
          if (force) {
            pendingForcedUnboxRows.add(id)
          }
        } else if (force || (trustedState !== 'requesting' && trustedState !== 'trusted')) {
          arr.push(id)
        }
      }
      return arr
    }, [])

    if (!conversationIDKeys.length) {
      return
    }
    conversationIDKeys.forEach(id => inFlightUnboxRows.set(id, Date.now()))
    logger.info(
      `unboxRows: unboxing len: ${conversationIDKeys.length} convs: ${conversationIDKeys.join(',')}`
    )
    try {
      await T.RPCChat.localRequestInboxUnboxRpcPromise({
        convIDs: conversationIDKeys.map(k => T.Chat.keyToConversationID(k)),
      })
    } catch (error) {
      if (error instanceof RPCError) {
        logger.info(`unboxRows: failed ${error.desc}`)
      }
      // No per-conversation results arrived; the finally block clears the
      // in-flight marker so these convs fall back to 'untrusted' and can retry.
    } finally {
      conversationIDKeys.forEach(id => inFlightUnboxRows.delete(id))
      const rerunIDs = conversationIDKeys.filter(id => {
        const shouldRerun = pendingForcedUnboxRows.has(id)
        if (shouldRerun) {
          pendingForcedUnboxRows.delete(id)
        }
        return shouldRerun
      })
      if (rerunIDs.length > 0) {
        requestInboxUnboxRows(rerunIDs, true)
      }
    }
  }
  ignorePromise(f())
}

export const unboxRows = (ids: ReadonlyArray<T.Chat.ConversationIDKey>) => {
  requestInboxUnboxRows(ids, false)
}

// Self-heal for screens that render straight from this store (the thread header): a conv
// opened before its data lands would otherwise show blank with no recovery path — the
// requestInboxUnbox flow is fire-and-forget (data rides back on chatInboxConversation /
// ChatParticipantsInfo notifications), so a client-side skip or a missed notification is a
// permanent, silent miss. Fetch the conv directly instead: getInboxAndUnboxUILocal returns
// the unboxed conversation in its response, which we write into the store ourselves. Backoff
// retries only remain for the response-didn't-satisfy cases (offline, hung engine).
const metaLoadBackoffsMs = [2000, 4000, 8000, 16000, 32000]
const metaLoadRetries = new Map<
  T.Chat.ConversationIDKey,
  {attempt: number; timer?: ReturnType<typeof setTimeout>}
>()

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

export const ensureConversationMetaLoaded = (id: T.Chat.ConversationIDKey) => {
  if (!T.Chat.isValidConversationIDKey(id) || metaLoadRetries.has(id)) {
    return
  }
  if (!conversationMetaIncomplete(id)) {
    return
  }
  const entry: {attempt: number; timer?: ReturnType<typeof setTimeout>} = {attempt: 0}
  metaLoadRetries.set(id, entry)
  const tick = () => {
    const f = async () => {
      if (!conversationMetaIncomplete(id) || !useConfigState.getState().loggedIn) {
        // done, or logged out; callers re-arm on login
        metaLoadRetries.delete(id)
        return
      }
      try {
        // race a timeout so an engine reset (which orphans in-flight promises) can't wedge the loop
        await Promise.race([fetchConversationData(id), timeoutPromise(10000)])
      } catch (error) {
        if (error instanceof RPCError) {
          logger.info(`ensureConversationMetaLoaded: load failed for ${id}: ${error.desc}`)
        }
      }
      if (!conversationMetaIncomplete(id)) {
        metaLoadRetries.delete(id)
        return
      }
      const delay = metaLoadBackoffsMs[entry.attempt]
      entry.attempt++
      if (delay === undefined) {
        // exhausted; deleting lets a later mount of the conv start over
        metaLoadRetries.delete(id)
        return
      }
      entry.timer = setTimeout(tick, delay)
    }
    ignorePromise(f())
  }
  tick()
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
