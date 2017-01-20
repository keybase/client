// @flow
import {compose, withState, withProps} from 'recompose'
import RenderAttachmentPopup from './'
import {connect} from 'react-redux'
import {navigateUp} from '../../../actions/route-tree'
import {downloadFilePath} from '../../../util/file'

import type {RouteProps} from '../../../route-tree/render-route'
import type {TypedState} from '../../../constants/reducer'
import type {ConversationIDKey, LoadAttachment, AttachmentMessage, MessageID} from '../../../constants/chat'
import type {OpenInFileUI} from '../../../constants/kbfs'

type AttachmentPopupRouteProps = RouteProps<{
  conversationIDKey: ConversationIDKey,
  messageID: MessageID,
}, {}>
type OwnProps = AttachmentPopupRouteProps & {
  isZoomed: boolean,
  detailsPopupShowing: boolean,
  onToggleZoom: () => void,
  onOpenDetailsPopup: () => void,
  onCloseDetailsPopup: () => void,
}

export default compose(
  withState('isZoomed', 'setZoomed', false),
  withState('detailsPopupShowing', 'setDetailsPopupShowing', false),
  withProps(({setZoomed, setDetailsPopupShowing}) => ({
    onToggleZoom: () => setZoomed(zoomed => !zoomed),
    onOpenDetailsPopup: () => setDetailsPopupShowing(true),
    onCloseDetailsPopup: () => setDetailsPopupShowing(false),
  })),
  connect(
    (state: TypedState, {routeProps, ...ownProps}: OwnProps) => {
      const {conversationIDKey, messageID} = routeProps

      const conversationState = state.chat.get('conversationStates').get(conversationIDKey)
      if (!conversationState) {
        throw new Error('Attachment popup unable to get conversation state')
      }

      const message = conversationState.get('messages').find(m => m.messageID === messageID)
      if (!message) {
        throw new Error('Attachment popup unable to get message data')
      }

      return {
        ...ownProps,
        message,
      }
    },
    (dispatch: Dispatch) => ({
      onClose: () => dispatch(navigateUp()),
      onDownloadAttachment: (message: AttachmentMessage) => {
        const messageID = message.messageID
        if (!messageID) {
          throw new Error('Cannot download attachment with missing messageID')
        }
        dispatch(({
          type: 'chat:loadAttachment',
          payload: {
            conversationIDKey: message.conversationIDKey,
            filename: downloadFilePath(message.filename),
            loadPreview: false,
            messageID,
          },
        }: LoadAttachment))
      },
      onOpenInFileUI: (path: string) => dispatch(({
        type: 'fs:openInFileUI',
        payload: {path},
      }: OpenInFileUI)),
    }),
    (stateProps, dispatchProps) => {
      const {message} = stateProps
      return {
        ...stateProps,
        ...dispatchProps,
        onDownloadAttachment: () => dispatchProps.onDownloadAttachment(message),
        onOpenInFileUI: () => dispatchProps.onOpenInFileUI(message.hdPreviewPath),
      }
    },
  ),
)(RenderAttachmentPopup)
