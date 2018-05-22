// @flow
import type {Component} from 'react'
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

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => ({
  author: ownProps.message.author,
  deviceName: ownProps.message.deviceName,
  deviceRevokedAt: ownProps.message.deviceRevokedAt,
  deviceType: ownProps.message.deviceType,
  explodesAt: ownProps.message.explodingTime,
  timestamp: ownProps.message.timestamp,
  yourMessage: ownProps.message.author === state.config.username,
})

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
