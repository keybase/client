// @flow
import React from 'react'
import {makeMessageAttachment, makeMessageText} from '../../../../constants/chat2'
import {storiesOf, action} from '../../../../stories/storybook'
import TextPopupMenu from './text/index'
import AttachmentPopupMenu from './attachment/index'
import ExplodingPopupMenu from './exploding/index'
import HiddenString from '../../../../util/hidden-string'

const textMessage = makeMessageText({
  author: 'cjb',
  deviceName: 'myDevice',
  deviceRevokedAt: null,
  text: new HiddenString('blah'),
  timestamp: 1525190235719,
}).toJS()

const attachmentMessage = makeMessageAttachment({
  author: 'cjb',
  deviceName: 'myDevice',
  timestamp: 1525190235719,
}).toJS()

const defaultProps = {
  attachTo: null,
  onHidden: action('onHidden'),
  toggleChannelWide: action('onToggleChannelwide'),
  toggleMuted: action('toggleMuted'),
  updateDesktop: action('updateDesktop'),
  updateMobile: action('updateMobile'),
  // FIXME: Visible needs to be true for storybook, but false for shots.
  visible: true,
  yourMessage: true,
}

const load = () => {
  storiesOf('Chat/Conversation/Message popup', module)
    .add('Text', () => (
      <TextPopupMenu
        {...defaultProps}
        {...textMessage}
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
        {...attachmentMessage}
        onDelete={action('onDelete')}
        onDeleteMessageHistory={action('onDeleteMessageHistory')}
        onDownload={action('onDownload')}
        onShowInFinder={action('onShowInFinder')}
        onSaveAttachment={action('onSaveAttachment')}
        onShareAttachment={action('onShareAttachment')}
        position={'top left'}
      />
    ))
    .add('Exploding', () => (
      <ExplodingPopupMenu
        {...defaultProps}
        {...textMessage}
        explodesAt={1525350235}
        onEdit={action('onEdit')}
        onExplodeNow={action('onExplodeNow')}
        position={'top left'}
      />
    ))
}

export default load
