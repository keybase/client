// @flow

import {withProps} from 'recompose'
import type {Props} from './index'
import type {Props as ListProps} from './list'
import type {Props as InputProps} from './input'

const hoc = withProps(
  (props: Props) => {
    const {
      emojiPickerOpen,
      firstNewMessageID,
      followingMap,
      inputText,
      isLoading,
      listScrollDownState,
      messages,
      moreToLoad,
      metaDataMap,
      muted,
      onAttach,
      onDeleteMessage,
      onEditMessage,
      onLoadAttachment,
      onLoadMoreMessages,
      onOpenConversation,
      onOpenInFileUI,
      onOpenInPopup,
      onPostMessage,
      onRetryAttachment,
      onRetryMessage,
      selectedConversation,
      sidePanelOpen,
      validated,
      you,
    } = props

    const listProps: ListProps = {
      firstNewMessageID,
      followingMap,
      listScrollDownState,
      messages,
      moreToLoad,
      metaDataMap,
      muted,
      onDeleteMessage,
      onEditMessage,
      onLoadAttachment,
      onLoadMoreMessages,
      onOpenConversation,
      onOpenInFileUI,
      onOpenInPopup,
      onRetryAttachment,
      onRetryMessage,
      selectedConversation,
      sidePanelOpen,
      validated,
      you,
    }

    const inputProps: InputProps = {
      defaultText: inputText,
      emojiPickerOpen,
      isLoading,
      onAttach,
      onEditMessage,
      onPostMessage,
      selectedConversation,
    }

    return {inputProps, listProps}
  }
)

export default hoc
