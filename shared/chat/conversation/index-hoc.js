// @flow

import * as Immutable from 'immutable'
import {compose, withState, withProps} from 'recompose'
import * as Constants from '../../constants/chat'

import type {Props} from './index'
import type {Props as ListProps} from './list'
import type {Props as InputProps} from './input'
import type {Props as HeaderProps} from './header'

const {participantFilter, usernamesToUserListItem} = Constants

const propsHoc = withProps(
  (props) => {
    const {
      editLastMessageCounter,
      emojiPickerOpen,
      firstNewMessageID,
      focusInputCounter,
      followingMap,
      inputText,
      isLoading,
      listScrollDownState,
      messages,
      metaDataMap,
      moreToLoad,
      muted,
      onAttach,
      onBack,
      onDeleteMessage,
      onEditLastMessage,
      onEditMessage,
      onFocusInput,
      onLoadAttachment,
      onLoadMoreMessages,
      onOpenConversation,
      onOpenFolder,
      onOpenInFileUI,
      onOpenInPopup,
      onPostMessage,
      onRetryAttachment,
      onRetryMessage,
      onShowProfile,
      onStoreInputText,
      onToggleSidePanel,
      participants,
      selectedConversation,
      sidePanelOpen,
      validated,
      you,
    } = props

    const users = usernamesToUserListItem(participantFilter(participants, you).toArray(), you, metaDataMap, followingMap)

    const onOpenNewerConversation = props.supersededBy
      ? () => props.onOpenConversation(props.supersededBy.conversationIDKey)
      : props.restartConversation

    const listProps: $Shape<ListProps> = {
      editLastMessageCounter,
      firstNewMessageID,
      followingMap,
      listScrollDownState,
      messages,
      metaDataMap,
      moreToLoad,
      muted,
      onDeleteMessage,
      onEditMessage,
      onFocusInput,
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
      onEditLastMessage,
      onUnmountText: onStoreInputText,
      focusInputCounter: focusInputCounter,
      onPostMessage,
      selectedConversation,
    }

    const headerProps: HeaderProps = {
      muted,
      onBack,
      onOpenFolder,
      onShowProfile,
      onToggleSidePanel,
      sidePanelOpen,
      users,
    }

    return {inputProps, listProps, headerProps, onOpenNewerConversation}
  }
)

function _decorateSupersedes (props: Props, messages: Immutable.List<Constants.Message>): Immutable.List<Constants.Message> {
  if (props.supersedes && !props.moreToLoad) {
    const {conversationIDKey, finalizeInfo: {resetUser}} = props.supersedes
    const supersedesMessage: Constants.SupersedesMessage = {
      type: 'Supersedes',
      supersedes: conversationIDKey,
      username: resetUser,
      timestamp: Date.now(),
      key: `supersedes-${conversationIDKey}-${resetUser}`,
    }
    return messages.unshift(supersedesMessage)
  }

  return messages
}

const decoratedMesssagesHoc = withProps((props) => ({
  messages: _decorateSupersedes(props, props.messages),
}))

const focusInputHoc = compose(
  withState(
    'focusInputCounter',
    'setFocusInputCounter',
    0
  ),
  withProps(({setFocusInputCounter}) => ({onFocusInput: () => setFocusInputCounter(n => n + 1)})),
)

const editLastMessageHoc = compose(
  withState(
    'editLastMessageCounter',
    'setEditLastMessageCounter',
    0
  ),
  withProps(({setEditLastMessageCounter}) => ({onEditLastMessage: () => setEditLastMessageCounter(n => n + 1)}))
)

const hoc = compose(focusInputHoc, editLastMessageHoc, propsHoc, decoratedMesssagesHoc)

export default hoc
