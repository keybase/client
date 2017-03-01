// @flow
import React from 'react'
import {connect} from 'react-redux'
import {navigateUp} from '../../../actions/route-tree'
// import {globalStyles} from '../../../styles'
import {PopupMenu} from '../../../common-adapters'
import MessagePopupHeader from './popup-header'

import type {RouteProps} from '../../../route-tree/render-route'
import type {TypedState} from '../../../constants/reducer'
import type {ServerMessage} from '../../../constants/chat'

function MessagePopup ({message, onClose}: {message: ServerMessage, onClose: () => void}) {
  console.log('popup message:', message)
  if (message.type !== 'Text' && message.type !== 'Attachment') return null

  const menuProps = {
    header: {
      title: 'header',
      view: <MessagePopupHeader message={message} />,
    },
    items: [
      {onClick: () => {}, title: 'Edit'},
      {danger: true, onClick: () => {}, subTitle: 'Deletes for everyone', title: 'Delete'},
    ],
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
