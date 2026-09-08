import * as Common from '@/constants/chat/common'
import * as Message from '@/constants/chat/message'
import * as Meta from '@/constants/chat/meta'
import * as Strings from '@/constants/strings'
import * as T from '@/constants/types'
import {navigateToInbox} from '@/constants/router'
import logger from '@/logger'
import {findLast} from '@/util/arrays'
import {ignorePromise} from '@/constants/utils'
import {RPCError} from '@/util/errors'
import {persistRoute} from '@/util/storeless-actions'
import {uint8ArrayToString} from '@/util/uint8array'
import {useCurrentUserState} from '@/stores/current-user'
import {useConfigState} from '@/stores/config'
import {type ValidatedRange, getOrdinalForMessageID} from './thread-message-state'
import {getInboxConversationMeta, updateInboxConversationMeta} from '@/chat/inbox/metadata'
import {loadThreadNonblock, threadLoadReasonToRPCReason} from './thread-rpc'
import type {
  ConversationThreadActions,
  ConversationThreadState,
  LoadMoreMessagesParams,
  ScrollDirection,
} from './thread-context'

// Identifies one load, so the window gate can tell two loads of the same conversation apart.
// Only ever compared for equality, never ordered.
let nextLoadID = 0

export const numMessagesOnInitialLoad = isMobile ? 20 : 100
// How far the no-new-ordinals back-page chain will walk on its own before handing the thread back to
// the reader. See the reload block in loadConversationThreadMessages.
export const maxBackPageReloads = 10
export const numMessagesOnScrollback = 100

const ignoreErrors = [
  T.RPCGen.StatusCode.scgenericapierror,
  T.RPCGen.StatusCode.scapinetworkerror,
  T.RPCGen.StatusCode.sctimeout,
]

// The inbox metadata store is the single owner of conversation meta; fall back to
// an empty meta for reads that predate an unbox.
export const emptyConversationMeta = Meta.makeConversationMeta()
export const getMeta = (id: T.Chat.ConversationIDKey) => getInboxConversationMeta(id) ?? emptyConversationMeta

export const getCurrentUser = () => {
  const s = useCurrentUserState.getState()
  return {devicename: s.deviceName, username: s.username}
}

export const getExplodingModeFromGregorItems = (
  conversationIDKey: T.Chat.ConversationIDKey,
  items: ReadonlyArray<{item: T.RPCGen.Gregor1.Item}>
) => {
  const explodingItems = items.filter(i => i.item.category.startsWith(Common.explodingModeGregorKeyPrefix))
  if (!explodingItems.length) {
    return 0
  }
  const category = `${Common.explodingModeGregorKeyPrefix}${conversationIDKey}`
  const item = explodingItems.find(i => i.item.category === category)
  if (!item) {
    // Other conversations have exploding modes but this one's category is absent,
    // meaning it was dismissed: the mode is off.
    return 0
  }
  const secondsString = uint8ArrayToString(item.item.body)
  const seconds = parseInt(secondsString, 10)
  if (isNaN(seconds)) {
    logger.warn(`Got dirty exploding mode ${secondsString} for category ${category}`)
    return undefined
  }
  return seconds
}

export const getExplodingModeFromConfig = (conversationIDKey: T.Chat.ConversationIDKey) =>
  getExplodingModeFromGregorItems(conversationIDKey, useConfigState.getState().gregorPushState) ?? 0

export const persistExplodingMode = (
  conversationIDKey: T.Chat.ConversationIDKey,
  meta: T.Chat.ConversationMeta,
  seconds: number
) => {
  const f = async () => {
    logger.info(`Setting exploding mode for conversation ${conversationIDKey} to ${seconds}`)
    const category = `${Common.explodingModeGregorKeyPrefix}${conversationIDKey}`
    const convRetention = Meta.getEffectiveRetentionPolicy(meta)
    try {
      if (seconds === 0 || seconds === convRetention.seconds) {
        await T.RPCGen.gregorDismissCategoryRpcPromise({category})
      } else {
        await T.RPCGen.gregorUpdateCategoryRpcPromise({
          body: seconds.toString(),
          category,
          dtime: {offset: 0, time: 0},
        })
        logger.info(`Successfully set exploding mode for conversation ${conversationIDKey} to ${seconds}`)
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
  ignorePromise(f())
}

export const getClientPrevFromSnapshot = (snapshot: ConversationThreadState): T.Chat.MessageID => {
  const ordinal = findLast(snapshot.messageOrdinals ?? [], o => {
    const m = snapshot.messageMap.get(o)
    return !!m?.id
  })
  const message = ordinal ? snapshot.messageMap.get(ordinal) : undefined
  return message?.id || T.Chat.numberToMessageID(0)
}

export const getLastOrdinalFromSnapshot = (snapshot: ConversationThreadState) =>
  snapshot.messageOrdinals?.at(-1) ?? T.Chat.numberToOrdinal(0)

export const getOrdinalForMessageIDInSnapshot = (
  snapshot: ConversationThreadState,
  messageID: T.Chat.MessageID
) =>
  getOrdinalForMessageID(
    snapshot.messageMap,
    snapshot.pendingOutboxToOrdinal,
    messageID,
    snapshot.messageIDToOrdinal
  )

export const scrollDirectionToPagination = (
  scrollDirection: ScrollDirection,
  numberOfMessagesToLoad: number
) => {
  const pagination = {
    last: false,
    next: '',
    num: numberOfMessagesToLoad,
    previous: '',
  }
  switch (scrollDirection) {
    case 'none':
      break
    case 'back':
      pagination.next = 'deadbeef'
      break
    case 'forward':
      pagination.previous = 'deadbeef'
  }
  return pagination
}

export const loadConversationThreadMessages = (
  conversationIDKey: T.Chat.ConversationIDKey,
  p: LoadMoreMessagesParams,
  actions: ConversationThreadActions
) => {
  if (!T.Chat.isValidConversationIDKey(conversationIDKey)) {
    return
  }
  const {
    scrollDirection = 'none',
    numberOfMessagesToLoad = numMessagesOnInitialLoad,
    retryBelowMessageID,
    retryCount = 0,
  } = p
  const {
    allowMarkAsRead = true,
    reason,
    forceContainsLatestCalc,
    messageIDControl,
    knownRemotes,
    centeredMessageID,
    isThreadLoadCurrent,
    onThreadLoadStatus,
  } = p
  const isCurrentThreadLoad = () => isThreadLoadCurrent?.() ?? true

  const f = async () => {
    if (!isCurrentThreadLoad()) {
      logger.info('loadMoreMessages: bail: stale mounted thread load')
      return
    }

    if (!conversationIDKey || !T.Chat.isValidConversationIDKey(conversationIDKey)) {
      logger.info('loadMoreMessages: bail: no conversationIDKey')
      return
    }

    const loadStartedSnapshot = actions.getSnapshot()
    const clearVersionAtLoadStart = loadStartedSnapshot.clearVersion
    // applyThreadLoad drops the window gate when a load refills the window, but a load can end
    // without ever applying: offline, scchatnotinteam, a response carrying no thread, or a bail
    // before the RPC is even made. Left alone the gate would keep dropping notifications for the
    // life of the provider, which is a thread that silently stops receiving messages.
    //
    // Keyed on clearVersion, not on isThreadLoadCurrent: the load generation only moves when the
    // conversation changes or the thread unmounts, so two loads of the same conversation both call
    // themselves current. A load that started before the clear would otherwise pull down the gate
    // belonging to the load that started after it, while that one is still in flight.
    //
    // clearVersion alone still cannot separate two loads issued after the same clear, so the gate
    // is also owned: first claim wins, and only the owner may drop it. Claimed here, before the
    // first await, rather than when a response arrives - both clear paths bypass the load throttle
    // (see loadMoreMessages in thread-context) and call in synchronously, so the reload the clear
    // issued is always the first to get here, and a load that ends without ever applying still has
    // to be the one that releases.
    const loadID = nextLoadID++
    actions.claimWindowGate(loadID)
    const releaseWindowGate = () => {
      if (actions.getSnapshot().clearVersion === clearVersionAtLoadStart) {
        actions.clearWindowGate(loadID)
      }
    }
    const currentMeta = getMeta(conversationIDKey)
    if (currentMeta.membershipType === 'youAreReset' || currentMeta.rekeyers.size > 0) {
      logger.info('loadMoreMessages: bail: we are reset')
      releaseWindowGate()
      return
    }
    const loadStartedLiveUpdateVersion = loadStartedSnapshot.liveUpdateVersion
    const protectLoadedFocusRefresh =
      loadStartedSnapshot.loaded &&
      scrollDirection === 'none' &&
      !centeredMessageID &&
      !messageIDControl &&
      (reason === 'focused' || reason === 'tab selected')
    logger.info(
      `loadMoreMessages: calling rpc convo: ${conversationIDKey} num: ${numberOfMessagesToLoad} reason: ${reason}`
    )

    const loadingKey = Strings.waitingKeyChatThreadLoad(conversationIDKey)
    // The ordinals the cached pass carried. Once the service has sent a cached thread it switches
    // the full response to INCREMENTAL, which walks the authoritative window and sends only the
    // messages the cached pass did not already carry unchanged (mergeLocalRemoteThread in
    // go/chat/uithreadloader.go, where localSentThread is that exact cached pass). Neither pass is
    // a whole window on its own, but together they cover every message in the window - which is
    // what the prune below needs, and why it unions them rather than gating on the full pass alone.
    const cachedPassOrdinals = new Set<T.Chat.Ordinal>()
    // The reload below is judged against the whole load, not one pass of it. A warm-cache load
    // delivers the page on the cached pass and then an INCREMENTAL full pass carrying only what
    // changed, so measuring the full pass alone says "added nothing" for a perfectly good page.
    // Measuring from before either pass tells the two apart: a page of real messages moves this,
    // a page of tombstones does not, wherever it arrived.
    const floorAtLoadStart = loadStartedSnapshot.messageOrdinals?.[0]
    let oldestSeenThisLoad = Number.MAX_SAFE_INTEGER as T.Chat.MessageID
    const onGotThread = (thread: string, why: string) => {
      if (!thread) {
        return
      }
      if (!isCurrentThreadLoad()) {
        logger.info(`loadMoreMessages: stale response ignored: ${why}`)
        return
      }
      // A clear under us - jump to recent, a centered jump - dropped the window this load was
      // paging against, and the reload that follows fetches a disjoint region. isCurrentThreadLoad
      // does not catch it: the load generation only moves when the conversation changes or the
      // thread unmounts, so a load that started before the clear still calls itself current.
      // Applying it anyway would repopulate the cleared window and lower the gate belonging to the
      // reload, which then merges its own page into the leftovers.
      const snapshotAtResponse = actions.getSnapshot()
      if (snapshotAtResponse.clearVersion !== clearVersionAtLoadStart) {
        logger.info(`loadMoreMessages: response ignored after clear: ${why}`)
        return
      }
      // clearVersion cannot separate two loads issued after the same clear, and the second one is
      // not hypothetical: a ChatThreadsStale or ChatInboxSynced reload fires with scrollDirection
      // 'none' and fetches the newest page, not the region the clear asked for. If it answers
      // first it would fill the cleared window with that disjoint page and drop the gate, and the
      // reload the clear issued would then merge its own page into the leftovers - exactly the
      // ordinal gap the gate exists to prevent. While the gate is up only its owner may refill the
      // window; once the owner settles the gate is down and everyone applies normally again.
      if (
        snapshotAtResponse.windowCleared &&
        snapshotAtResponse.windowGateOwner !== undefined &&
        snapshotAtResponse.windowGateOwner !== loadID
      ) {
        logger.info(`loadMoreMessages: response ignored, another load owns the window: ${why}`)
        return
      }
      if (protectLoadedFocusRefresh && snapshotAtResponse.liveUpdateVersion !== loadStartedLiveUpdateVersion) {
        logger.info(
          `loadMoreMessages: stale response ignored after live update: ${why} reason=${reason} convID=${conversationIDKey}`
        )
        return
      }

      const {username, devicename} = getCurrentUser()
      const {messages, pagination} = Message.parseUIMessagesJSON(
        conversationIDKey,
        thread,
        username,
        devicename,
        () => getLastOrdinalFromSnapshot(actions.getSnapshot())
      )
      const moreToLoad = pagination ? !pagination.last : true
      const canMarkReadForThreadWindow =
        allowMarkAsRead &&
        !centeredMessageID &&
        !messageIDControl &&
        scrollDirection !== 'back' &&
        reason !== 'findNewestConversation' &&
        reason !== 'findNewestConversationFromLayout'
      // Pruning is only safe against a whole window, and a single pass is not one: the cached pass
      // is whatever the local cache holds, gaps included, and the full pass behind it carries only
      // what changed. The two together are the window, so the range is computed on the full pass
      // from the union of both. Waiting for a pass with no cached one before it would leave the
      // stale-ordinal cleanup running on cold caches only, which is where ghost rows are least
      // likely to be - a reopened conversation is warm every time.
      const renderedMessages = messages.filter(
        m => m.conversationMessage !== false && m.type !== 'deleted'
      )
      const renderedOrdinals = renderedMessages.map(m => m.ordinal)
      let validatedRange: ValidatedRange | undefined
      if (scrollDirection === 'none' && why === 'full') {
        const ords = [...renderedOrdinals, ...cachedPassOrdinals]
        if (ords.length > 0) {
          validatedRange = {
            // The cached pass was applied in its own call, so what it delivered is not among the
            // messages this one carries. Without it every row only that pass mentioned would read
            // as missing from the window and be pruned.
            alsoPresent: cachedPassOrdinals,
            from: Math.min(...ords) as T.Chat.Ordinal,
            to: Math.max(...ords) as T.Chat.Ordinal,
          }
        }
      }
      for (const m of messages) {
        if (m.id > 0 && m.id < oldestSeenThisLoad) {
          oldestSeenThisLoad = m.id
        }
      }
      actions.applyThreadLoad({
        centered: !!centeredMessageID,
        disableActiveMarkRead: !allowMarkAsRead || !!centeredMessageID || !!messageIDControl,
        enableActiveMarkRead: canMarkReadForThreadWindow,
        forceContainsLatestCalc,
        messages,
        moreToLoad,
        scrollDirection,
        validatedRange,
      })
      const after = actions.getSnapshot()
      if (why === 'cached') {
        // Recorded once the pass has landed, and in the window's terms rather than the response's.
        // A message you sent keeps the fractional ordinal it had in the outbox, so the ordinal it
        // parsed with - the server one - is not the ordinal it occupies. The prune walks the
        // window, so an entry under the parsed ordinal protects nothing and the row goes. Both are
        // recorded: whichever one the row ends up under, it counts as delivered.
        for (const m of renderedMessages) {
          cachedPassOrdinals.add(m.ordinal)
          const occupied = m.id ? getOrdinalForMessageIDInSnapshot(after, m.id) : undefined
          if (occupied) {
            cachedPassOrdinals.add(occupied)
          }
        }
      }
      // A back page can be composed entirely of messages the thread will never render: a message
      // superseded by a DELETE arrives as a hidden placeholder, becomes `deleted`, and addMessages
      // drops it. The ordinal list is then identical to what it was, so the list never fires
      // onStartReached again and scrollback stops even though the pager says there is more. Ask for
      // the next page ourselves.
      //
      // The tombstones still carry message IDs, and each page reaches further back than the last,
      // so requiring strict progress terminates: message IDs are finite and only ever decrease
      // here. Strict progress alone is a weak bound though - a channel whose history was largely
      // expunged has tens of thousands of them, which is minutes of paging off one gesture - so the
      // chain also stops after maxBackPageReloads. Stopping is safe: the reader is still pinned at
      // the top with an unchanged list, and scrolling away and back fires onStartReached again,
      // which starts a fresh chain from wherever this one left off.
      const floorAfter = after.messageOrdinals?.[0]
      const windowGrewDownward =
        floorAfter !== undefined && (floorAtLoadStart === undefined || floorAfter < floorAtLoadStart)
      if (
        scrollDirection === 'back' &&
        // The full pass is the last one of a load, so by here the whole load has been applied.
        why === 'full' &&
        moreToLoad &&
        // The floor, not the count: a page can add real messages while its `deleted` entries
        // remove more from the window, which nets negative on a count but is real progress.
        !windowGrewDownward &&
        oldestSeenThisLoad < (retryBelowMessageID ?? Number.MAX_SAFE_INTEGER) &&
        retryCount < maxBackPageReloads
      ) {
        logger.info(
          `loadMoreMessages: back page added no ordinals, reloading below ${oldestSeenThisLoad} (${
            retryCount + 1
          }/${maxBackPageReloads}): convID: ${conversationIDKey}`
        )
        // Through the action, not loadConversationThreadMessages directly: the action carries the
        // 500ms throttle and the unmount cancel(), and a long run of tombstones would otherwise
        // issue these back to back with no pacing. The throttle only ever drops a call that a
        // later load supersedes, and that load extends the window or retries in turn.
        //
        // The delay has a cost: the next page comes from a cursor the daemon holds, not one we
        // send. pgmode is SERVER (see thread-rpc), so `next` resolves against convPageStatus in the
        // service, and any first-page request resets it (applyPagerModeOutgoing in
        // go/chat/uithreadloader.go) - which every scrollDirection 'none' load is, stale and focus
        // reloads included. One landing inside the throttle window makes this retry fetch near the
        // top of the thread instead of the next page back. It fails closed rather than looping:
        // oldestSeenThisLoad is then no lower than retryBelowMessageID, so the chain stops and the
        // reader is left where another scroll gesture starts a fresh one.
        //
        // Sizing, for the same reason the chain is bounded at all: a full run is 11 sequential
        // 100-message RPCs off one gesture, several seconds of paging with nothing visible moving.
        actions.loadMoreMessages({
          ...p,
          retryBelowMessageID: oldestSeenThisLoad,
          retryCount: retryCount + 1,
        })
      }

      if (canMarkReadForThreadWindow) {
        actions.markThreadAsRead()
      }
    }

    const pagination = messageIDControl
      ? null
      : scrollDirectionToPagination(scrollDirection, numberOfMessagesToLoad)
    try {
      const results = await loadThreadNonblock({
        conversationIDKey,
        knownRemotes,
        messageIDControl,
        onCachedThread: thread => onGotThread(thread, 'cached'),
        onFullThread: thread => onGotThread(thread, 'full'),
        onThreadStatus: status => {
          logger.info(
            `loadMoreMessages: thread status received: convID: ${conversationIDKey} typ: ${status.typ}`
          )
          if (isCurrentThreadLoad()) {
            onThreadLoadStatus?.(conversationIDKey, status.typ)
          }
        },
        pagination,
        reason: threadLoadReasonToRPCReason(reason),
        waitingKey: loadingKey,
      })
      if (!isCurrentThreadLoad()) {
        return
      }
      updateInboxConversationMeta(conversationIDKey, {offline: results.offline})
    } catch (error) {
      if (!isCurrentThreadLoad()) {
        return
      }
      if (error instanceof RPCError) {
        logger.warn(`loadMoreMessages: error: ${error.desc}`)
        if (error.code === T.RPCGen.StatusCode.scchatnotinteam) {
          // We're no longer in this conv's team. Clear the persisted last-route
          // (ui.routeState2) so app startup doesn't keep restoring and reloading
          // this conv, which would re-trigger this error on every launch.
          persistRoute(true, true, () => useConfigState.getState().startup.loaded)
          navigateToInbox(true, 'maybeKickedFromTeam')
        }
        if (error.code !== T.RPCGen.StatusCode.scteamreaderror) {
          throw error
        }
      }
    } finally {
      releaseWindowGate()
    }
  }

  ignorePromise(f())
}
