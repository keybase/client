// @flow
import Channel from './channel'
import React from 'react'
import {connect} from '../util/container'
import * as ChatGen from '../actions/chat-gen'

type OwnProps = {channel: string}

const mapDispatchToProps = (dispatch, {channel}: OwnProps) => ({
  onClick: () => dispatch(ChatGen.createSelectConversation({conversationIDKey: null, fromUser: true})),
})

// $FlowIssue
const Connected: React.ComponentType<OwnProps> = connect(() => {}, mapDispatchToProps)(Channel)
export default Connected
