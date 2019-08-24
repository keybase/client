import * as React from 'react'
import * as Sb from '../../../../stories/storybook'
import {makeMessageAttachment, makeMessageText} from '../../../../constants/chat2'
import TextPopupMenu from './text/index'
import AttachmentPopupMenu from './attachment/index'
import paymentPopupStories from './payment/index.stories'
import ExplodingPopupMenu, {OwnProps as ExplodingOwnProps} from './exploding/container'
import HiddenString from '../../../../util/hidden-string'

const textMessage = makeMessageText({
  author: 'cjb',
  deviceName: 'myDevice',
  deviceRevokedAt: null,
  text: new HiddenString('blah'),
  timestamp: 1525190235719,
})

const attachmentMessage = makeMessageAttachment({
  author: 'cjb',
  deviceName: 'myDevice',
  timestamp: 1525190235719,
})

const defaultProps = {
  attachTo: () => null,
  isDeleteable: true,
  onAddReaction: Sb.action('onAddReaction'),
  onCopy: Sb.action('onCopy'),
  onDelete: Sb.action('onDelete'),
  onDeleteMessageHistory: Sb.action('onDeleteMessageHistory'),
  onDownload: Sb.action('onDownload'),
  onEdit: Sb.action('onEdit'),
  onHidden: Sb.action('onHidden'),
  onQuote: Sb.action('onQuote'),
  onReply: Sb.action('onReply'),
  onReplyPrivately: Sb.action('onReplyPrivately'),
  onSaveAttachment: Sb.action('onSaveAttachment'),
  onShareAttachment: Sb.action('onShareAttachment'),
  onShowInFinder: Sb.action('onShowInFinder'),
  onViewProfile: Sb.action('onViewProfile'),
  pending: false,
  position: 'top left',
  showDivider: true,
  toggleChannelWide: Sb.action('onToggleChannelwide'),
  toggleMuted: Sb.action('toggleMuted'),
  updateDesktop: Sb.action('updateDesktop'),
  updateMobile: Sb.action('updateMobile'),
  visible: true,
  yourMessage: true,
} as const

const explodingSoonText = makeMessageText({
  author: 'cjb',
  deviceName: 'device',
  explodingTime: 2000000100000,
})

const explodingLaterText = (deviceRevokedAt?: number) =>
  makeMessageText({
    author: 'cjb',
    deviceName: 'device',
    deviceRevokedAt: deviceRevokedAt,
    explodingTime: 2000009000000,
  })

const explodingSoonAttachment = makeMessageAttachment({
  author: 'cjb',
  deviceName: 'device',
  explodingTime: 2000000100000,
})

const commonExplodingProps = {
  attachTo: () => null,
  onHidden: Sb.action('onHidden'),
  position: 'top center' as const,
  visible: true,
}

const provider = Sb.createPropProviderWithCommon({
  ExplodingPopup: (props: ExplodingOwnProps) => ({
    attachTo: () => null,
    author: props.message.author,
    deviceName: props.message.deviceName,
    deviceRevokedAt: props.message.deviceRevokedAt,
    deviceType: props.message.deviceType,
    explodesAt: props.message.explodingTime,
    items: [
      {danger: true, onClick: Sb.action('onExplodeNow'), title: 'Explode now'},
      ...(props.message.type === 'attachment'
        ? [{onClick: Sb.action('onDownload'), title: 'Download'}]
        : [
            {onClick: Sb.action('onEdit'), title: 'Edit'},
            {onClick: Sb.action('onCopy'), title: 'Copy text'},
          ]),
    ],
    onHidden: props.onHidden,
    position: props.position,
    timestamp: props.message.timestamp,
    visible: props.visible,
    yourMessage: props.message.author === 'cjb',
  }),
})

const load = () => {
  Sb.storiesOf('Chat/Conversation/Message popup', module)
    .addDecorator(provider)
    .add('Text', () => <TextPopupMenu {...defaultProps} {...textMessage.toJS()} />)
    .add('Text w/ revoked device at 0', () => (
      <TextPopupMenu {...defaultProps} {...textMessage.toJS()} deviceRevokedAt={0} />
    ))
    .add('Text w/ revoked device', () => (
      <TextPopupMenu {...defaultProps} {...textMessage.toJS()} deviceRevokedAt={5} />
    ))
    .add('Attachment', () => <AttachmentPopupMenu {...defaultProps} {...attachmentMessage.toJS()} />)
    .add('Exploding later', () => (
      <ExplodingPopupMenu {...commonExplodingProps} message={explodingLaterText()} />
    ))
    .add('Exploding w/ revoked device at 0', () => (
      <ExplodingPopupMenu {...commonExplodingProps} message={explodingLaterText(0)} />
    ))
    .add('Exploding w/ revoked device', () => (
      <ExplodingPopupMenu {...commonExplodingProps} message={explodingLaterText(5)} />
    ))
    .add('Exploding soon', () => <ExplodingPopupMenu {...commonExplodingProps} message={explodingSoonText} />)
    .add('Exploding attachment', () => (
      <ExplodingPopupMenu {...commonExplodingProps} message={explodingSoonAttachment} />
    ))

  // Externally defined stories
  paymentPopupStories()
}

export default load
