// @flow
import React from 'react'
import {Icon, PopupMenu, Text} from '../../../common-adapters'
import {PopupHeaderText} from '../../../common-adapters/popup-menu'
import {globalStyles, globalMargins, globalColors} from '../../../styles'
import {formatTimeForPopup, formatTimeForRevoked} from '../../../util/timestamp'
import {fileUIName} from '../../../constants/platform'
import flags from '../../../util/feature-flags'

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

const MessagePopupHeader = ({message: {author, deviceName, deviceType, timestamp, senderDeviceRevokedAt, you}, isLast}: {message: (TextMessage | AttachmentMessage), isLast?: boolean}) => {
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
            ...(isLast ? {borderBottomLeftRadius: 3, borderBottomRightRadius: 3, marginBottom: -globalMargins.small} : {}),
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

export const TextPopupMenu = ({message, onEditMessage, onDeleteMessage, onHidden, style, you}: TextProps) => {
  let items = []
  if (message.author === you) {
    items = [
      {onClick: () => onEditMessage(message), title: 'Edit'},
      {danger: true, onClick: () => onDeleteMessage(message), subTitle: 'Deletes for everyone', title: 'Delete'},
    ]

    if (!flags.chatAdminOnly) {
      // remote edit
      items.shift()
    }

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

export const AttachmentPopupMenu = ({message, onDeleteMessage, onOpenInFileUI, onDownloadAttachment, onHidden, style, you}: AttachmentProps) => {
  const items = [
    'Divider',
    {onClick: () => onDownloadAttachment(message), title: 'Download'},
    message.downloadedPath
      ? {onClick: () => onOpenInFileUI(message), title: `Show in ${fileUIName}`}
      : {onClick: () => onDownloadAttachment(message), title: 'Download'},
  ]
  if (message.author === you) {
    items.push({danger: true, onClick: () => onDeleteMessage(message), subTitle: 'Deletes for everyone', title: 'Delete'})
  }
  const header = {
    title: 'header',
    view: <MessagePopupHeader message={message} />,
  }
  return <PopupMenu header={header} items={items} onHidden={onHidden} style={{...stylePopup, ...style}} />
}
