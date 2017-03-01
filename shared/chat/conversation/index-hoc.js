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
      onSelectAttachment,
      selectedConversation,
      sidePanelOpen,
      validated,
      you,
    } = props

    const listProps: $Shape<ListProps> = {
      firstNewMessageID,
      followingMap,
      listScrollDownState,
      messages,
      moreToLoad,
      metaDataMap,
      muted,
      onDeleteMessage,
      onEditMessage,
      onFocusInput: () => console.log('todo'),
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
      onEditLastMessage: () => console.log('todo'),
      onPostMessage,
      onSelectAttachment,
      selectedConversation,
    }

    return {inputProps, listProps}
  }
)

export default hoc
