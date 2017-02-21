// @flow

import * as ChatConstants from '../../constants/chat'
import type {Props} from './list'
import type {Options} from './messages'
import {withProps} from 'recompose'

type OptionsFn = (message: ChatConstants.Message, prevMessage: ChatConstants.Message, isFirstMessage: boolean, isSelected: boolean, isScrolling: boolean, key: any, style: Object, onAction: () => void) => Options

function propsToMessageOptionsFn (props: Props): OptionsFn {
  return function (message, prevMessage, isFirstMessage, isSelected, isScrolling, key, style, onAction): Options {
    const skipMsgHeader = (message.author != null && prevMessage && prevMessage.type === 'Text' && prevMessage.author === message.author)
    const isFirstNewMessage = message.messageID != null && props.firstNewMessageID ? props.firstNewMessageID === message.messageID : false

    const options = {
      followingMap: props.followingMap,
      includeHeader: isFirstMessage || !skipMsgHeader,
      isFirstNewMessage,
      isScrolling,
      isSelected,
      key,
      message: message,
      metaDataMap: props.metaDataMap,
      onAction: onAction,
      onLoadAttachment: props.onLoadAttachment,
      onOpenConversation: props.onOpenConversation,
      onOpenInFileUI: props.onOpenInFileUI,
      onRetryAttachment: () => { message.type === 'Attachment' && props.onRetryAttachment(message) },
      onOpenInPopup: props.onOpenInPopup,
      onRetry: props.onRetryMessage,
      style,
      you: props.you,
    }
    return options
  }
}

const hoc = withProps((props: Props) => ({
  optionsFn: propsToMessageOptionsFn(props),
}))

export default hoc
