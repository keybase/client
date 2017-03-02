// @flow
import React from 'react'
import {connect} from 'react-redux'
import {navigateUp} from '../../../actions/route-tree'
import {NativeClipboard, PopupMenu} from '../../../common-adapters/index.native'
import MessagePopupHeader from './popup-header'

import type {TextProps} from './popup'
import type {RouteProps} from '../../../route-tree/render-route'
import type {TypedState} from '../../../constants/reducer'
import type {ServerMessage, TextMessage} from '../../../constants/chat'

function MessagePopup ({message, onShowEditor, onHidden}: TextProps) {
  if (message.type !== 'Text' && message.type !== 'Attachment') return null

  const items = []

  if (message.type === 'Text') {
    const textMessage: TextMessage = message

    items.push({
      onClick: () => {
        onShowEditor(message)
        onHidden()
      },
      title: 'Edit',
    })
    items.push({
      onClick: () => {
        NativeClipboard.setString(textMessage.message.stringValue())
        onHidden()
      },
      title: 'Copy Text',
    })
  }

  const menuProps = {
    header: {
      title: 'header',
      view: <MessagePopupHeader message={message} />,
    },
    items,
    onHidden,
  }

  return (
    <PopupMenu {...menuProps} />
  )
}

type MessagePopupRouteProps = RouteProps<{
  message: ServerMessage,
  onShowEditor: () => void,
}, {}>
type OwnProps = MessagePopupRouteProps & {}

export default connect(
  (state: TypedState, {routeProps}: OwnProps) => {
    const {message, onShowEditor} = routeProps
    return {
      message,
      onShowEditor,
    }
  },
  (dispatch: Dispatch) => ({
    onHidden: () => dispatch(navigateUp()),
  })
)(MessagePopup)
