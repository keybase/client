// @flow
import * as React from 'react'
import * as Types from '../../../../../constants/types/chat2'
import MessagePopupHeader from '../header'
import {ModalLessPopupMenu} from '../../../../../common-adapters/popup-menu'
import {fileUIName, isMobile} from '../../../../../styles'

type Props = {
  message: Types.MessageAttachment,
  onDelete: ?() => void,
  onDeleteMessageHistory: ?() => void,
  onDownload: ?() => void,
  onHidden: () => void,
  onSaveAttachment: ?() => void,
  onShareAttachment: ?() => void,
  onShowInFinder: ?() => void,
  style?: Object,
  yourMessage: boolean,
}

const AttachmentPopupMenu = (props: Props) => {
  const items = [
    'Divider',
    ...(props.onShowInFinder ? [{onClick: props.onShowInFinder, title: `Show in ${fileUIName}`}] : []),
    ...(props.onDownload ? [{onClick: props.onDownload, title: 'Download'}] : []),
    ...(props.onSaveAttachment ? [{onClick: props.onSaveAttachment, title: 'Save'}] : []),
    ...(props.onShareAttachment ? [{onClick: props.onShareAttachment, title: 'Share'}] : []),
    ...(props.yourMessage
      ? [
          {
            danger: true,
            disabled: !props.onDelete,
            onClick: props.onDelete,
            subTitle: 'Deletes for everyone',
            title: 'Delete',
          },
          'Divider',
          {
            danger: true,
            disabled: !props.onDeleteMessageHistory,
            onClick: props.onDeleteMessageHistory,
            subTitle: 'Deletes all messages before this one for everyone',
            title: 'Delete up to here',
          },
        ]
      : []),
  ]

  const header = {
    title: 'header',
    view: (
      <MessagePopupHeader message={props.message} isLast={!items.length} yourMessage={props.yourMessage} />
    ),
  }
  return (
    <ModalLessPopupMenu
      header={header}
      items={items}
      onHidden={props.onHidden}
      closeOnClick={true}
      style={{...stylePopup, ...props.style}}
    />
  )
}

const stylePopup = {
  overflow: 'visible',
  width: isMobile ? '100%' : 196,
}

export default AttachmentPopupMenu
