// @flow
import React from 'react'
import {Box, Icon, PopupMenu, Text} from '../../../common-adapters'
import {globalStyles, globalColors} from '../../../styles'
import {timestampToString} from '../../../constants/chat'
import type {TextMessage} from '../../../constants/chat'

import type {Props} from './popup'

function iconNameForDeviceType (deviceType: string): string {
  switch (deviceType) {
    case 'mobile': return 'icon-fancy-encrypted-phone-122-x-64'
    default: return 'icon-fancy-encrypted-computer-150-x-64'
  }
}

const TextMessagePopup = ({message}: {message: TextMessage}) => {
  const {deviceName, deviceType, timestamp} = message
  const iconName = iconNameForDeviceType(deviceType)
  return (
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
      <Icon type={iconName} />
      <Text type='BodySmall' style={{color: globalColors.green2}}>ENCRYPTED & SIGNED</Text>
      <Text type='BodySmall' style={{color: globalColors.black_40}}>{`by ${deviceName}`}</Text>
      <Text type='BodySmall' style={{color: globalColors.black_40}}>{timestampToString(timestamp)}</Text>
    </Box>
  )
}

const Popup = ({message, onEdit, onDelete, onHidden, style}: Props) => {
  if (message.type === 'Text') {
    const headerView = <TextMessagePopup message={message} />
    const header = {
      title: 'header',
      view: headerView,
    }

    const items = message.followState === 'You' ? [
      'Divider',
      {title: 'Edit', onClick: () => onEdit()},
      {title: 'Delete', subTitle: 'Deletes for everyone', danger: true, onClick: () => onDelete()},
    ] : []

    return (
      <PopupMenu header={header} items={items} onHidden={onHidden} style={style} />
    )
  }
  return null
}

export default Popup
