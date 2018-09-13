// @flow
import * as React from 'react'
import MessagePopupHeader from '../header'
import {FloatingMenu} from '../../../../../common-adapters/'
import {fileUIName} from '../../../../../styles'
import type {DeviceType} from '../../../../../constants/types/devices'
import type {Position} from '../../../../../common-adapters/relative-popup-hoc'

type Props = {
  attachTo: () => ?React.ElementRef<any>,
  author: string,
  deviceName: string,
  deviceType: DeviceType,
  deviceRevokedAt: ?number,
  onAddReaction: null | (() => void),
  onDelete: null | (() => void),
  onDownload: null | (() => void),
  onHidden: () => void,
  onSaveAttachment: null | (() => void),
  onShareAttachment: null | (() => void),
  onShowInFinder: null | (() => void),
  pending: boolean,
  position: Position,
  style?: Object,
  timestamp: number,
  visible: boolean,
  yourMessage: boolean,
}

const AttachmentPopupMenu = (props: Props) => {
  const items = [
    ...(props.yourMessage
      ? [
          'Divider',
          {
            danger: true,
            disabled: !props.onDelete,
            onClick: props.onDelete,
            subTitle: 'Deletes this attachment for everyone',
            title: 'Delete',
          },
        ]
      : []),

    'Divider',
    ...(props.onShowInFinder ? [{onClick: props.onShowInFinder, title: `Show in ${fileUIName}`}] : []),
    ...(props.onSaveAttachment
      ? [{disabled: props.pending, onClick: props.onSaveAttachment, title: 'Save'}]
      : []),
    ...(props.onShareAttachment
      ? [{disabled: props.pending, onClick: props.onShareAttachment, title: 'Share'}]
      : []),
    ...(props.onDownload ? [{disabled: props.pending, onClick: props.onDownload, title: 'Download'}] : []),
    ...(props.onAddReaction ? [{onClick: props.onAddReaction, title: 'Add a reaction'}] : []),
  ]

  const header = {
    title: 'header',
    view: (
      <MessagePopupHeader
        author={props.author}
        deviceName={props.deviceName}
        deviceRevokedAt={props.deviceRevokedAt}
        deviceType={props.deviceType}
        isLast={!items.length}
        timestamp={props.timestamp}
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
      containerStyle={props.style}
      visible={props.visible}
    />
  )
}

export default AttachmentPopupMenu
