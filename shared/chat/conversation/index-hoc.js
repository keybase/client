// @flow

import * as Immutable from 'immutable'
import {compose, withState, withProps} from 'recompose'
import * as Constants from '../../constants/chat'

import type {Props} from './index'
import type {Props as ListProps} from './list'

const propsHoc = withProps(
  (props) => {
    const {
      editLastMessageCounter,
      editingMessage,
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
      onMessageAction,
      onOpenConversation,
      onOpenInFileUI,
      onOpenInPopup,
      onRetryAttachment,
      onRetryMessage,
      selectedConversation,
      onShowEditor,
      sidePanelOpen,
      validated,
      you,
    } = props

    const onOpenNewerConversation = props.supersededBy
      ? () => props.onOpenConversation(props.supersededBy.conversationIDKey)
      : props.restartConversation

    const listProps: $Shape<ListProps> = {
      editingMessage,
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
      onMessageAction,
      onOpenConversation,
      onOpenInFileUI,
      onOpenInPopup,
      onRetryAttachment,
      onRetryMessage,
      onShowEditor,
      selectedConversation,
      sidePanelOpen,
      validated,
      you,
    }

    return {listProps, onOpenNewerConversation}
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

const hoc = compose(focusInputHoc, editLastMessageHoc, decoratedMesssagesHoc, propsHoc)

export default hoc
