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

const provider = PropProviders.compose(
  PropProviders.Usernames(['max', 'cnojima', 'cdixon'], 'ayoubd'),
  PropProviders.Avatar(['following', 'both'], ['followers', 'both']),
  {
    ExplodingPopup: (props: ExplodingOwnProps) => {},
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
      <ExplodingPopupMenu
        {...defaultProps}
        {...textMessage}
        attachTo={null}
        explodesAt={2000009000000}
        canEdit={true}
        canExplodeNow={true}
        onEdit={action('onEdit')}
        onExplodeNow={action('onExplodeNow')}
        position={'top left'}
      />
    ))
    .add('Exploding soon', () => (
      <ExplodingPopupMenu
        {...defaultProps}
        {...textMessage}
        attachTo={null}
        explodesAt={2000000100000}
        canEdit={true}
        canExplodeNow={true}
        onEdit={action('onEdit')}
        onExplodeNow={action('onExplodeNow')}
        position={'top left'}
      />
    ))
}

export default load
