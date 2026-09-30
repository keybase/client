import * as Common from '@/constants/chat/common'
import * as T from '@/constants/types'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import {ignorePromise} from '@/constants/utils'
import {getClientPrevFromThread} from './client-prev'
import {getChatRpc, type ChatThreadRpc, type PostTextParams} from './chat-rpc'
import {removeDismissals, restoreDismissals, suppressedURLsOf, type SuppressSnapshot} from './unfurl-preview-state'
import {useInboxMetadataState} from '../inbox/metadata-store'
import {
  useConversationThreadActions,
  useConversationThreadID,
  useConversationThreadStore,
} from './thread-context'

type SendTextParams = Omit<PostTextParams, 'onStellarCanceled'> & {
  onRestoreText?: (text: string) => void
  onSent?: () => void
}

const sendText = (rpc: ChatThreadRpc, p: SendTextParams) => {
  const f = async () => {
    const {onRestoreText, onSent, ...params} = p
    // a canceled stellar confirm resolves the rpc normally but posts nothing, so it is
    // not a send and must not be treated as one
    const sendState = {stellarCanceled: false}
    try {
      await rpc.postText({
        ...params,
        onStellarCanceled: () => {
          sendState.stellarCanceled = true
          onRestoreText?.(p.text)
        },
      })
      if (!sendState.stellarCanceled) {
        onSent?.()
      }
      logger.info('success')
    } catch {
      logger.info('error')
    }
    logger.info('non-empty text?', p.text.length > 0)
  }
  ignorePromise(f())
}

// never exploding, and with no clientPrev
const plainText = (conversationIDKey: T.Chat.ConversationIDKey, tlfName: string, text: string) => ({
  clientPrev: T.Chat.numberToMessageID(0),
  conversationIDKey,
  ephemeralLifetime: 0,
  text,
  tlfName,
})

export const sendTextToConversation = (
  conversationIDKey: T.Chat.ConversationIDKey,
  tlfName: string,
  text: string
) => {
  sendText(getChatRpc(), plainText(conversationIDKey, tlfName, text))
}

// A screen kept through an account switch sends nothing: every call goes through the thread's rpc.
export const useConversationSendActions = () => {
  const conversationIDKey = useConversationThreadID()
  const actions = useConversationThreadActions()
  const {rpc} = actions
  // Callbacks-only hook: read thread/meta state lazily so per-row callers
  // (coinflip rows, the input provider) don't re-render on thread churn.
  const threadStore = useConversationThreadStore()
  const getTlfName = () => useInboxMetadataState.getState().metas.get(conversationIDKey)?.tlfname ?? ''
  const getClientPrev = () => {
    const {messageMap, messageOrdinals} = threadStore.getState()
    return getClientPrevFromThread(messageMap, messageOrdinals)
  }

  const editMessage = (ordinal: T.Chat.Ordinal, text: string) => {
    const message = threadStore.getState().messageMap.get(ordinal)
    if (message?.type !== 'text' && message?.type !== 'attachment') {
      return
    }
    if (message.type === 'text' && message.text.stringValue() === text) {
      return
    }
    if (message.type === 'attachment' && message.title === text) {
      return
    }
    // a failed or pending row gets its state back if the edit fails, so it can still be retried
    const priorSubmitState = message.submitState
    actions.setMessageSubmitState(ordinal, 'editing')
    const f = async () => {
      try {
        await rpc.postEdit({
          clientPrev: getClientPrev(),
          conversationIDKey,
          messageID: message.id,
          messageOutboxID: message.outboxID,
          text,
          tlfName: getTlfName(),
        })
      } catch (error) {
        // only undoes our own mark: a row that moved on since keeps its new state
        if (threadStore.getState().messageMap.get(ordinal)?.submitState === 'editing') {
          actions.setMessageSubmitState(ordinal, priorSubmitState)
        }
        if (error instanceof RPCError) {
          logger.warn(`editMessage: failed to edit: ${error.message}`)
        } else {
          throw error
        }
      }
    }
    ignorePromise(f())
  }

  const sendMessage = (
    text: string,
    context?: {
      editingOrdinal?: T.Chat.Ordinal
      onRestoreText?: (text: string) => void
      replyToOrdinal?: T.Chat.Ordinal
      unfurlSuppress?: SuppressSnapshot
    }
  ) => {
    const editOrdinal = context?.editingOrdinal
    if (editOrdinal) {
      // unfurlSuppress is dropped here on purpose: postEditNonblock has no such param, so
      // dismissing a preview card while editing cannot reach the service. carrying it
      // would need the protocol change, not just plumbing on this side.
      editMessage(editOrdinal, text)
      return
    }
    const replyToOrdinal = context?.replyToOrdinal
    const replyTo = threadStore.getState().messageMap.get(replyToOrdinal ?? T.Chat.numberToOrdinal(0))?.id
    // only what the caller snapshotted. a send that carries no snapshot is not the composer
    // sending its own text (a coinflip resend, say), and the composer's dismissals have
    // nothing to do with it
    const snapshot = context?.unfurlSuppress ?? {dismissed: [], failed: []}
    const unfurlSuppress = suppressedURLsOf(snapshot)
    const onRestoreText = context?.onRestoreText
    sendText(rpc, {
      clientPrev: getClientPrev(),
      conversationIDKey,
      ephemeralLifetime: threadStore.getState().explodingMode,
      onRestoreText: onRestoreText
        ? (restored: string) => {
            restoreDismissals(conversationIDKey, snapshot.dismissed)
            onRestoreText(restored)
          }
        : undefined,
      onSent: () => {
        // the dismissals only: a failure is never in `dismissed`, and the url may have been
        // dismissed afresh while this send was in flight
        removeDismissals(conversationIDKey, snapshot.dismissed)
      },
      replyTo,
      text,
      tlfName: getTlfName(),
      unfurlSuppress,
    })
  }

  const sendGiphyResult = (result: T.RPCChat.GiphySearchResult, replyToOrdinal?: T.Chat.Ordinal) => {
    const f = async () => {
      try {
        await rpc.trackGiphySelect(result)
      } catch {}
      const replyTo = threadStore.getState().messageMap.get(replyToOrdinal ?? T.Chat.numberToOrdinal(0))?.id
      sendText(rpc, {
        clientPrev: getClientPrev(),
        conversationIDKey,
        ephemeralLifetime: threadStore.getState().explodingMode,
        replyTo,
        text: result.targetUrl,
        tlfName: getTlfName(),
      })
    }
    ignorePromise(f())
  }

  const sendAudioRecording = async (path: string, duration: number, amps: ReadonlyArray<number>) => {
    const outboxID = Common.generateOutboxID()
    const tlfName = getTlfName()
    if (!tlfName) {
      logger.warn('sendAudioRecording: no meta for send')
      return
    }

    try {
      const callerPreview = await rpc.makeAudioPreview(amps, duration)
      // The thread's rpc would post nothing now, but it would never answer either: return, so the
      // recorder waiting on this send still cleans up after itself.
      if (actions.isRetired()) {
        return
      }
      await rpc.postAttachment({
        callerPreview,
        clientPrev: getClientPrev(),
        conversationIDKey,
        ephemeralLifetime: threadStore.getState().explodingMode,
        filename: path,
        outboxID,
        title: '',
        tlfName,
      })
    } catch (error) {
      if (error instanceof RPCError) {
        logger.warn('sendAudioRecording: failed to send attachment: ' + error.message)
      } else {
        logger.error('sendAudioRecording: failed to send attachment', error)
      }
    }
  }

  // a plain wave: never exploding, whatever the composer's mode
  const sendWave = () => {
    sendText(rpc, plainText(conversationIDKey, getTlfName(), ':wave:'))
  }

  return {sendAudioRecording, sendGiphyResult, sendMessage, sendWave}
}
