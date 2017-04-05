// @flow

import * as ChatConstants from '../../constants/chat'
import {List} from 'immutable'
import {withProps} from 'recompose'

import type {Props, OptionsFn} from './list'
import type {Options} from './messages'

function propsToMessageOptionsFn (props: Props): OptionsFn {
  return function (message, prevMessage, isFirstMessage, isSelected, isScrolling, isMeasuring, key, style, onAction, onShowEditor, isEditing = false): Options {
    const skipMsgHeader = (message.author != null && prevMessage && prevMessage.type === 'Text' && prevMessage.author === message.author)
    const isFirstNewMessage = message.messageID != null && props.firstNewMessageID ? props.firstNewMessageID === message.messageID : false

    const {
      followingMap,
      metaDataMap,
      onLoadAttachment,
      onOpenConversation,
      onOpenInFileUI,
      onOpenInPopup,
      onRetryAttachment,
      onRetryMessage,
      moreToLoad,
      you,
    } = props

    const options = {
      followingMap,
      includeHeader: isFirstMessage || !skipMsgHeader,
      isEditing,
      isFirstNewMessage,
      isScrolling,
      isMeasuring,
      isSelected,
      key,
      message,
      metaDataMap,
      moreToLoad,
      onAction,
      onLoadAttachment,
      onOpenConversation,
      onOpenInFileUI,
      onRetryAttachment: () => { message.type === 'Attachment' && onRetryAttachment(message) },
      onOpenInPopup,
      onRetry: onRetryMessage,
      onShowEditor,
      style,
      you,
    }
    return options
  }
}

function _headerMessages (moreToLoad: boolean): List<ChatConstants.Message> {
  return List([
    {type: 'ChatSecuredHeader', key: `chatSecuredHeader-${moreToLoad.toString()}`},
    {type: 'LoadingMore', key: `loadingMore-${moreToLoad.toString()}`},
  ])
}

const hoc = withProps((props: Props) => ({
  optionsFn: propsToMessageOptionsFn(props),
  headerMessages: _headerMessages(props.moreToLoad),
}))

export default hoc
