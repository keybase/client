// @flow
import * as Types from '../../../../constants/types/chat2'
import * as ConstantsMessage from '../../../../constants/chat2/message'
import * as Sb from '../../../../stories/storybook'
import * as React from 'react'
import WrapperMessage from './wrapper-message/container'
import HiddenString from '../../../../util/hidden-string'

const messageText = ConstantsMessage.makeMessageText({
  author: 'chris',
  conversationIDKey: Types.stringToConversationIDKey('a'),
  deviceName: 'devicename',
  deviceType: 'desktop',
  text: new HiddenString('This is a piece of message text.\nWith Multiple lines.'),
})

const props = {
  author: 'chris',
  conversationIDKey: Types.stringToConversationIDKey('a'),
  decorate: true,
  exploded: false,
  hasUnfurlPrompts: false,
  isEditing: false,
  isRevoked: false,
  isShowingUsername: false,
  measure: null,
  message: messageText,
  orangeLineAbove: false,
  ordinal: Types.numberToOrdinal(1),
  previous: null,
  shouldShowPopup: false,
}

const provider = Sb.createPropProviderWithCommon({
  MessagePopupText: p => p,
  ReactButton: p => ({
    active: false,
    conversationIDKey: p.conversationIDKey,
    count: 0,
    emoji: null,
    onAddReaction: Sb.action('onAddReaction'),
    onClick: Sb.action('onClick'),
    onLongPress: Sb.action('onLongPress'),
    onMouseLeave: Sb.action('onMouseLeave'),
    onMouseOver: Sb.action('onMouseOver'),
    onOpenEmojiPicker: Sb.action('onOpenEmojiPicker'),
    onShowPicker: Sb.action('onShowPicker'),
    ordinal: p.ordinal,
    showBorder: false,
    style: null,
  }),
  WrapperMessage: p => ({
    children: p.children,
    conversationIDKey: p.conversationIDKey,
    decorate: p.decorate,
    exploded: p.message.exploded,
    isEditing: p.isEditing,
    isRevoked: !!p.message.deviceRevokedAt,
    isShowingUsername: p.isShowingUsername,
    measure: null,
    message: p.message,
    orangeLineAbove: p.orangeLineAbove,
    ordinal: p.ordinal,
    previous: p.previous,
    shouldShowPopup: p.shouldShowPopup,
    type: p.type,
    hasUnfurlPrompts: p.hasUnfurlPrompts,
  }),
  WrapperAuthor: p => ({
    author: p.author,
    conversationIDKey: p.conversationIDKey,
    exploded: p.exploded,
    explodedBy: p.explodedBy,
    explodesAt: p.explodesAt,
    exploding: p.exploding,
    failureDescription: p.failureDescription,
    includeHeader: p.includeHeader,
    isBroken: false,
    isEdited: p.isEdited,
    isEditing: p.isEditing,
    isExplodingUnreadable: false,
    isFollowing: false,
    isYou: false,
    measure: null,
    message: p.message,
    messageFailed: false,
    messageKey: 'key',
    messagePending: false,
    messageSent: false,
    onAuthorClick: () => Sb.action('onAuthorClick'),
    onCancel: () => Sb.action('onCancel'),
    onEdit: () => Sb.action('onEdit'),
    onRetry: () => Sb.action('onRetry'),
    ordinal: p.ordinal,
    timestamp: p.message.timestamp,
    toggleMessageMenu: () => Sb.action('toggleMessageMenu'),
  }),
})

const load = () => {
  Sb.storiesOf('Chat/Conversation/Rows/Wrapper', module)
    .addDecorator(provider)
    .add('Normal', () => <WrapperMessage {...props} />)
    .add('UnDecorated', () => <WrapperMessage {...props} decorate={false} />)
    .add('Exploded', () => <WrapperMessage {...props} exploded={true} explodedAt={new Date(0)} />)
    .add('isEditing', () => <WrapperMessage {...props} isEditing={true} />)
    .add('isRevoked', () => (
      <WrapperMessage {...props} message={props.message.set('deviceRevokedAt', new Date(0))} />
    ))
    .add('isShowingUsername', () => <WrapperMessage {...props} isShowingUsername={true} />)
    .add('orangeLineAbove', () => <WrapperMessage {...props} orangeLineAbove={true} />)
    .add('shouldShowPopup', () => <WrapperMessage {...props} shouldShowPopup={true} />)
}

export default load
