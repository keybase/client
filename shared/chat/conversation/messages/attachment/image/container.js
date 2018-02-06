// @flow
import * as Types from '../../../../../constants/types/chat2'
import * as KBFSGen from '../../../../../actions/kbfs-gen'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Route from '../../../../../actions/route-tree'
import {connect, type TypedState, type Dispatch, isMobile} from '../../../../../util/container'
import ImageAttachment from '.'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _loadPreview: (conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal) =>
    dispatch(
      Chat2Gen.createAttachmentNeedsUpdating({
        conversationIDKey,
        isPreview: true,
        ordinal,
      })
    ),
  _onClick: (message: Types.MessageAttachment) => {
    dispatch(
      Chat2Gen.createAttachmentNeedsUpdating({
        conversationIDKey: message.conversationIDKey,
        isPreview: false,
        ordinal: message.ordinal,
      })
    )
    dispatch(
      Route.navigateAppend([
        {
          props: {conversationIDKey: message.conversationIDKey, ordinal: message.ordinal},
          selected: 'attachment',
        },
      ])
    )
  },
  _onShowInFinder: (message: Types.MessageAttachment) => {
    message.downloadPath && dispatch(KBFSGen.createOpenInFileUI({path: message.downloadPath}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  loadPreview: () => dispatchProps._loadPreview(ownProps.message.conversationIDKey, ownProps.message.ordinal),
  message: ownProps.message,
  onClick: () => dispatchProps._onClick(ownProps.message),
  onShowInFinder:
    !isMobile && ownProps.message.downloadPath
      ? () => dispatchProps._onShowInFinder(ownProps.message)
      : undefined,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(ImageAttachment)
