// @flow
import type {Component} from 'react'
import * as Constants from '../../../../../constants/chat2'
import * as TeamConstants from '../../../../../constants/teams'
import * as Types from '../../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import {connect, type TypedState} from '../../../../../util/container'
import type {Position} from '../../../../../common-adapters/relative-popup-hoc'
import Exploding from '.'

type OwnProps = {
  attachTo: ?Component<any, any>,
  message: Types.MessageAttachment | Types.MessageText,
  onHidden: () => void,
  position: Position,
  visible: boolean,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const yourMessage = ownProps.message.author === state.config.username
  const meta = Constants.getMeta(state, ownProps.message.conversationIDKey)
  const canExplodeNow =
    meta.teamType === 'adhoc' ||
    yourMessage ||
    TeamConstants.getCanPerform(state, meta.teamname).manageMembers
  return {
    author: ownProps.message.author,
    canEdit: yourMessage,
    canExplodeNow,
    deviceName: ownProps.message.deviceName,
    deviceRevokedAt: ownProps.message.deviceRevokedAt,
    deviceType: ownProps.message.deviceType,
    explodesAt: ownProps.message.explodingTime,
    timestamp: ownProps.message.timestamp,
    yourMessage,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  onEdit: () =>
    dispatch(
      Chat2Gen.createMessageSetEditing({
        conversationIDKey: ownProps.message.conversationIDKey,
        ordinal: ownProps.message.ordinal,
      })
    ),
  onExplodeNow: () =>
    dispatch(
      Chat2Gen.createMessageDelete({
        conversationIDKey: ownProps.message.conversationIDKey,
        ordinal: ownProps.message.ordinal,
      })
    ),
})

export default connect(mapStateToProps, mapDispatchToProps)(Exploding)
