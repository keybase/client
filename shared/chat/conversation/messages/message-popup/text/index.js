// @flow
import * as React from 'react'
import * as Types from '../../../../../constants/types/chat2'
import MessagePopupHeader from '../header'
import {FloatingMenu} from '../../../../../common-adapters/'
import type {Position} from '../../../../../common-adapters/relative-popup-hoc'
import {isMobile} from '../../../../../util/container'

type Props = {
  attachTo: ?React.Component<*, *>,
  message: Types.MessageText,
  onCopy: () => void,
  onDelete: null | (() => void),
  onDeleteMessageHistory: null | (() => void),
  onEdit: null | (() => void),
  onHidden: () => void,
  onQuote: null | (() => void),
  onReplyPrivately: null | (() => void),
  onViewProfile: () => void,
  position: Position,
  showDivider: boolean,
  style?: Object,
  visible: boolean,
  yourMessage: boolean,
}

const TextPopupMenu = (props: Props) => {
  const items = [
    ...(props.showDivider ? ['Divider'] : []),
    ...(props.yourMessage
      ? [
          {
            danger: true,
            disabled: !props.onDelete,
            onClick: props.onDelete,
            subTitle: 'Deletes this message for everyone',
            title: 'Delete',
          },
        ]
      : []),
    ...(props.onDeleteMessageHistory
      ? [
          {
            danger: true,
            onClick: props.onDeleteMessageHistory,
            title: 'Delete this + everything above',
          },
        ]
      : []),
    'Divider',
    {disabled: !props.onEdit, onClick: props.onEdit, title: 'Edit'},
    {onClick: props.onCopy, title: 'Copy Text'},
    {onClick: props.onQuote, title: 'Quote'},
    {onClick: props.onReplyPrivately, title: 'Reply Privately'},
    {onClick: props.onViewProfile, title: 'View Profile'},
  ]

  const header = {
    title: 'header',
    view: (
      <MessagePopupHeader message={props.message} isLast={!items.length} yourMessage={props.yourMessage} />
    ),
  }
  return (
    <FloatingMenu
      attachTo={props.attachTo}
      closeOnSelect={true}
      header={header}
      items={items}
      onHidden={props.onHidden}
      position={props.position}
      style={{...stylePopup, ...props.style}}
      visible={props.visible}
    />
  )
}

const stylePopup = {
  overflow: 'visible',
  width: isMobile ? '100%' : 196,
}

export default TextPopupMenu
