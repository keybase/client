// @flow
import React from 'react'
import {Icon, PopupMenu, Text} from '../../../common-adapters'
import {PopupHeaderText} from '../../../common-adapters/popup-menu'
import {globalStyles, globalMargins, globalColors} from '../../../styles'
import {formatTimeForPopup, formatTimeForRevoked} from '../../../util/timestamp'
import type {TextMessage, AttachmentMessage} from '../../../constants/chat'
import type {IconType} from '../../../common-adapters/icon'

import type {TextProps, AttachmentProps} from './popup'

function iconNameForDeviceType (deviceType: string, isRevoked: boolean): IconType {
  switch (deviceType) {
    case 'mobile':
      return isRevoked ? 'icon-fancy-revoked-phone-122-x-64' : 'icon-fancy-encrypted-phone-122-x-64'
    default:
      return isRevoked ? 'icon-fancy-revoked-computer-150-x-64' : 'icon-fancy-encrypted-computer-150-x-64'
  }
}

const MessagePopupHeader = ({message: {author, deviceName, deviceType, timestamp, senderDeviceRevokedAt, followState}, isLast}: {message: (TextMessage | AttachmentMessage), isLast?: boolean}) => {
  const iconName = iconNameForDeviceType(deviceType, !!senderDeviceRevokedAt)
  const whoRevoked = followState === 'You' ? 'You' : author
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

const stylePopup = {
  overflow: 'visible',
  width: 196,
}

export const TextPopupMenu = ({message, onEditMessage, onDeleteMessage, onHidden, style}: TextProps) => {
  let items = []
  if (message.followState === 'You') {
    items = [
      {title: 'Edit', onClick: () => onEditMessage(message)},
      {title: 'Delete', subTitle: 'Deletes for everyone', danger: true, onClick: () => onDeleteMessage(message)},
    ]
    if (!message.senderDeviceRevokedAt) {
      items.unshift('Divider')
    }
  }
  const header = {
    title: 'header',
    view: <MessagePopupHeader message={message} isLast={!items.length} />,
  }
  return <PopupMenu header={header} items={items} onHidden={onHidden} style={{...stylePopup, ...style}} />
}

export const AttachmentPopupMenu = ({message, onDeleteMessage, onDownloadAttachment, onHidden, style}: AttachmentProps) => {
  const items = [
    'Divider',
    {title: 'Download', onClick: () => onDownloadAttachment(message)},
  ]
  if (message.followState === 'You') {
    items.push({title: 'Delete', subTitle: 'Deletes for everyone', danger: true, onClick: () => onDeleteMessage(message)})
  }
  const header = {
    title: 'header',
    view: <MessagePopupHeader message={message} />,
  }
  return <PopupMenu header={header} items={items} onHidden={onHidden} style={{...stylePopup, ...style}} />
}
