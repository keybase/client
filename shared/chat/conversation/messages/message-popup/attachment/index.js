// @flow
import * as React from 'react'
import * as Types from '../../../../../constants/types/chat2'
import MessagePopupHeader from '../header'
import {FloatingMenu} from '../../../../../common-adapters/'
import {fileUIName, isMobile} from '../../../../../styles'
import type {Position} from '../../../../../common-adapters/relative-popup-hoc'

type Props = {
  attachTo: ?React.Component<*, *>,
  message: Types.MessageAttachment,
  onDelete: null | (() => void),
  onDeleteMessageHistory: null | (() => void),
  onDownload: null | (() => void),
  onHidden: () => void,
  onSaveAttachment: null | (() => void),
  onShareAttachment: null | (() => void),
  onShowInFinder: null | (() => void),
  position: Position,
  style?: Object,
  visible: boolean,
  yourMessage: boolean,
}

const AttachmentPopupMenu = (props: Props) => {
  const {message} = props
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
      <MessagePopupHeader
        author={message.author}
        deviceName={message.deviceName}
        deviceRevokedAt={message.deviceRevokedAt}
        deviceType={message.deviceType}
        isLast={!items.length}
        timestamp={message.timestamp}
        yourMessage={props.yourMessage}
      />
    ),
  }
  return (
    <FloatingMenu
      attachTo={props.attachTo}
      header={header}
      items={items}
      onHidden={props.onHidden}
      closeOnSelect={true}
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

export default AttachmentPopupMenu
