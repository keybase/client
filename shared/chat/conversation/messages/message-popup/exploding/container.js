// @flow
import * as React from 'react'
import * as Constants from '../../../../../constants/chat2'
import * as TeamConstants from '../../../../../constants/teams'
import * as Types from '../../../../../constants/types/chat2'
import * as ConfigGen from '../../../../../actions/config-gen'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as FsGen from '../../../../../actions/fs-gen'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import {namedConnect, isMobile} from '../../../../../util/container'
import {isIOS} from '../../../../../constants/platform'

import type {Position} from '../../../../../common-adapters/relative-popup-hoc.types'
import type {StylesCrossPlatform} from '../../../../../styles/css'
import Exploding from '.'

export type OwnProps = {
  attachTo: () => ?React.Component<any>,
  message: Types.MessageAttachment | Types.MessageText,
  onHidden: () => void,
  position: Position,
  style?: StylesCrossPlatform,
  visible: boolean,
}

const mapStateToProps = (state, ownProps: OwnProps) => {
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

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  _onAddReaction: () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {conversationIDKey: ownProps.message.conversationIDKey, ordinal: ownProps.message.ordinal},
            selected: 'chooseEmoji',
          },
        ],
      })
    )
  },
  _onCopy: () => {
    if (ownProps.message.type === 'text') {
      dispatch(ConfigGen.createCopyToClipboard({text: ownProps.message.text.stringValue()}))
    }
  },
  _onDownload: () =>
    dispatch(
      Chat2Gen.createAttachmentDownload({
        message: ownProps.message,
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
  _onShowInFinder: () => {
    ownProps.message.type === 'attachment' &&
      ownProps.message.downloadPath &&
      dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: ownProps.message.downloadPath}))
  },
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
  if (isMobile) {
    // 'Add a reaction' is an option on mobile
    items.push({
      onClick: dispatchProps._onAddReaction,
      title: 'Add a reaction',
    })
  }
  const message = ownProps.message
  if (message.type === 'attachment') {
    if (isMobile) {
      if (message.attachmentType === 'image') {
        items.push({onClick: dispatchProps._onSaveAttachment, title: 'Save'})
      }
      if (isIOS) {
        items.push({onClick: dispatchProps._onShareAttachment, title: 'Share'})
      }
    } else {
      items.push(
        !message.downloadPath
          ? {onClick: dispatchProps._onDownload, title: 'Download'}
          : {onClick: dispatchProps._onShowInFinder, title: 'Show in finder'}
      )
    }
  } else {
    if (stateProps._canEdit) {
      items.push({onClick: dispatchProps._onEdit, title: 'Edit'})
    }
    items.push({onClick: dispatchProps._onCopy, title: 'Copy text'})
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
    style: ownProps.style,
    timestamp: stateProps.timestamp,
    visible: ownProps.visible,
    yourMessage: stateProps.yourMessage,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ExplodingPopup'
)(Exploding)
