// @flow
import type {Component} from 'react'
import * as Constants from '../../../../../constants/chat2'
import * as TeamConstants from '../../../../../constants/teams'
import * as Types from '../../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as KBFSGen from '../../../../../actions/kbfs-gen'
import {navigateAppend} from '../../../../../actions/route-tree'
import {compose, connect, isMobile, setDisplayName, type TypedState} from '../../../../../util/container'
import {isIOS} from '../../../../../constants/platform'
import type {Position} from '../../../../../common-adapters/relative-popup-hoc'
import Exploding from '.'

export type OwnProps = {
  attachTo: ?Component<any, any>,
  message: Types.MessageAttachment | Types.MessageText,
  onHidden: () => void,
  position: Position,
  visible: boolean,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const yourMessage = ownProps.message.author === state.config.username
  const meta = Constants.getMeta(state, ownProps.message.conversationIDKey)
  const _canDeleteHistory =
    meta.teamType === 'adhoc' || TeamConstants.getCanPerform(state, meta.teamname).deleteChatHistory
  const _canExplodeNow = yourMessage || _canDeleteHistory
  return {
    _canDeleteHistory,
    _canEdit: yourMessage,
    _canExplodeNow,
    author: ownProps.message.author,
    deviceName: ownProps.message.deviceName,
    deviceRevokedAt: ownProps.message.deviceRevokedAt,
    deviceType: ownProps.message.deviceType,
    explodesAt: ownProps.message.explodingTime,
    hideTimer: ownProps.message.submitState === 'pending' || ownProps.message.submitState === 'failed',
    timestamp: ownProps.message.timestamp,
    yourMessage,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  _onDeleteHistory: () => {
    dispatch(Chat2Gen.createNavigateToThread())
    dispatch(navigateAppend([{props: {message: ownProps.message}, selected: 'deleteHistoryWarning'}]))
  },
  _onDownload: () =>
    dispatch(
      Chat2Gen.createAttachmentDownload({
        conversationIDKey: ownProps.message.conversationIDKey,
        ordinal: ownProps.message.ordinal,
      })
    ),
  _onEdit: () =>
    dispatch(
      Chat2Gen.createMessageSetEditing({
        conversationIDKey: ownProps.message.conversationIDKey,
        ordinal: ownProps.message.ordinal,
      })
    ),
  _onExplodeNow: () =>
    dispatch(
      Chat2Gen.createMessageDelete({
        conversationIDKey: ownProps.message.conversationIDKey,
        ordinal: ownProps.message.ordinal,
      })
    ),
  _onSaveAttachment: () =>
    dispatch(
      Chat2Gen.createMessageAttachmentNativeSave({
        conversationIDKey: ownProps.message.conversationIDKey,
        ordinal: ownProps.message.ordinal,
      })
    ),
  _onShareAttachment: () =>
    dispatch(
      Chat2Gen.createMessageAttachmentNativeShare({
        conversationIDKey: ownProps.message.conversationIDKey,
        ordinal: ownProps.message.ordinal,
      })
    ),
  _onShowInFinder: () =>
    ownProps.message.type === 'attachment' &&
    ownProps.message.downloadPath &&
    dispatch(KBFSGen.createOpenInFileUI({path: ownProps.message.downloadPath})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const items = []
  if (stateProps._canExplodeNow) {
    items.push({
      danger: true,
      onClick: dispatchProps._onExplodeNow,
      title: 'Explode now',
    })
  }
  if (stateProps._canDeleteHistory) {
    items.push({
      danger: true,
      onClick: dispatchProps._onDeleteHistory,
      title: 'Delete this + everything above',
    })
  }
  const m = ownProps.message
  if (m.type === 'attachment') {
    if (isMobile) {
      if (m.attachmentType === 'image') {
        items.push({onClick: dispatchProps._onSaveAttachment, title: 'Save'})
      }
      if (isIOS) {
        items.push({onClick: dispatchProps._onShareAttachment, title: 'Share'})
      }
    } else {
      items.push(
        !m.downloadPath
          ? {onClick: dispatchProps._onDownload, title: 'Download'}
          : {onClick: dispatchProps._onShowInFinder, title: 'Show in finder'}
      )
    }
  } else {
    if (stateProps._canEdit) {
      items.push({onClick: dispatchProps._onEdit, title: 'Edit'})
    }
  }
  return {
    attachTo: ownProps.attachTo,
    author: stateProps.author,
    deviceName: stateProps.deviceName,
    deviceRevokedAt: stateProps.deviceRevokedAt,
    deviceType: stateProps.deviceType,
    explodesAt: stateProps.explodesAt,
    hideTimer: stateProps.hideTimer,
    items,
    onHidden: ownProps.onHidden,
    position: ownProps.position,
    timestamp: stateProps.timestamp,
    visible: ownProps.visible,
    yourMessage: stateProps.yourMessage,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('ExplodingPopup')
)(Exploding)
