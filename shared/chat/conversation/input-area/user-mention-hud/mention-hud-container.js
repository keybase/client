// @flow
import React from 'react'
import {MentionHud} from '.'
import {connect} from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'

type ConnectedMentionHudProps = {
  conversationIDKey: Types.ConversationIDKey,
  onPickUser: (user: string) => void,
  onSelectUser: (user: string) => void,
  selectUpCounter: number,
  selectDownCounter: number,
  pickSelectedUserCounter: number,
  filter: string,
  style?: Object,
}

const mapStateToProps = (state, {filter, conversationIDKey}): * => ({
  _filter: filter,
  _infoMap: state.users.infoMap,
  _participants: Constants.getMeta(state, conversationIDKey).participants,
  conversationIDKey,
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...ownProps,
  conversationIDKey: stateProps.conversationIDKey,
  filter: stateProps._filter.toLowerCase(),
  users: stateProps._participants
    .map(p => ({fullName: stateProps._infoMap.getIn([p, 'fullname'], ''), username: p}))
    .toArray(),
})

const ConnectedMentionHud: Class<React.Component<ConnectedMentionHudProps, void>> = connect(
  mapStateToProps,
  () => ({}),
  mergeProps
)(MentionHud)

export default ConnectedMentionHud
