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
import {getOrdinalForMessageID} from './thread-message-state'
import {getInboxConversationMeta, updateInboxConversationMeta} from '@/chat/inbox/metadata'
import {loadThreadNonblock, threadLoadReasonToRPCReason} from './thread-rpc'
import type {
  ConversationThreadActions,
  ConversationThreadState,
  LoadMoreMessagesParams,
  ScrollDirection,
} from './thread-context'

export const numMessagesOnInitialLoad = isMobile ? 20 : 100
export const numMessagesOnScrollback = 100

const ignoreErrors = [
  T.RPCGen.StatusCode.scgenericapierror,
  T.RPCGen.StatusCode.scapinetworkerror,
  T.RPCGen.StatusCode.sctimeout,
]

// The inbox metadata store is the single owner of conversation meta; fall back to
// an empty meta for reads that predate an unbox.
const emptyConversationMeta = Meta.makeConversationMeta()
const getMeta = (id: T.Chat.ConversationIDKey) => getInboxConversationMeta(id) ?? emptyConversationMeta

const getCurrentUser = () => {
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
  const {scrollDirection = 'none', numberOfMessagesToLoad = numMessagesOnInitialLoad} = p
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
    const currentMeta = getMeta(conversationIDKey)
    if (currentMeta.membershipType === 'youAreReset' || currentMeta.rekeyers.size > 0) {
      logger.info('loadMoreMessages: bail: we are reset')
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
    let reconciled = false
    const onGotThread = (thread: string, why: string) => {
      if (!thread) {
        return
      }
      if (!isCurrentThreadLoad()) {
        logger.info(`loadMoreMessages: stale response ignored: ${why}`)
        return
      }
      if (
        protectLoadedFocusRefresh &&
        actions.getSnapshot().liveUpdateVersion !== loadStartedLiveUpdateVersion
      ) {
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
      let validatedRange: {from: T.Chat.Ordinal; to: T.Chat.Ordinal} | undefined
      if (messages.length) {
        if (scrollDirection === 'none' && !reconciled) {
          const ords = messages
            .filter(m => m.conversationMessage !== false && m.type !== 'deleted')
            .map(m => m.ordinal)
          if (ords.length > 0) {
            validatedRange = {
              from: Math.min(...ords) as T.Chat.Ordinal,
              to: Math.max(...ords) as T.Chat.Ordinal,
            }
          }
          reconciled = true
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
    }
  }

  ignorePromise(f())
}
