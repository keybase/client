import * as C from '@/constants'
import * as Common from '@/constants/chat/common'
import * as T from '@/constants/types'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import {ignorePromise} from '@/constants/utils'
import {getClientPrevFromThread} from './attachment-actions'
import {
  useConversationThreadActions,
  useConversationThreadID,
  useConversationThreadSelector,
} from './thread-context'

type SendTextParams = {
  clientPrev: T.Chat.MessageID
  conversationIDKey: T.Chat.ConversationIDKey
  ephemeralLifetime: number
  onRestoreText?: (text: string) => void
  replyTo?: T.Chat.MessageID
  text: string
  tlfName: string
  waitingKey?: string
}

const sendTextMessageStoreless = (p: SendTextParams) => {
  const f = async () => {
    const ephemeralData = p.ephemeralLifetime !== 0 ? {ephemeralLifetime: p.ephemeralLifetime} : {}
    try {
      await T.RPCChat.localPostTextNonblockRpcListener({
        customResponseIncomingCallMap: {
          'chat.1.chatUi.chatStellarDataConfirm': (_, response) => {
            response.result(false)
          },
          'chat.1.chatUi.chatStellarDataError': (_, response) => {
            response.result(false)
          },
        },
        incomingCallMap: {
          'chat.1.chatUi.chatStellarDone': ({canceled}) => {
            if (canceled) {
              p.onRestoreText?.(p.text)
            }
          },
          'chat.1.chatUi.chatStellarShowConfirm': () => {},
        },
        params: {
          ...ephemeralData,
          body: p.text,
          clientPrev: p.clientPrev,
          conversationID: T.Chat.keyToConversationID(p.conversationIDKey),
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
          outboxID: undefined,
          replyTo: p.replyTo,
          tlfName: p.tlfName,
          tlfPublic: false,
        },
        waitingKey: p.waitingKey,
      })
      logger.info('success')
    } catch {
      logger.info('error')
    }
    logger.info('non-empty text?', p.text.length > 0)
  }
  ignorePromise(f())
}

export const sendTextToConversation = (
  conversationIDKey: T.Chat.ConversationIDKey,
  tlfName: string,
  text: string
) => {
  sendTextMessageStoreless({
    clientPrev: T.Chat.numberToMessageID(0),
    conversationIDKey,
    ephemeralLifetime: 0,
    text,
    tlfName,
  })
}

export const useConversationSendActions = () => {
  const conversationIDKey = useConversationThreadID()
  const actions = useConversationThreadActions()
  const {explodingMode, messageMap, messageOrdinals, meta} = useConversationThreadSelector(
    C.useShallow(s => ({
      explodingMode: s.explodingMode,
      messageMap: s.messageMap,
      messageOrdinals: s.messageOrdinals,
      meta: s.meta,
    }))
  )
  const clientPrev = getClientPrevFromThread(messageMap, messageOrdinals)

  const editMessage = (ordinal: T.Chat.Ordinal, text: string) => {
    const message = messageMap.get(ordinal)
    if (message?.type !== 'text' && message?.type !== 'attachment') {
      return
    }
    if (message.type === 'text' && message.text.stringValue() === text) {
      return
    }
    if (message.type === 'attachment' && message.title === text) {
      return
    }
    actions.setMessageSubmitState(ordinal, 'editing')
    const f = async () => {
      await T.RPCChat.localPostEditNonblockRpcPromise({
        body: text,
        clientPrev,
        conversationID: T.Chat.keyToConversationID(conversationIDKey),
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
        outboxID: Common.generateOutboxID(),
        target: {
          messageID: message.id,
          outboxID: message.outboxID ? T.Chat.outboxIDToRpcOutboxID(message.outboxID) : undefined,
        },
        tlfName: meta.tlfname,
        tlfPublic: false,
      })
    }
    ignorePromise(f())
  }

  const sendMessage = (
    text: string,
    context?: {
      editingOrdinal?: T.Chat.Ordinal
      onRestoreText?: (text: string) => void
      replyToOrdinal?: T.Chat.Ordinal
    }
  ) => {
    const editOrdinal = context?.editingOrdinal
    if (editOrdinal) {
      editMessage(editOrdinal, text)
      return
    }
    const replyToOrdinal = context?.replyToOrdinal
    const replyTo = messageMap.get(replyToOrdinal ?? T.Chat.numberToOrdinal(0))?.id
    sendTextMessageStoreless({
      clientPrev,
      conversationIDKey,
      ephemeralLifetime: explodingMode,
      onRestoreText: context?.onRestoreText,
      replyTo,
      text,
      tlfName: meta.tlfname,
    })
  }

  const sendGiphyResult = (result: T.RPCChat.GiphySearchResult, replyToOrdinal?: T.Chat.Ordinal) => {
    const f = async () => {
      try {
        await T.RPCChat.localTrackGiphySelectRpcPromise({result})
      } catch {}
      const replyTo = messageMap.get(replyToOrdinal ?? T.Chat.numberToOrdinal(0))?.id
      sendTextMessageStoreless({
        clientPrev,
        conversationIDKey,
        ephemeralLifetime: explodingMode,
        replyTo,
        text: result.targetUrl,
        tlfName: meta.tlfname,
      })
    }
    ignorePromise(f())
  }

  const sendAudioRecording = async (path: string, duration: number, amps: ReadonlyArray<number>) => {
    const outboxID = Common.generateOutboxID()
    if (!meta.tlfname) {
      logger.warn('sendAudioRecording: no meta for send')
      return
    }

    const callerPreview = await T.RPCChat.localMakeAudioPreviewRpcPromise({amps, duration})
    const ephemeralData = explodingMode !== 0 ? {ephemeralLifetime: explodingMode} : {}
    try {
      await T.RPCChat.localPostFileAttachmentLocalNonblockRpcPromise({
        arg: {
          ...ephemeralData,
          callerPreview,
          conversationID: T.Chat.keyToConversationID(conversationIDKey),
          filename: path,
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
          metadata: new Uint8Array(),
          outboxID,
          title: '',
          tlfName: meta.tlfname,
          visibility: T.RPCGen.TLFVisibility.private,
        },
        clientPrev,
      })
    } catch (error) {
      if (error instanceof RPCError) {
        logger.warn('sendAudioRecording: failed to send attachment: ' + error.message)
      }
    }
  }

  return {sendAudioRecording, sendGiphyResult, sendMessage}
}
