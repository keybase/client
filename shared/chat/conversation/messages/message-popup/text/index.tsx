import * as React from 'react'
import MessagePopupHeader from '../header'
import {FloatingMenu} from '../../../../../common-adapters/'
import {DeviceType} from '../../../../../constants/types/devices'
import {Position} from '../../../../../common-adapters/relative-popup-hoc.types'
import {StylesCrossPlatform} from '../../../../../styles/css'

type Props = {
  attachTo: () => React.Component<any> | null
  author: string
  deviceName: string
  deviceRevokedAt: number | null
  deviceType: DeviceType
  onAddReaction: null | (() => void)
  onCopy: null | (() => void)
  onDelete: null | (() => void)
  onDeleteMessageHistory: null | (() => void)
  onEdit: null | (() => void)
  onHidden: () => void
  onReply: null | (() => void)
  onReplyPrivately: null | (() => void)
  onViewProfile: null | (() => void)
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
  const items = [
    ...(props.showDivider ? (['Divider'] as const) : []),
    ...(props.isDeleteable
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
    ...((props.yourMessage && props.isDeleteable) || props.onDeleteMessageHistory
      ? (['Divider'] as const)
      : []),
    ...(props.onEdit && props.isEditable
      ? [
          {
            onClick: props.onEdit,
            title: 'Edit',
          },
        ]
      : []),
    ...(props.onAddReaction ? [{onClick: props.onAddReaction, title: 'Add a reaction'}] : []),
    ...(props.onCopy ? [{onClick: props.onCopy, title: 'Copy text'}] : []),
    ...(props.onReply ? [{onClick: props.onReply, title: 'Reply'}] : []),
    ...(props.onReplyPrivately ? [{onClick: props.onReplyPrivately, title: 'Reply privately'}] : []),
    ...(props.onViewProfile ? [{onClick: props.onViewProfile, title: 'View profile'}] : []),
  ] as const

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
