import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import * as React from 'react'
import PinnedMessage from '.'
import type * as Types from '../../../constants/types/chat2'
import {getCanPerform} from '../../../constants/teams'
import shallowEqual from 'shallowequal'

type OwnProps = {conversationIDKey: Types.ConversationIDKey}

const PinnedMessageContainer = React.memo(function PinnedMessageContainer(p: OwnProps) {
  const {conversationIDKey} = p
  const you = Container.useSelector(state => state.config.username)
  const {teamname, pinnedMsg} = Container.useSelector(state => {
    const meta = Constants.getMeta(state, conversationIDKey)
    return {pinnedMsg: meta?.pinnedMsg, teamname: meta?.teamname}
  }, shallowEqual)
  const message = pinnedMsg?.message
  const yourOperations = Container.useSelector(state => getCanPerform(state, teamname))
  const unpinning = Container.useSelector(state =>
    Container.anyWaiting(state, Constants.waitingKeyUnpin(conversationIDKey))
  )
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
