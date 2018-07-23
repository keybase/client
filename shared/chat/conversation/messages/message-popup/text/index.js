// @flow
import * as React from 'react'
import MessagePopupHeader from '../header'
import {FloatingMenu} from '../../../../../common-adapters/'
import {isMobile} from '../../../../../util/container'
import type {DeviceType} from '../../../../../constants/types/devices'
import type {Position} from '../../../../../common-adapters/relative-popup-hoc'

type Props = {
  attachTo: ?React.Component<any, any>,
  author: string,
  deviceName: string,
  deviceRevokedAt: ?number,
  deviceType: DeviceType,
  onCopy: () => void,
  onDelete: null | (() => void),
  onDeleteMessageHistory: null | (() => void),
  onEdit: null | (() => void),
  onHidden: () => void,
  onQuote: null | (() => void),
  onReplyPrivately: null | (() => void),
  onViewProfile: () => void,
  position: Position,
  showDivider: boolean,
  style?: Object,
  timestamp: number,
  visible: boolean,
  yourMessage: boolean,
}

const TextPopupMenu = (props: Props) => {
  const items = [
    ...(props.showDivider ? ['Divider'] : []),
    ...(props.yourMessage
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
    {onClick: props.onCopy, title: 'Copy text'},
    {onClick: props.onQuote, title: 'Quote'},
    {onClick: props.onReplyPrivately, title: 'Reply privately'},
    {onClick: props.onViewProfile, title: 'View profile'},
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
      style={{...stylePopup, ...props.style}}
      visible={props.visible}
    />
  )
}

const stylePopup = {
  overflow: 'visible',
  width: isMobile ? '100%' : 240,
}

export default TextPopupMenu
