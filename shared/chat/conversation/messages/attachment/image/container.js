// @flow
import * as Types from '../../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
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
  onClick: () => {},
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  loadPreview: () => dispatchProps._loadPreview(ownProps.message.conversationIDKey, ownProps.message.ordinal),
  message: ownProps.message,
  onClick: dispatchProps.onClick,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(ImageAttachment)
