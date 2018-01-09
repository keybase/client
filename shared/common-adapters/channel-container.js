// @flow
import {Channel, type OwnProps} from './channel'
import {connect, type TypedState} from '../util/container'
import * as ChatGen from '../actions/chat-gen'
import {pathSelector} from '../actions/route-tree'

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
