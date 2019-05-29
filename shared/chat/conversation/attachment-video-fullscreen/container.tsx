import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {compose, connect, getRouteProps} from '../../../util/container'
import {RouteProps} from '../../../route-tree/render-route'
import VideoFullscreen from './'

type OwnProps = RouteProps<
  {
    conversationIDKey: Types.ConversationIDKey
    ordinal: Types.Ordinal
  },
  {}
>

const blankMessage = Constants.makeMessageAttachment({})

const mapStateToProps = (state, ownProps: OwnProps) => {
  const conversationIDKey = getRouteProps(ownProps, 'conversationIDKey')
  const ordinal = getRouteProps(ownProps, 'ordinal')
  const message = Constants.getMessage(state, conversationIDKey, ordinal) || blankMessage
  return {
    message: message.type === 'attachment' ? message : blankMessage,
  }
}

const mapDispatchToProps = dispatch => ({
  onClose: () => {
    dispatch(RouteTreeGen.createNavigateUp())
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
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  )
)(VideoFullscreen)
