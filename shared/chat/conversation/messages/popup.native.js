// @flow
import React from 'react'
import {connect} from 'react-redux'
import {navigateUp} from '../../../actions/route-tree'
import {NativeClipboard, PopupMenu} from '../../../common-adapters/index.native'
import MessagePopupHeader from './popup-header'

import type {RouteProps} from '../../../route-tree/render-route'
import type {TypedState} from '../../../constants/reducer'
import type {ServerMessage, TextMessage} from '../../../constants/chat'

function onCopy (text: string, onClose: () => void) {
  NativeClipboard.setString(text)
  onClose()
}

function MessagePopup ({message, onClose}: {message: ServerMessage, onClose: () => void}) {
  if (message.type !== 'Text' && message.type !== 'Attachment') return null

  const items = []

  if (message.type === 'Text') {
    const textMessage: TextMessage = message
    items.push({onClick: () => onCopy(textMessage.message.stringValue(), onClose), title: 'Copy Text'})
  }

  const menuProps = {
    header: {
      title: 'header',
      view: <MessagePopupHeader message={message} />,
    },
    items,
    onHidden: onClose,
  }

  return (
    <PopupMenu {...menuProps} />
  )
}

type MessagePopupRouteProps = RouteProps<{
  message: ServerMessage,
}, {}>
type OwnProps = MessagePopupRouteProps & {}

export default connect(
  (state: TypedState, {routeProps}: OwnProps) => {
    const {message} = routeProps
    return {
      message,
    }
  },
  (dispatch: Dispatch) => ({
    onClose: () => dispatch(navigateUp()),
  })
)(MessagePopup)
