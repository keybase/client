// @flow
import React from 'react'
import {Icon, PopupMenu, Text} from '../../../common-adapters'
import {PopupHeaderText} from '../../../common-adapters/popup-menu'
import {globalStyles, globalMargins, globalColors} from '../../../styles'
import {formatTimeForPopup, formatTimeForRevoked} from '../../../util/timestamp'
import type {TextMessage} from '../../../constants/chat'
import type {IconType} from '../../../common-adapters/icon'

import type {Props} from './popup'

function iconNameForDeviceType (deviceType: string, isRevoked: boolean): IconType {
  switch (deviceType) {
    case 'mobile':
      return isRevoked ? 'icon-fancy-revoked-phone-122-x-64' : 'icon-fancy-encrypted-phone-122-x-64'
    default:
      return isRevoked ? 'icon-fancy-revoked-computer-150-x-64' : 'icon-fancy-encrypted-computer-150-x-64'
  }
}

const TextMessagePopup = ({message: {author, deviceName, deviceType, timestamp, senderDeviceRevokedAt, you}, isLast}: {message: TextMessage, isLast: boolean}) => {
  const iconName = iconNameForDeviceType(deviceType, !!senderDeviceRevokedAt)
  const whoRevoked = author === you ? 'You' : author
  return (
    <div style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
      <Icon type={iconName} style={{marginTop: -6}} />
      <div style={globalStyles.flexBoxRow}>
        <Text type='BodySmall' style={{color: globalColors.green2}}>ENCRYPTED</Text>
        <Text type='BodySmall' style={{color: senderDeviceRevokedAt ? globalColors.black_40 : globalColors.green2}}>&nbsp;& SIGNED</Text>
      </div>
      <div style={globalStyles.flexBoxRow}>
        <Text type='BodySmall' style={{color: globalColors.black_40}}>by</Text>
        <Text type='BodySmallItalic' style={{color: globalColors.black_60}}>&nbsp;{deviceName}</Text>
      </div>
      <Text type='BodySmall' style={{color: globalColors.black_40}}>{formatTimeForPopup(timestamp)}</Text>
      {senderDeviceRevokedAt &&
        <PopupHeaderText
          color={globalColors.white}
          backgroundColor={globalColors.blue}
          style={{
            marginTop: globalMargins.small,
            ...(isLast ? {marginBottom: -globalMargins.small, borderBottomLeftRadius: 3, borderBottomRightRadius: 3} : {}),
          }}
        >{whoRevoked} revoked this device on {formatTimeForRevoked(senderDeviceRevokedAt)}.</PopupHeaderText>
      }
    </div>
  )
}

const Popup = ({message, onEditMessage, onDeleteMessage, onHidden, style, you}: Props) => {
  if (message.type === 'Text') {
    let items = []
    if (message.author === you) {
      items = [
        {title: 'Edit', onClick: () => onEditMessage(message)},
        {title: 'Delete', subTitle: 'Deletes for everyone', danger: true, onClick: () => onDeleteMessage(message)},
      ]
      if (!message.senderDeviceRevokedAt) {
        items.unshift('Divider')
      }
    }

    const headerView = <TextMessagePopup message={message} isLast={!items.length} />
    const header = {
      title: 'header',
      view: headerView,
    }

    return (
      <PopupMenu header={header} items={items} onHidden={onHidden} style={{...stylePopup, ...style}} />
    )
  }
  return null
}

const stylePopup = {
  overflow: 'visible',
  width: 196,
}

export default Popup
