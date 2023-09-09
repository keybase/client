import * as C from '../../../constants'
import * as Constants from '../../../constants/chat2'
import * as React from 'react'
import PinnedMessage from '.'
import type * as T from '../../../constants/types'
import {getCanPerform} from '../../../constants/teams'

const PinnedMessageContainer = React.memo(function PinnedMessageContainer() {
  const conversationIDKey = C.useChatContext(s => s.id)
  const you = C.useCurrentUserState(s => s.username)
  const {teamname, pinnedMsg} = C.useChatContext(s => s.meta)
  const replyJump = C.useChatContext(s => s.dispatch.replyJump)
  const message = pinnedMsg?.message
  const yourOperations = C.useTeamsState(s => getCanPerform(s, teamname))
  const unpinning = C.useAnyWaiting(Constants.waitingKeyUnpin(conversationIDKey))
  const messageID = message?.id
  const onClick = React.useCallback(() => {
    messageID && replyJump(messageID)
  }, [replyJump, messageID])
  const onIgnore = C.useChatContext(s => s.dispatch.ignorePinnedMessage)
  const pinMessage = C.useChatContext(s => s.dispatch.pinMessage)
  const onUnpin = React.useCallback(() => {
    pinMessage()
  }, [pinMessage])

  if (!message || !(message.type === 'text' || message.type === 'attachment')) {
    return null
  }

  const canAdminDelete = !!yourOperations?.deleteOtherMessages
  const attachment: T.Chat.MessageAttachment | undefined =
    message.type === 'attachment' && message.attachmentType === 'image' ? message : undefined
  const pinnerUsername = pinnedMsg.pinnerUsername
  const author = message.author
  const imageHeight = attachment ? attachment.previewHeight : undefined
  const imageURL = attachment ? attachment.previewURL : undefined
  const imageWidth = attachment ? attachment.previewWidth : undefined
  const text =
    message.type === 'text'
      ? message.decoratedText
        ? message.decoratedText.stringValue()
        : ''
      : message.title || message.fileName

  const yourMessage = pinnerUsername === you
  const dismissUnpins = yourMessage || canAdminDelete
  const props = {
    author: author,
    dismissUnpins,
    imageHeight: imageHeight,
    imageURL: imageURL,
    imageWidth: imageWidth,
    onClick,
    onDismiss: dismissUnpins ? onUnpin : onIgnore,
    text: text,
    unpinning: unpinning,
  }
  return <PinnedMessage {...props} />
})
export default PinnedMessageContainer
