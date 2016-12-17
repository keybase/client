// @flow
import React from 'react'
import {Icon, PopupMenu, Text} from '../../../common-adapters'
import {globalStyles, globalColors} from '../../../styles'
import {formatTimeForMessages} from '../../../util/timestamp'
import type {TextMessage} from '../../../constants/chat'
import type {IconType} from '../../../common-adapters/icon'

import type {Props} from './popup'

function iconNameForDeviceType (deviceType: string): IconType {
  switch (deviceType) {
    case 'mobile': return 'icon-fancy-encrypted-phone-122-x-64'
    default: return 'icon-fancy-encrypted-computer-150-x-64'
  }
}

const TextMessagePopup = ({message: {deviceName, deviceType, timestamp}}: {message: TextMessage}) => {
  const iconName = iconNameForDeviceType(deviceType)
  return (
    <div style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
      <Icon type={iconName} />
      <Text type='BodySmall' style={{color: globalColors.green2}}>ENCRYPTED & SIGNED</Text>
      <Text type='BodySmall' style={{color: globalColors.black_40}}>{`by ${deviceName}`}</Text>
      <Text type='BodySmall' style={{color: globalColors.black_40}}>{formatTimeForMessages(timestamp)}</Text>
    </div>
  )
}

const Popup = ({message, onEditMessage, onDeleteMessage, onHidden, style}: Props) => {
  if (message.type === 'Text') {
    const headerView = <TextMessagePopup message={message} />
    const header = {
      title: 'header',
      view: headerView,
    }

    let items = []
    if (message.followState === 'You') {
      items = [
        'Divider',
        {title: 'Edit', onClick: () => onEditMessage(message)},
        {title: 'Delete', subTitle: 'Deletes for everyone', danger: true, onClick: () => onDeleteMessage(message)},
      ]
    }

    return (
      <PopupMenu header={header} items={items} onHidden={onHidden} style={style} />
    )
  }
  return null
}

export default Popup
