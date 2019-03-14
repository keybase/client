// @flow
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {compose, connect, getRouteProps} from '../../../util/container'
import {type RouteProps} from '../../../route-tree/render-route'
import VideoFullscreen from './'
import flags from '../../../util/feature-flags'

type OwnProps = RouteProps<{conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal}, {}>

const blankMessage = Constants.makeMessageAttachment({})

const mapStateToProps = (state, ownProps: OwnProps) => {
  const conversationIDKey = getRouteProps(ownProps, 'conversationIDKey')
  const ordinal = getRouteProps(ownProps, 'ordinal')
  const message = Constants.getMessage(state, conversationIDKey, ordinal) || blankMessage
  return {
    message: message.type === 'attachment' ? message : blankMessage,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp}: OwnProps) => ({
  onClose: () => {
    dispatch(flags.useNewRouter ? RouteTreeGen.createNavigateUp() : navigateUp())
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const message = stateProps.message
  return {
    message,
    onClose: dispatchProps.onClose,
    path: message.fileURL || message.previewURL,
    title: message.title,
  }
}

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  )
)(VideoFullscreen)
