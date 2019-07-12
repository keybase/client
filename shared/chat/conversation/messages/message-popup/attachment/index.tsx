import * as React from 'react'
import MessagePopupHeader from '../header'
import {FloatingMenu, MenuItems} from '../../../../../common-adapters/'
import {fileUIName, StylesCrossPlatform} from '../../../../../styles'
import {DeviceType} from '../../../../../constants/types/devices'
import {Position} from '../../../../../common-adapters/relative-popup-hoc.types'

type Props = {
  attachTo?: () => React.Component<any> | null
  author: string
  deviceName: string
  deviceType: DeviceType
  deviceRevokedAt?: number
  onAddReaction?: () => void
  onDelete?: () => void
  onDownload?: () => void
  onHidden: () => void
  onReply: () => void
  onSaveAttachment?: () => void
  onShareAttachment?: () => void
  onShowInFinder?: () => void
  pending: boolean
  position: Position
  style?: StylesCrossPlatform
  timestamp: number
  visible: boolean
  yourMessage: boolean
  isDeleteable: boolean
}

const AttachmentPopupMenu = (props: Props) => {
  const items: MenuItems = [
    ...(props.isDeleteable
      ? ([
          'Divider' as const,
          {
            danger: true,
            disabled: !props.onDelete,
            onClick: props.onDelete,
            subTitle: 'Deletes this attachment for everyone',
            title: 'Delete',
          },
        ] as const)
      : []),

    'Divider' as const,
    ...(props.onShowInFinder ? [{onClick: props.onShowInFinder, title: `Show in ${fileUIName}`}] : []),
    ...(props.onSaveAttachment
      ? [{disabled: props.pending, onClick: props.onSaveAttachment, title: 'Save'}]
      : []),
    ...(props.onShareAttachment
      ? [{disabled: props.pending, onClick: props.onShareAttachment, title: 'Share'}]
      : []),
    ...(props.onDownload ? [{disabled: props.pending, onClick: props.onDownload, title: 'Download'}] : []),
    ...(props.onAddReaction ? [{onClick: props.onAddReaction, title: 'Add a reaction'}] : []),
    ...(props.onReply ? [{onClick: props.onReply, title: 'Reply'}] : []),
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
      positionFallbacks={[]}
      containerStyle={props.style}
      visible={props.visible}
    />
  )
}

export default AttachmentPopupMenu
