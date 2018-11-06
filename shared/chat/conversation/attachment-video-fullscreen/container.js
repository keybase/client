// @flow
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import {compose, connect} from '../../../util/container'
import {type RouteProps} from '../../../route-tree/render-route'
import VideoFullscreen from './'

type OwnProps = RouteProps<{conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal}, {}>

const blankMessage = Constants.makeMessageAttachment({})

const mapStateToProps = (state, ownProps: OwnProps) => {
  const conversationIDKey = ownProps.routeProps.get('conversationIDKey')
  const ordinal = ownProps.routeProps.get('ordinal')
  const message = Constants.getMessage(state, conversationIDKey, ordinal) || blankMessage
  return {
    message: message.type === 'attachment' ? message : blankMessage,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp, navigateAppend}: OwnProps) => ({
  onClose: () => {
    dispatch(navigateUp())
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
connect<OwnProps, _,_,_,_>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  )
)(VideoFullscreen)
