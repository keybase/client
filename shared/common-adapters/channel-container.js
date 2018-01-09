// @flow
import Channel from './channel'
import {connect, type TypedState} from '../util/container'
import {type ConversationIDKey} from '../constants/types/chat'
import * as ChatGen from '../actions/chat-gen'
import {pathSelector} from '../actions/route-tree'

type OwnProps = {channel: string, convID: ConversationIDKey}

const mapStateToProps = (state: TypedState) => {
  return {
    currentPath: pathSelector(state),
  }
}

const mapDispatchToProps = (dispatch, {convID}: OwnProps) => ({
  onClick: currentPath =>
    dispatch(
      ChatGen.createSelectOrPreviewConversation({conversationIDKey: convID, previousPath: currentPath})
    ),
})

const mergeProps = ({currentPath}, {onClick}, ownProps: OwnProps) => {
  return {
    ...ownProps,
    onClick: () => onClick(currentPath),
  }
}

// $FlowIssue
export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Channel)
