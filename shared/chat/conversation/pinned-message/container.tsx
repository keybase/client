import * as Chat2Gen from '../../../actions/chat2-gen'
import * as ConfigConstants from '../../../constants/config'
import * as Constants from '../../../constants/chat2'
import * as TeamsConstants from '../../../constants/teams'
import * as Container from '../../../util/container'
import * as React from 'react'
import PinnedMessage from '.'
import type * as Types from '../../../constants/types/chat2'
import {getCanPerform} from '../../../constants/teams'

type OwnProps = {conversationIDKey: Types.ConversationIDKey}

const PinnedMessageContainer = React.memo(function PinnedMessageContainer(p: OwnProps) {
  const {conversationIDKey} = p
  const you = ConfigConstants.useCurrentUserState(s => s.username)
  const {teamname, pinnedMsg} = Constants.useContext(s => s.meta)
  const message = pinnedMsg?.message
  const yourOperations = TeamsConstants.useState(s => getCanPerform(s, teamname))
  const unpinning = Container.useAnyWaiting(Constants.waitingKeyUnpin(conversationIDKey))
  const messageID = message?.id
  const dispatch = Container.useDispatch()
  const onClick = React.useCallback(() => {
    messageID && dispatch(Chat2Gen.createReplyJump({conversationIDKey, messageID}))
  }, [dispatch, conversationIDKey, messageID])
  const onIgnore = React.useCallback(() => {
    dispatch(Chat2Gen.createIgnorePinnedMessage({conversationIDKey}))
  }, [dispatch, conversationIDKey])
  const onUnpin = React.useCallback(() => {
    dispatch(Chat2Gen.createUnpinMessage({conversationIDKey}))
  }, [dispatch, conversationIDKey])

  if (!message || !(message.type === 'text' || message.type === 'attachment')) {
    return null
  }

  const canAdminDelete = !!yourOperations?.deleteOtherMessages
  const attachment: Types.MessageAttachment | undefined =
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
