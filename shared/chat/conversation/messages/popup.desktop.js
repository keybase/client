// @flow
import React from 'react'
import {PopupMenu} from '../../../common-adapters'
import {fileUIName} from '../../../constants/platform'

import MessagePopupHeader from './popup-header'

import type {TextProps, AttachmentProps} from './popup'

const stylePopup = {
  overflow: 'visible',
  width: 196,
}

export const TextPopupMenu = ({message, onShowEditor, onDeleteMessage, onHidden, style, you}: TextProps) => {
  let items = []
  if (message.author === you) {
    items = [
      {onClick: () => onShowEditor(message), title: 'Edit'},
      {danger: true, onClick: () => onDeleteMessage(message), subTitle: 'Deletes for everyone', title: 'Delete'},
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

export const AttachmentPopupMenu = ({message, onDeleteMessage, onOpenInFileUI, onDownloadAttachment, onHidden, style, you}: AttachmentProps) => {
  let downloadItem
  if (message.messageState === 'placeholder') {
    downloadItem = {disabled: true, title: `${message.author} is uploading…`}
  } else {
    downloadItem = {onClick: onDownloadAttachment, title: 'Download'}
  }

  const items = [
    'Divider',
    (message.downloadedPath ? {onClick: onOpenInFileUI, title: `Show in ${fileUIName}`} : null),
    downloadItem,
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
