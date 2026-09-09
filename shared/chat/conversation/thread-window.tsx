import * as Message from '@/constants/chat/message'
import * as Meta from '@/constants/chat/meta'
import * as React from 'react'
import * as Strings from '@/constants/strings'
import * as T from '@/constants/types'
import logger from '@/logger'
import throttle from 'lodash/throttle'
import {clearChatTimeCache} from '@/util/timestamp'
import {getInboxConversationParticipants, unboxRows, updateInboxConversationMeta} from '@/chat/inbox/metadata'
import {ignorePromise} from '@/constants/utils'
import {loadThreadNonblock, threadLoadReasonToRPCReason} from './thread-rpc'
import {navigateToInbox} from '@/constants/router'
import {persistRoute} from '@/util/storeless-actions'
import {RPCError} from '@/util/errors'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useShallow} from '@/util/zustand'
import {useThreadStaleReloadListeners} from './thread-engine'
import {useUsersState} from '@/stores/users'
import type {ThreadLoadReconcile} from './thread-message-state'
import {
  getCurrentUser,
  getLastOrdinalFromSnapshot,
  getMeta,
  scrollDirectionToPagination,
} from './thread-load'
import {
  type ConversationThreadActions,
  type ConversationThreadState,
  type ScrollDirection,
  useConversationThreadActions,
  useConversationThreadSelector,
  useConversationThreadStore,
} from './thread-context'

export const numMessagesOnInitialLoad = isMobile ? 20 : 100
export const numMessagesOnScrollback = 100
// How far the no-new-ordinals back-page chain will walk on its own before handing the thread back to
// the reader. See the reload block in runThreadLoad.
export const maxBackPageReloads = 10

const emptyOrdinals: ReadonlyArray<T.Chat.Ordinal> = []

const emptyParticipantInfo: T.Chat.ParticipantInfo = {
  all: [],
  contactName: new Map(),
  name: [],
}

// Where the window the caller wants is anchored.
// - 'newest': the newest page. A 'jump to recent' reason drops the window it replaces first, since
//   the newest page is disjoint from wherever a scrolled-back reader was.
// - 'older' / 'newer': one more page past the corresponding edge of the window we hold.
// - {centeredOn}: a window around one message, which always replaces the window we hold.
export type WindowAnchor = 'newest' | 'older' | 'newer' | {centeredOn: T.Chat.MessageID}

export type WindowRequest = {anchor: WindowAnchor; reason: string}
export type RequestWindow = (p: WindowRequest) => void

export type ThreadWindow = {
  generation: number
  loaded: boolean
  moreToLoadBack: boolean
  moreToLoadForward: boolean
  ordinals: ReadonlyArray<T.Chat.Ordinal>
}

// Everything a load needs once requestWindow has turned an anchor into one. Not exported: callers
// name a place in the thread, the module decides how to fetch it.
type WindowLoad = {
  allowMarkAsRead: boolean
  centeredOn?: T.Chat.MessageID
  numberOfMessagesToLoad: number
  reason: string
  // The oldest message ID the previous attempt saw, carried by the empty-back-page reload below.
  // Each reload must reach strictly further back than that, which is what stops it looping.
  retryBelowMessageID?: T.Chat.MessageID
  // How many times the back-page reload has already chained. See maxBackPageReloads.
  retryCount: number
  scrollDirection: ScrollDirection
}

// The one record arbitrating which response may become the loaded window, alongside the store's
// `generation`.
//
// `generation` moves on every clear and on a conversation change, so a response fetched against a
// window that no longer exists is refused. It cannot separate two loads issued after the SAME
// clear, and the second one is not hypothetical: a ChatThreadsStale reload fires with an anchor of
// 'newest' and fetches a region the clear never asked for. So the refill after a clear is also
// owned - first claim wins, and only the owner may refill or release - and `nextLoadID` names the
// loads for that comparison. Only ever compared for equality, never ordered.
type WindowGate = {
  nextLoadID: number
  refillOwner: number | undefined
}

const noThreadLoadStatus = T.RPCChat.UIChatThreadStatusTyp.none

const ThreadLoadStatusContext = React.createContext<T.RPCChat.UIChatThreadStatusTyp>(noThreadLoadStatus)
ThreadLoadStatusContext.displayName = 'ThreadLoadStatusContext'

const missingRequestWindow: RequestWindow = () => {
  throw new Error('Missing ConversationThreadWindowProvider in the tree')
}

const RequestWindowContext = React.createContext<RequestWindow>(missingRequestWindow)
RequestWindowContext.displayName = 'RequestWindowContext'

export const useThreadLoadStatus = () => React.useContext(ThreadLoadStatusContext)

export const useRequestWindow = () => React.useContext(RequestWindowContext)

// The loaded window, as everything that renders it needs to see it. `generation` is the identity of
// the window itself: it moves when the window is dropped and reloaded, which is the only time a
// virtualized list has to forget the layout it measured.
export const useThreadWindow = (): ThreadWindow =>
  useConversationThreadSelector(
    useShallow((s: ConversationThreadState) => ({
      generation: s.generation,
      loaded: s.loaded,
      moreToLoadBack: s.moreToLoadBack,
      moreToLoadForward: s.moreToLoadForward,
      ordinals: s.messageOrdinals ?? emptyOrdinals,
    }))
  )

// Repeat gate for the two scroll edges. The list re-fires its edge callbacks while the same window
// is on screen, so a request that names the same ordinal count as the last one is only let through
// once the previous one has had time to answer.
const makeScrollRepeatGate = () => {
  let lastNumOrdinals = 0
  let lastTime = 0
  return (numOrdinals: number) => {
    const now = Date.now()
    if (numOrdinals !== lastNumOrdinals) {
      lastNumOrdinals = numOrdinals
      lastTime = now
      return true
    }
    const ok = now - lastTime > 500
    if (ok) {
      lastNumOrdinals = numOrdinals
      lastTime = now
    }
    return ok
  }
}

type ThreadWindowProviderProps = React.PropsWithChildren<{
  allowMarkReadOnLoad?: boolean
  id: T.Chat.ConversationIDKey
  skipThreadLoadOnSelection?: boolean
}>

export const ConversationThreadWindowProvider = (p: ThreadWindowProviderProps) => {
  const {allowMarkReadOnLoad = true, children, id, skipThreadLoadOnSelection = false} = p
  const [initialSkipThreadLoadOnSelection] = React.useState(skipThreadLoadOnSelection)
  const actions = useConversationThreadActions()
  const store = useConversationThreadStore()

  const currentIDRef = React.useRef(id)
  React.useLayoutEffect(() => {
    currentIDRef.current = id
  }, [id])
  // A load that outlives its provider must not keep chaining reloads or reporting status. The
  // generation cannot express this on its own: in StrictMode the provider mounts, unmounts and
  // remounts with the same id, and moving the generation there would discard the first RPC's
  // callbacks while the daemon deduplicates the second one and sends no data.
  const mountedRef = React.useRef(true)
  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])
  React.useEffect(() => {
    return () => {
      // Only when the conversation actually changed, for the StrictMode reason above.
      if (currentIDRef.current !== id) {
        actions.bumpWindowGeneration()
      }
    }
  }, [actions, id])

  const [statusState, setStatusState] = React.useState<{
    conversationIDKey: T.Chat.ConversationIDKey
    status: T.RPCChat.UIChatThreadStatusTyp
  }>(() => ({conversationIDKey: id, status: noThreadLoadStatus}))

  const getConversationIDKey = React.useEffectEvent(() => id)
  const isMounted = React.useEffectEvent(() => mountedRef.current)

  const onThreadLoadStatus = React.useEffectEvent(
    (conversationIDKey: T.Chat.ConversationIDKey, status: T.RPCChat.UIChatThreadStatusTyp) => {
      if (conversationIDKey !== id) {
        return
      }
      setStatusState(previous =>
        previous.conversationIDKey === conversationIDKey && previous.status === status
          ? previous
          : {conversationIDKey, status}
      )
    }
  )

  // The gate and the load throttle live together, in one object built once, because the reload
  // chain has to come back through the throttle: a long run of tombstones would otherwise issue its
  // pages back to back with no pacing.
  const [loader] = React.useState(() => {
    const gate: WindowGate = {nextLoadID: 0, refillOwner: undefined}
    const runNow = (load: WindowLoad) => {
      runThreadWindowLoad({
        actions,
        conversationIDKey: getConversationIDKey(),
        gate,
        load,
        isMounted,
        onThreadLoadStatus,
        reload: loadWindow,
        store,
      })
    }
    const throttled = throttle(runNow, 500)
    // The clearing requests (a centered jump, jump to recent) bypass the throttle: they empty the
    // window before loading, and a trailing-edge throttle would drop the reload that refills it.
    function loadWindow(load: WindowLoad) {
      if (load.centeredOn || load.reason === 'jump to recent') {
        throttled.cancel()
        runNow(load)
      } else {
        throttled(load)
      }
    }
    return {
      cancel: () => {
        throttled.cancel()
      },
      loadWindow,
      releaseRefillOwner: () => {
        gate.refillOwner = undefined
      },
    }
  })
  const {loadWindow} = loader
  React.useEffect(() => () => loader.cancel(), [loader])

  // One gate per edge: a back page and a forward page carrying the same ordinal count are two
  // different requests, and sharing a gate would let either swallow the other.
  const [olderGate] = React.useState(makeScrollRepeatGate)
  const [newerGate] = React.useState(makeScrollRepeatGate)

  // Drop the window before reloading. Both callers reload a region disjoint from the one being
  // dropped - a centered jump an arbitrary one, jump to recent the newest page - so merging the two
  // would leave ordinals with a hole through the middle.
  const clearWindow = React.useEffectEvent(() => {
    loader.releaseRefillOwner()
    actions.messagesClear()
  })

  const onRequestWindow = React.useEffectEvent((request: WindowRequest) => {
    const {anchor, reason} = request
    if (typeof anchor === 'object') {
      clearWindow()
      loadWindow({
        allowMarkAsRead: true,
        centeredOn: anchor.centeredOn,
        numberOfMessagesToLoad: numMessagesOnInitialLoad,
        reason,
        retryCount: 0,
        scrollDirection: 'none',
      })
      return
    }
    const snapshot = store.getState()
    const numOrdinals = snapshot.messageOrdinals?.length ?? 0
    switch (anchor) {
      case 'newest': {
        if (reason === 'jump to recent') {
          actions.setMarkReadBlocked(false)
          clearWindow()
        }
        loadWindow({
          // Only the automatic loads this module issues itself are held back by the provider's
          // allowMarkReadOnLoad; a reader asking for the newest page has asked to be caught up.
          allowMarkAsRead: true,
          numberOfMessagesToLoad: numMessagesOnInitialLoad,
          reason,
          retryCount: 0,
          scrollDirection: 'none',
        })
        return
      }
      case 'older': {
        if (!snapshot.moreToLoadBack) {
          logger.info('requestWindow: bail: scrolling back and at the end')
          return
        }
        if (!numOrdinals || !olderGate(numOrdinals)) {
          return
        }
        loadWindow({
          allowMarkAsRead: true,
          numberOfMessagesToLoad: numMessagesOnScrollback,
          reason,
          retryCount: 0,
          scrollDirection: 'back',
        })
        return
      }
      case 'newer': {
        if (!snapshot.moreToLoadForward) {
          return
        }
        if (!numOrdinals || !newerGate(numOrdinals)) {
          return
        }
        loadWindow({
          allowMarkAsRead: true,
          numberOfMessagesToLoad: numMessagesOnScrollback,
          reason,
          retryCount: 0,
          scrollDirection: 'forward',
        })
        return
      }
    }
  })

  // Stable identity: the context value must not change every render, or every consumer re-renders.
  const [requestWindow] = React.useState<RequestWindow>(
    () => (request: WindowRequest) => onRequestWindow(request)
  )

  const reloadStaleThread = React.useEffectEvent(() => {
    loadWindow({
      allowMarkAsRead: allowMarkReadOnLoad,
      numberOfMessagesToLoad: numMessagesOnInitialLoad,
      reason: 'got stale',
      retryCount: 0,
      scrollDirection: 'none',
    })
  })
  useThreadStaleReloadListeners(id, reloadStaleThread)

  const selectConversation = React.useEffectEvent(() => {
    clearChatTimeCache()
    unboxRows([id])
    const username = useCurrentUserState.getState().username
    const participantInfo = getInboxConversationParticipants(id) ?? emptyParticipantInfo
    const otherParticipants = Meta.getRowParticipants(participantInfo, username || '')
    if (otherParticipants.length === 1) {
      const otherUsername = otherParticipants[0] || ''
      if (otherUsername && !otherUsername.includes('@')) {
        useUsersState.getState().dispatch.getBio(otherUsername)
      }
    }
    if (initialSkipThreadLoadOnSelection) {
      return
    }
    loadWindow({
      allowMarkAsRead: allowMarkReadOnLoad,
      numberOfMessagesToLoad: numMessagesOnInitialLoad,
      reason: 'focused',
      retryCount: 0,
      scrollDirection: 'none',
    })
  })
  React.useEffect(() => {
    logger.info(
      `ConversationThreadWindowProvider: selecting thread: ${id} skipThreadLoad=${initialSkipThreadLoadOnSelection}`
    )
    selectConversation()
  }, [id, initialSkipThreadLoadOnSelection])

  const status = statusState.conversationIDKey === id ? statusState.status : noThreadLoadStatus

  return (
    <RequestWindowContext value={requestWindow}>
      <ThreadLoadStatusContext value={status}>{children}</ThreadLoadStatusContext>
    </RequestWindowContext>
  )
}

// The whole of the arbitration, in one place. Split out of the provider so the rules read as one
// sequence rather than as a component body, and so a test can drive them without React.
export const runThreadWindowLoad = (p: {
  actions: ConversationThreadActions
  conversationIDKey: T.Chat.ConversationIDKey
  gate: WindowGate
  load: WindowLoad
  isMounted: () => boolean
  onThreadLoadStatus: (
    conversationIDKey: T.Chat.ConversationIDKey,
    status: T.RPCChat.UIChatThreadStatusTyp
  ) => void
  reload: (load: WindowLoad) => void
  store: {getState: () => ConversationThreadState}
}) => {
  const {actions, conversationIDKey, gate, isMounted, load, onThreadLoadStatus, reload, store} = p
  if (!T.Chat.isValidConversationIDKey(conversationIDKey)) {
    return
  }
  const {
    allowMarkAsRead,
    centeredOn,
    numberOfMessagesToLoad,
    reason,
    retryBelowMessageID,
    retryCount,
    scrollDirection,
  } = load

  const f = async () => {
    const loadStartedSnapshot = store.getState()
    const generationAtLoadStart = loadStartedSnapshot.generation
    // Whether the window this load was fetched against is still the loaded one. The generation
    // moves on every clear and on a conversation change, so a response that would repopulate a
    // window the reader has already left - jump to recent, a centered jump, a different
    // conversation - is refused rather than merged into whatever replaced it.
    const ownsTheWindow = () => store.getState().generation === generationAtLoadStart
    const isCurrentLoad = () => isMounted() && ownsTheWindow()

    // applyThreadLoad drops the window gate when a load refills the window, but a load can end
    // without ever applying: offline, scchatnotinteam, a response carrying no thread, or a bail
    // before the RPC is even made. Left alone the gate would keep dropping notifications for the
    // life of the provider, which is a thread that silently stops receiving messages.
    //
    // Claimed here, before the first await, rather than when a response arrives: both clearing
    // requests bypass the load throttle and call in synchronously, so the reload the clear issued
    // is always the first to get here, and a load that ends without ever applying still has to be
    // the one that releases.
    const loadID = gate.nextLoadID++
    if (loadStartedSnapshot.windowCleared && gate.refillOwner === undefined) {
      gate.refillOwner = loadID
    }
    // Not gated on the provider still being mounted: an unmounted load is exactly the one with
    // nothing coming after it, so leaving the gate up would strand the window for good.
    const releaseWindowGate = () => {
      if (!ownsTheWindow() || !store.getState().windowCleared) {
        return
      }
      // An unclaimed gate is released by whoever settles first: nothing claimed it, so there is no
      // reload in flight to protect, and leaving it up would strand the thread.
      if (gate.refillOwner !== undefined && gate.refillOwner !== loadID) {
        return
      }
      gate.refillOwner = undefined
      actions.releaseWindowGate()
    }
    // Every bail from here on releases: the clear issues its reload synchronously, so if that
    // reload is the one bailing there is nothing else coming to take the gate down, and the thread
    // stops receiving messages for good.
    if (!isCurrentLoad()) {
      logger.info('requestWindow: bail: stale thread load')
      releaseWindowGate()
      return
    }

    const currentMeta = getMeta(conversationIDKey)
    if (currentMeta.membershipType === 'youAreReset' || currentMeta.rekeyers.size > 0) {
      logger.info('requestWindow: bail: we are reset')
      releaseWindowGate()
      return
    }
    const loadStartedLiveUpdateVersion = loadStartedSnapshot.liveUpdateVersion
    // A refresh of a window we already hold must not overwrite what a notification streamed into it
    // while the RPC was out. Kept apart from the generation on purpose: this is content churn
    // inside one window, not a new window, and folding the two would remount the thread list on
    // every incoming message.
    const protectLoadedFocusRefresh =
      loadStartedSnapshot.loaded &&
      scrollDirection === 'none' &&
      !centeredOn &&
      (reason === 'focused' || reason === 'tab selected')
    logger.info(
      `requestWindow: calling rpc convo: ${conversationIDKey} num: ${numberOfMessagesToLoad} reason: ${reason}`
    )

    const loadingKey = Strings.waitingKeyChatThreadLoad(conversationIDKey)
    // What this load has put in the window, filled in by addMessagesToThreadState as each pass
    // applies. Once the service has sent a cached thread it switches the full response to
    // INCREMENTAL, which walks the authoritative window and sends only the messages that cached
    // pass did not already carry unchanged (mergeLocalRemoteThread in go/chat/uithreadloader.go,
    // where localSentThread is that exact pass). Neither pass is a whole window on its own, so the
    // two are gathered here and the last one reconciles against the both of them.
    const carried = new Set<T.Chat.Ordinal>()
    // A load is all or nothing. Once one of its passes is turned away, the rest of them are too:
    // the service filters each pass against what it has already sent this load, so the ones that
    // follow a refused pass are a subset of a window we never took, and both ways of using them
    // are wrong. Merging one into whatever refilled the window in the meantime is the disjoint
    // window this whole invariant exists to prevent; reconciling against one takes out every row
    // between the few messages it happens to carry.
    let refusedAPass = false
    // Whether the service's cached goroutine reported at all - with a thread, or with the nil it
    // sends when the local cache had nothing. It is the only evidence the client gets that the
    // full pass was not filtered behind our back: the service records the cached thread as sent
    // before it marshals it, so a marshal failure there leaves us with an INCREMENTAL full pass
    // and no sign of the pass it was filtered against (LoadNonblock in
    // go/chat/uithreadloader.go). No report, no reconciling.
    let sawCachedReport = false
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
      if (refusedAPass) {
        logger.info(`requestWindow: pass ignored, an earlier one of this load was: ${why}`)
        return
      }
      const refuse = (msg: string) => {
        refusedAPass = true
        logger.info(msg)
      }
      if (!isCurrentLoad()) {
        refuse(`requestWindow: response ignored, the window it was fetched against is gone: ${why}`)
        return
      }
      // The generation cannot separate two loads issued after the same clear, and the second one is
      // not hypothetical: a ChatThreadsStale reload fetches the newest page, not the region the
      // clear asked for. If it answers first it would fill the cleared window with that disjoint
      // page and drop the gate, and the reload the clear issued would then merge its own page into
      // the leftovers. While the gate is up only its owner may refill the window; once the owner
      // settles the gate is down and everyone applies normally again.
      const snapshotAtResponse = store.getState()
      if (
        snapshotAtResponse.windowCleared &&
        gate.refillOwner !== undefined &&
        gate.refillOwner !== loadID
      ) {
        refuse(`requestWindow: response ignored, another load owns the window: ${why}`)
        return
      }
      if (protectLoadedFocusRefresh && snapshotAtResponse.liveUpdateVersion !== loadStartedLiveUpdateVersion) {
        refuse(
          `requestWindow: stale response ignored after live update: ${why} reason=${reason} convID=${conversationIDKey}`
        )
        return
      }

      const {username, devicename} = getCurrentUser()
      const {messages, pagination} = Message.parseUIMessagesJSON(
        conversationIDKey,
        thread,
        username,
        devicename,
        () => getLastOrdinalFromSnapshot(store.getState())
      )
      const moreToLoad = pagination ? !pagination.last : true
      const canMarkReadForThreadWindow =
        allowMarkAsRead &&
        !centeredOn &&
        scrollDirection !== 'back' &&
        reason !== 'findNewestConversation' &&
        reason !== 'findNewestConversationFromLayout'
      // Reconciling is only safe against a whole window, and a single pass is not one: the cached
      // pass is whatever the local cache holds, gaps included, and the full pass behind it carries
      // only what changed. The full pass is the last one, so it is the one that prunes - against
      // everything both passes delivered. Waiting instead for a pass with no cached one before it
      // would leave the stale-row cleanup running on cold caches only, which is where ghost rows
      // are least likely to be: a reopened conversation is warm every time.
      const reconcile: ThreadLoadReconcile | undefined =
        scrollDirection === 'none' ? {carried, prune: why === 'full' && sawCachedReport} : undefined
      for (const m of messages) {
        if (m.id > 0 && m.id < oldestSeenThisLoad) {
          oldestSeenThisLoad = m.id
        }
      }
      if (mayJoinWindow(snapshotAtResponse, messages, scrollDirection)) {
        actions.applyThreadLoad({
          centered: !!centeredOn,
          disableActiveMarkRead: !allowMarkAsRead || !!centeredOn,
          enableActiveMarkRead: canMarkReadForThreadWindow,
          messages,
          moreToLoad,
          reconcile,
          scrollDirection,
        })
        // Only a pass that actually rendered something drops the gate. A cold cache sends an empty
        // cached pass ahead of the full response, and a page can be all tombstones: dropping the
        // gate on either would let a notification arriving before the real page install itself as
        // the whole window and strand once that page lands. A load that ends without ever producing
        // an ordinal releases the gate in its own finally instead.
        if (renderedMessages(messages).length) {
          gate.refillOwner = undefined
          actions.releaseWindowGate()
        }
      }
      const after = store.getState()
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
          `requestWindow: back page added no ordinals, reloading below ${oldestSeenThisLoad} (${
            retryCount + 1
          }/${maxBackPageReloads}): convID: ${conversationIDKey}`
        )
        // Back through the throttled entry point, not straight into another load: a long run of
        // tombstones would otherwise issue these back to back with no pacing. The throttle only
        // ever drops a call that a later load supersedes, and that load extends the window or
        // retries in turn.
        //
        // The delay has a cost: the next page comes from a cursor the daemon holds, not one we
        // send. pgmode is SERVER (see thread-rpc), so `next` resolves against convPageStatus in the
        // service, and any first-page request resets it (applyPagerModeOutgoing in
        // go/chat/uithreadloader.go) - which every 'none' load is, stale and focus reloads
        // included. One landing inside the throttle window makes this retry fetch near the top of
        // the thread instead of the next page back. It fails closed rather than looping:
        // oldestSeenThisLoad is then no lower than retryBelowMessageID, so the chain stops and the
        // reader is left where another scroll gesture starts a fresh one.
        //
        // Sizing, for the same reason the chain is bounded at all: a full run is 11 sequential
        // 100-message RPCs off one gesture, several seconds of paging with nothing visible moving.
        reload({...load, retryBelowMessageID: oldestSeenThisLoad, retryCount: retryCount + 1})
      }

      if (canMarkReadForThreadWindow) {
        actions.markThreadAsRead()
      }
    }

    const messageIDControl = centeredOn
      ? {mode: T.RPCChat.MessageIDControlMode.centered, num: numberOfMessagesToLoad, pivot: centeredOn}
      : null
    const pagination = messageIDControl
      ? null
      : scrollDirectionToPagination(scrollDirection, numberOfMessagesToLoad)
    try {
      const results = await loadThreadNonblock({
        conversationIDKey,
        messageIDControl,
        onCachedThread: thread => {
          sawCachedReport = true
          onGotThread(thread, 'cached')
        },
        onFullThread: thread => onGotThread(thread, 'full'),
        onThreadStatus: status => {
          logger.info(
            `requestWindow: thread status received: convID: ${conversationIDKey} typ: ${status.typ}`
          )
          if (isCurrentLoad()) {
            onThreadLoadStatus(conversationIDKey, status.typ)
          }
        },
        pagination,
        reason: threadLoadReasonToRPCReason(reason),
        waitingKey: loadingKey,
      })
      if (!isCurrentLoad()) {
        return
      }
      updateInboxConversationMeta(conversationIDKey, {offline: results.offline})
    } catch (error) {
      if (!isCurrentLoad()) {
        return
      }
      if (error instanceof RPCError) {
        logger.warn(`requestWindow: error: ${error.desc}`)
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

const renderedMessages = (messages: ReadonlyArray<T.Chat.Message>) =>
  messages.filter(m => m.conversationMessage !== false && m.type !== 'deleted')

// Whether a page may join the window we hold, judged on what it carried rather than on the state of
// the window.
//
// A 'none' load fetches the newest page, and a window with more to load forward does not reach it.
// Merging the two leaves ordinals with a hole through the middle, and the window then reports
// itself as containing the latest message - which is the gap this whole invariant is about,
// arriving through a ChatThreadsStale reload while the reader sits on a search result. Both
// conditions are needed: a window that already reaches the newest message merges fine, and so does
// a page that overlaps what we hold, however far back the reader is.
const mayJoinWindow = (
  snapshot: ConversationThreadState,
  messages: ReadonlyArray<T.Chat.Message>,
  scrollDirection: ScrollDirection
) => {
  const rendered = renderedMessages(messages)
  const windowOrdinals = snapshot.messageOrdinals
  const floor = windowOrdinals?.[0]
  const ceiling = windowOrdinals?.[windowOrdinals.length - 1]
  if (
    scrollDirection !== 'none' ||
    !rendered.length ||
    !snapshot.moreToLoadForward ||
    floor === undefined ||
    ceiling === undefined
  ) {
    return true
  }
  let lowest = Number.MAX_SAFE_INTEGER
  let highest = Number.MIN_SAFE_INTEGER
  for (const m of rendered) {
    lowest = Math.min(lowest, m.ordinal)
    highest = Math.max(highest, m.ordinal)
  }
  if (lowest > ceiling || highest < floor) {
    logger.info(
      `requestWindow: page ${lowest}-${highest} does not reach window ${floor}-${ceiling}, ignoring`
    )
    return false
  }
  return true
}
