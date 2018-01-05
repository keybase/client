// @flow
import Channel from './channel'
import {connect} from '../util/container'
import {type ConversationIDKey} from '../constants/types/chat'
import * as ChatGen from '../actions/chat-gen'

type OwnProps = {channel: string, convID: ConversationIDKey}

const mapDispatchToProps = (dispatch, {convID}: OwnProps) => ({
  onClick: () => dispatch(ChatGen.createSelectConversation({conversationIDKey: convID, fromUser: true})),
})

export default connect(null, mapDispatchToProps)(Channel)
