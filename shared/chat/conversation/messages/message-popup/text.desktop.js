// @flow
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import MessagePopupHeader from './header'
import {ModalLessPopupMenu as PopupMenu} from '../../../../common-adapters/popup-menu.desktop'
import {connect, type TypedState, type Dispatch} from '../../../../util/container'
import type {OwnProps, Props} from './text'

const TextPopupMenu = (props: Props) => {
  const items = props.yourMessage
    ? [
        ...(props.showDivider ? ['Divider'] : []),
        {disabled: !props.onEdit, onClick: props.onEdit, title: 'Edit'},
        {
          danger: true,
          disabled: !props.onDelete,
          onClick: props.onDelete,
          subTitle: 'Deletes for everyone',
          title: 'Delete',
        },
      ]
    : []

  const header = {
    title: 'header',
    view: (
      <MessagePopupHeader message={props.message} isLast={!items.length} yourMessage={props.yourMessage} />
    ),
  }
  return (
    <PopupMenu
      closeOnClick={true}
      header={header}
      items={items}
      onHidden={props.onHidden}
      style={{...stylePopup, ...props.style}}
    />
  )
}

const mapStateToProps = (state: TypedState) => ({_you: state.config.username})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onDelete: (message: Types.Message) =>
    dispatch(
      Chat2Gen.createMessageDelete({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.ordinal,
      })
    ),
  _onEdit: (message: Types.Message) => {
    dispatch(
      Chat2Gen.createMessageSetEditing({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.ordinal,
      })
    )
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const message = ownProps.message
  const yourMessage = message.author === stateProps._you
  return {
    message,
    onDelete: yourMessage ? () => dispatchProps._onDelete(message) : null,
    onEdit: yourMessage && message.type === 'text' ? () => dispatchProps._onEdit(message) : null,
    onHidden: () => ownProps.onClosePopup(),
    showDivider: !message.deviceRevokedAt,
    yourMessage,
  }
}

const stylePopup = {
  overflow: 'visible',
  width: 196,
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(TextPopupMenu)
