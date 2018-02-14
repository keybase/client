// @flow
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Route from '../../../../actions/route-tree'
import {getCanPerform} from '../../../../constants/teams'
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
          subTitle: 'Deletes this message for everyone',
          title: 'Delete',
        },
        ...(props.onDeleteMessageHistory
          ? [
              'Divider',
              {
                danger: true,
                onClick: props.onDeleteMessageHistory,
                subTitle: 'Deletes all messages before this one for everyone',
                title: 'Delete up to here',
              },
            ]
          : []),
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

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const message = ownProps.message
  const meta = Constants.getMeta(state, message.conversationIDKey)
  const yourOperations = getCanPerform(state, meta.teamname)
  const _canDeleteHistory = yourOperations && yourOperations.deleteChatHistory
  return {
    _canDeleteHistory,
    _you: state.config.username,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onDelete: (message: Types.Message) =>
    dispatch(
      Chat2Gen.createMessageDelete({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.ordinal,
      })
    ),
  _onDeleteMessageHistory: (message: Types.Message) => {
    dispatch(Route.navigateUp())
    dispatch(Route.navigateAppend([{props: {message}, selected: 'deleteHistoryWarning'}]))
  },
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
    onDeleteMessageHistory: stateProps._canDeleteHistory
      ? () => dispatchProps._onDeleteMessageHistory(message)
      : null,
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
