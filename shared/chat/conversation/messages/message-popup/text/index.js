// @flow
import * as React from 'react'
import * as Types from '../../../../../constants/types/chat2'
import MessagePopupHeader from '../header'
import {ModalLessPopupMenu} from '../../../../../common-adapters/popup-menu'
import {isMobile} from '../../../../../util/container'

type Props = {
  message: Types.MessageText,
  onCopy: () => void,
  onDelete: ?() => void,
  onDeleteMessageHistory: ?() => void,
  onEdit: ?() => void,
  onHidden: () => void,
  showDivider: boolean,
  style?: Object,
  yourMessage: boolean,
}

const TextPopupMenu = (props: Props) => {
  const items = props.yourMessage
    ? [
        ...(props.showDivider ? ['Divider'] : []),
        {onClick: props.onCopy, title: 'Copy Text'},
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
    : [{onClick: props.onCopy, title: 'Copy Text'}]

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
