// @flow
import {compose, withState, withProps, connect, type TypedState} from '../../../util/container'
import RenderAttachmentPopup from './'
import {deleteMessage} from '../../../actions/chat/creators'
import * as Constants from '../../../constants/chat'
import {lookupMessageProps} from '../../shared'
import {type RouteProps} from '../../../route-tree/render-route'
import {type OpenInFileUI} from '../../../constants/kbfs'

type AttachmentPopupRouteProps = RouteProps<
  {
    messageKey: Constants.MessageKey,
  },
  {}
>
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
      const messageKey = routeProps.get('messageKey')

      return {
        ...lookupMessageProps(state, messageKey),
        ...ownProps,
        you: state.config.username,
      }
    },
    (dispatch: Dispatch, {navigateUp, navigateAppend}) => ({
      _onMessageAction: (message: Constants.ServerMessage) =>
        dispatch(navigateAppend([{props: {message}, selected: 'messageAction'}])),
      deleteMessage: message => dispatch(deleteMessage(message)),
      onClose: () => dispatch(navigateUp()),
      onDownloadAttachment: (message: Constants.AttachmentMessage) => {
        if (!message.messageID || !message.filename) {
          throw new Error('Cannot download attachment with missing messageID or filename')
        }
        dispatch(
          ({
            type: 'chat:saveAttachment',
            payload: {
              messageKey: message.key,
            },
          }: Constants.SaveAttachment)
        )
      },
      onOpenInFileUI: (path: string) =>
        dispatch(
          ({
            type: 'fs:openInFileUI',
            payload: {path},
          }: OpenInFileUI)
        ),
    }),
    (stateProps, dispatchProps) => {
      const {message, localMessageState} = stateProps
      return {
        ...stateProps,
        ...dispatchProps,
        onDeleteMessage: () => {
          dispatchProps.deleteMessage(message)
          dispatchProps.onClose()
        },
        onMessageAction: () => dispatchProps._onMessageAction(message),
        onDownloadAttachment: () => dispatchProps.onDownloadAttachment(message),
        onOpenInFileUI: () => dispatchProps.onOpenInFileUI(localMessageState.savedPath),
      }
    }
  )
)(RenderAttachmentPopup)
