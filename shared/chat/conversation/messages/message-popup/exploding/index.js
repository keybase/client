// @flow
import * as React from 'react'
import * as Types from '../../../../../constants/types/chat2'
import MessagePopupHeader from '../header'
import {FloatingMenu} from '../../../../../common-adapters/'
import type {Position} from '../../../../../common-adapters/relative-popup-hoc'
import {isMobile} from '../../../../../util/container'

type Props = {
  attachTo: ?React.Component<*, *>,
  message: Types.MessageText,
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
  visible: boolean,
  yourMessage: boolean,
}

const ExplodingPopupMenu = (props: Props) => {
  const {message} = props
  const items = [
    ...(props.showDivider ? ['Divider'] : []),
    {danger: true, disabled: !props.onExplodeNow, onClick: props.onExplodeNow, title: 'Explode now'},
    {disabled: !props.onEdit, onClick: props.onEdit, title: 'Edit'},
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
  width: isMobile ? '100%' : 196,
}

export default ExplodingPopupMenu
