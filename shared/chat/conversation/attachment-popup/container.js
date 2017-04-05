// @flow
import {compose, withState, withProps} from 'recompose'
import RenderAttachmentPopup from './'
import {connect} from 'react-redux'
import {deleteMessage} from '../../../actions/chat/creators'
import {downloadFilePath} from '../../../util/file'
import * as Constants from '../../../constants/chat'

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
        you: state.config.username,
        message,
      }
    },
    (dispatch: Dispatch, {navigateUp, navigateAppend}) => ({
      _onMessageAction: (message: Constants.ServerMessage) => dispatch(navigateAppend([{props: {message}, selected: 'messageAction'}])),
      deleteMessage: message => dispatch(deleteMessage(message)),
      onClose: () => dispatch(navigateUp()),
      onDownloadAttachment: (message: AttachmentMessage) => {
        const messageID = message.messageID
        if (!messageID || !message.filename) {
          throw new Error('Cannot download attachment with missing messageID or filename')
        }
        dispatch(({
          type: 'chat:loadAttachment',
          payload: {
            conversationIDKey: message.conversationIDKey,
            filename: downloadFilePath(message.filename),
            loadPreview: false,
            isHdPreview: false,
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
        onDeleteMessage: () => {
          dispatchProps.deleteMessage(message)
          dispatchProps.onClose()
        },
        onMessageAction: () => dispatchProps._onMessageAction(message),
        onDownloadAttachment: () => dispatchProps.onDownloadAttachment(message),
        onOpenInFileUI: () => dispatchProps.onOpenInFileUI(message.downloadedPath),
      }
    },
  ),
)(RenderAttachmentPopup)
