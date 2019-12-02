import * as React from 'react'
import MessagePopupHeader from '../header'
import {FloatingMenu, MenuItems} from '../../../../../common-adapters'
import {DeviceType} from '../../../../../constants/types/devices'
import {Position} from '../../../../../common-adapters/relative-popup-hoc.types'
import {StylesCrossPlatform} from '../../../../../styles/css'

type Props = {
  attachTo?: () => React.Component<any> | null
  author: string
  botUsername?: string
  deviceName: string
  deviceRevokedAt?: number
  deviceType: DeviceType
  onAddReaction?: () => void
  onCopy?: () => void
  onDelete?: () => void
  onDeleteMessageHistory?: () => void
  onEdit?: () => void
  onHidden: () => void
  onPinMessage?: () => void
  onReply?: () => void
  onReplyPrivately?: () => void
  onViewProfile?: () => void
  onViewMap?: () => void
  isLocation?: boolean
  position: Position
  showDivider: boolean
  style?: StylesCrossPlatform
  timestamp: number
  visible: boolean
  yourMessage: boolean
  isDeleteable: boolean
  isEditable: boolean
}

const TextPopupMenu = (props: Props) => {
  const items: MenuItems = [
    ...(props.showDivider ? (['Divider'] as const) : []),
    ...(props.isDeleteable
      ? [
          {
            danger: true,
            disabled: !props.onDelete,
            icon: 'iconfont-trash',
            onClick: props.onDelete,
            subTitle: 'Deletes this message for everyone',
            title: 'Delete',
          },
        ]
      : []),
    ...((props.yourMessage && props.isDeleteable) || props.onDeleteMessageHistory
      ? (['Divider'] as const)
      : []),
    ...(props.onViewMap
      ? [{icon: 'iconfont-location', onClick: props.onViewMap, title: 'View on Google Maps'}]
      : []),
    ...(props.onEdit && props.isEditable
      ? [
          {
            icon: 'iconfont-edit',
            onClick: props.onEdit,
            title: 'Edit',
          },
        ]
      : []),
    ...(props.onAddReaction
      ? [{icon: 'iconfont-reacji', onClick: props.onAddReaction, title: 'Add a reaction'}]
      : []),
    ...(props.onCopy ? [{icon: 'iconfont-clipboard', onClick: props.onCopy, title: 'Copy text'}] : []),
    ...(props.onReply ? [{icon: 'iconfont-reply', onClick: props.onReply, title: 'Reply'}] : []),
    ...(props.onReplyPrivately
      ? [{icon: 'iconfont-reply', onClick: props.onReplyPrivately, title: 'Reply privately'}]
      : []),
    ...(props.onPinMessage
      ? [{icon: 'iconfont-pin', onClick: props.onPinMessage, title: 'Pin message'}]
      : []),
    ...(props.onViewProfile
      ? [{icon: 'iconfont-person', onClick: props.onViewProfile, title: 'View profile'}]
      : []),
  ]

  const header = {
    title: 'header',
    view: (
      <MessagePopupHeader
        author={props.author}
        botUsername={props.botUsername}
        deviceName={props.deviceName}
        deviceRevokedAt={props.deviceRevokedAt}
        deviceType={props.deviceType}
        isLast={!items.length}
        isLocation={!!props.isLocation}
        timestamp={props.timestamp}
        yourMessage={props.yourMessage}
      />
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
      positionFallbacks={[]}
      containerStyle={props.style}
      visible={props.visible}
    />
  )
}

export default TextPopupMenu
