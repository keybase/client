// @flow
import * as React from 'react'
import * as Types from '../../../../../constants/types/chat2'
import MessagePopupHeader from '../header'
import {ModalLessPopupMenu} from '../../../../../common-adapters/popup-menu'
import {fileUIName, isMobile} from '../../../../../styles'

type Props = {
  message: Types.MessageAttachment,
  onDelete: null | (() => void),
  onDeleteMessageHistory: null | (() => void),
  onDownload: null | (() => void),
  onHidden: () => void,
  onSaveAttachment: null | (() => void),
  onShareAttachment: null | (() => void),
  onShowInFinder: null | (() => void),
  style?: Object,
  yourMessage: boolean,
}

const AttachmentPopupMenu = (props: Props) => {
  const items = [
    'Divider',
    ...(props.yourMessage
      ? [
          {
            danger: true,
            disabled: !props.onDelete,
            onClick: props.onDelete,
            subTitle: 'Deletes this attachment for everyone',
            title: 'Delete',
          },
        ]
      : []),
    ...(props.onDeleteMessageHistory
      ? [
          {
            danger: true,
            disabled: !props.onDeleteMessageHistory,
            onClick: props.onDeleteMessageHistory,
            title: 'Delete this + everything above',
          },
        ]
      : []),
    'Divider',
    ...(props.onShowInFinder ? [{onClick: props.onShowInFinder, title: `Show in ${fileUIName}`}] : []),
    ...(props.onSaveAttachment ? [{onClick: props.onSaveAttachment, title: 'Save'}] : []),
    ...(props.onShareAttachment ? [{onClick: props.onShareAttachment, title: 'Share'}] : []),
    ...(props.onDownload ? [{onClick: props.onDownload, title: 'Download'}] : []),
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
