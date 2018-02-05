// @flow
import * as Types from '../../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Route from '../../../../../actions/route-tree'
import {connect, type TypedState, type Dispatch} from '../../../../../util/container'
import ImageAttachment from '.'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _loadPreview: (conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal) =>
    dispatch(
      Chat2Gen.createAttachmentPreviewNeedsUpdating({
        conversationIDKey,
        ordinal,
      })
    ),
  _onClick: (message: Types.MessageAttachment) =>
    dispatch(Route.navigateAppend([{props: {message}, selected: 'attachment'}])),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  loadPreview: () => dispatchProps._loadPreview(ownProps.message.conversationIDKey, ownProps.message.ordinal),
  message: ownProps.message,
  onClick: () => dispatchProps._onClick(ownProps.message),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(ImageAttachment)
