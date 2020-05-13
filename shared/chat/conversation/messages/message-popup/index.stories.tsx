import * as React from 'react'
import * as Sb from '../../../../stories/storybook'
import * as Container from '../../../../util/container'
import {makeMessageAttachment, makeMessageText} from '../../../../constants/chat2'
import TextPopupMenu from './text/index'
import AttachmentPopupMenu from './attachment/index'
import paymentPopupStories from './payment/index.stories'
import ExplodingPopupMenu from './exploding/container'
import HiddenString from '../../../../util/hidden-string'

const textMessage = makeMessageText({
  author: 'cjb',
  deviceName: 'myDevice',
  text: new HiddenString('blah'),
  timestamp: 1525190235719,
})

const textMessageOther = makeMessageText({
  author: 'chris',
  deviceName: 'Phone',
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
  isKickable: true,
  isTeam: false,
  onAllMedia: Sb.action('onAllMedia'),
  onCopy: Sb.action('onCopy'),
  onCopyLink: Sb.action('onCopyLink'),
  onDelete: Sb.action('onDelete'),
  onDeleteMessageHistory: Sb.action('onDeleteMessageHistory'),
  onDownload: Sb.action('onDownload'),
  onEdit: Sb.action('onEdit'),
  onForward: Sb.action('onForward'),
  onHidden: Sb.action('onHidden'),
  onKick: Sb.action('onKick'),
  onQuote: Sb.action('onQuote'),
  onReact: (emoji: string) => Sb.action(`onReact:${emoji}`),
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

const explodingSomeoneElses = makeMessageText({
  author: 'chris',
  deviceName: 'GNU/Linux',
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

const common = Sb.createStoreWithCommon()
const store = Container.produce(common, draftState => {
  draftState.config.username = 'cjb'
})

const load = () => {
  Sb.storiesOf('Chat/Conversation/Message popup', module)
    .addDecorator((story: any) => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Text', () => <TextPopupMenu {...defaultProps} {...textMessage} />)
    .add('Text w/ revoked device at 0', () => (
      <TextPopupMenu {...defaultProps} {...textMessage} deviceRevokedAt={0} />
    ))
    .add('Text w/ revoked device', () => (
      <TextPopupMenu {...defaultProps} {...textMessage} deviceRevokedAt={5} />
    ))
    .add('Attachment', () => <AttachmentPopupMenu {...defaultProps} {...attachmentMessage} />)
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
    .add("Text (someone else's)", () => (
      <TextPopupMenu {...defaultProps} {...textMessageOther} {...{yourMessage: false}} />
    ))
    .add("Exploding (someone else's)", () => (
      <ExplodingPopupMenu {...commonExplodingProps} message={explodingSomeoneElses} />
    ))

  // Externally defined stories
  paymentPopupStories()
}

export default load
