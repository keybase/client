// @flow
import * as React from 'react'
import * as Types from '../../../../../constants/types/chat2'
import MessagePopupHeader from '../header'
import {ModalLessPopupMenu} from '../../../../../common-adapters/popup-menu'
import {isMobile} from '../../../../../util/container'

type Props = {
  message: Types.MessageText,
  onCopy: () => void,
  onDelete: null | (() => void),
  onDeleteMessageHistory: null | (() => void),
  onEdit: null | (() => void),
  onHidden: () => void,
  onQuote: null | (() => void),
  onReplyPrivately: null | (() => void),
  onViewProfile: () => void,
  showDivider: boolean,
  style?: Object,
  yourMessage: boolean,
}

const TextPopupMenu = (props: Props) => {
  const commonItems = [
    {onClick: props.onCopy, title: 'Copy Text'},
    {onClick: props.onQuote, title: 'Quote'},
    {onClick: props.onReplyPrivately, title: 'Reply Privately'},
    {onClick: props.onViewProfile, title: 'View Profile'},
  ]
  const items = props.yourMessage
    ? [
        ...(props.showDivider ? ['Divider'] : []),
        ...commonItems,
        {disabled: !props.onEdit, onClick: props.onEdit, title: 'Edit'},
        {
          danger: true,
          disabled: !props.onDelete,
          onClick: props.onDelete,
          subTitle: 'Deletes this message for everyone',
          title: 'Delete',
        },
        ...(props.onDeleteMessageHistory
          ? [
              'Divider',
              {
                danger: true,
                onClick: props.onDeleteMessageHistory,
                title: 'Delete this + everything above',
              },
            ]
          : []),
      ]
    : commonItems

  const header = {
    title: 'header',
    view: (
      <MessagePopupHeader message={props.message} isLast={!items.length} yourMessage={props.yourMessage} />
    ),
  }
  return (
    <ModalLessPopupMenu
      closeOnClick={true}
      header={header}
      items={items}
      onHidden={props.onHidden}
      style={{...stylePopup, ...props.style}}
    />
  )
}

const stylePopup = {
  overflow: 'visible',
  width: isMobile ? '100%' : 196,
}

export default TextPopupMenu
