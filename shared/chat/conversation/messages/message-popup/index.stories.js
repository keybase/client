// @flow
import React from 'react'
import * as PropProviders from '../../../../stories/prop-providers'
import {makeMessageAttachment, makeMessageText} from '../../../../constants/chat2'
import {storiesOf, action} from '../../../../stories/storybook'
import TextPopupMenu from './text/index'
import AttachmentPopupMenu from './attachment/index'
import ExplodingPopupMenu, {type OwnProps as ExplodingOwnProps} from './exploding/container'
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
  attachTo: null,
  onHidden: action('onHidden'),
  toggleChannelWide: action('onToggleChannelwide'),
  toggleMuted: action('toggleMuted'),
  updateDesktop: action('updateDesktop'),
  updateMobile: action('updateMobile'),
  visible: true,
  yourMessage: true,
}

const explodingSoonText = makeMessageText({
  author: 'cjb',
  deviceName: 'device',
  explodingTime: 2000000100000,
})

const explodingLaterText = makeMessageText({
  author: 'cjb',
  deviceName: 'device',
  explodingTime: 2000009000000,
})

const explodingSoonAttachment = makeMessageAttachment({
  author: 'cjb',
  deviceName: 'device',
  explodingTime: 2000000100000,
})

const commonExplodingProps = {
  attachTo: null,
  onHidden: action('onHidden'),
  position: 'top center',
  visible: true,
}

const provider = PropProviders.compose(
  PropProviders.Usernames(['max', 'cnojima', 'cdixon'], 'ayoubd'),
  PropProviders.Avatar(['following', 'both'], ['followers', 'both']),
  {
    ExplodingPopup: (props: ExplodingOwnProps) => ({
      attachTo: null,
      author: props.message.author,
      deviceName: props.message.deviceName,
      deviceRevokedAt: props.message.deviceRevokedAt,
      deviceType: props.message.deviceType,
      explodesAt: props.message.explodingTime,
      items: [
        {danger: true, onClick: action('onExplodeNow'), title: 'Explode now'},
        {danger: true, onClick: action('onDeleteHistory'), title: 'Delete this + everything above'},
        ...(props.message.type === 'attachment'
          ? [{onClick: action('onDownload'), title: 'Download'}]
          : [{onClick: action('onEdit'), title: 'Edit'}, {onClick: action('onCopy'), title: 'Copy text'}]),
      ],
      onHidden: props.onHidden,
      position: props.position,
      timestamp: props.message.timestamp,
      visible: props.visible,
      yourMessage: props.message.author === 'cjb',
    }),
  }
)

const load = () => {
  storiesOf('Chat/Conversation/Message popup', module)
    .addDecorator(provider)
    .add('Text', () => (
      <TextPopupMenu
        {...defaultProps}
        {...textMessage.toJS()}
        onCopy={action('onCopy')}
        onDelete={action('onDelete')}
        onDeleteMessageHistory={action('onDeleteMessageHistory')}
        onEdit={action('onEdit')}
        onQuote={action('onQuote')}
        onReplyPrivately={action('onReplyPrivately')}
        onViewProfile={action('onViewProfile')}
        position={'top left'}
        showDivider={true}
      />
    ))
    .add('Attachment', () => (
      <AttachmentPopupMenu
        {...defaultProps}
        {...attachmentMessage.toJS()}
        onDelete={action('onDelete')}
        onDeleteMessageHistory={action('onDeleteMessageHistory')}
        onDownload={action('onDownload')}
        onShowInFinder={action('onShowInFinder')}
        onSaveAttachment={action('onSaveAttachment')}
        onShareAttachment={action('onShareAttachment')}
        position={'top left'}
      />
    ))
    .add('Exploding later', () => (
      <ExplodingPopupMenu {...commonExplodingProps} message={explodingLaterText} />
    ))
    .add('Exploding soon', () => <ExplodingPopupMenu {...commonExplodingProps} message={explodingSoonText} />)
    .add('Exploding attachment', () => (
      <ExplodingPopupMenu {...commonExplodingProps} message={explodingSoonAttachment} />
    ))
}

export default load
