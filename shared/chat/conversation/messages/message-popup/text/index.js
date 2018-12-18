// @flow
import * as React from 'react'
import MessagePopupHeader from '../header'
import {FloatingMenu} from '../../../../../common-adapters/'
import type {DeviceType} from '../../../../../constants/types/devices'
import type {Position} from '../../../../../common-adapters/relative-popup-hoc.types'
import type {StylesCrossPlatform} from '../../../../../styles/css'

type Props = {
  attachTo: () => ?React.Component<any>,
  author: string,
  deviceName: string,
  deviceRevokedAt: ?number,
  deviceType: DeviceType,
  onAddReaction: null | (() => void),
  onCopy: () => void,
  onDelete: null | (() => void),
  onDeleteMessageHistory: null | (() => void),
  onEdit: null | (() => void),
  onHidden: () => void,
  onQuote: null | (() => void),
  onReplyPrivately: null | (() => void),
  onViewProfile: null | (() => void),
  position: Position,
  showDivider: boolean,
  style?: StylesCrossPlatform,
  timestamp: number,
  visible: boolean,
  yourMessage: boolean,
  isDeleteable: boolean,
}

const TextPopupMenu = (props: Props) => {
  const items = [
    ...(props.showDivider ? ['Divider'] : []),
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
    ...(props.yourMessage || props.onDeleteMessageHistory ? ['Divider'] : []),
    ...(props.onEdit
      ? [
          {
            onClick: props.onEdit,
            title: 'Edit',
          },
        ]
      : []),
    ...(props.onAddReaction ? [{onClick: props.onAddReaction, title: 'Add a reaction'}] : []),
    {onClick: props.onCopy, title: 'Copy text'},
    ...(props.onQuote ? [{onClick: props.onQuote, title: 'Quote'}] : []),
    ...(props.onReplyPrivately ? [{onClick: props.onReplyPrivately, title: 'Reply privately'}] : []),
    ...(props.onViewProfile ? [{onClick: props.onViewProfile, title: 'View profile'}] : []),
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
