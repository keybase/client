// @flow
import * as Constants from '../../../../constants/chat'
import * as Creators from '../../../../actions/chat/creators'
import Attachment from '.'
import createCachedSelector from 're-reselect'
import shallowEqual from 'shallowequal'
import {List} from 'immutable'
import {chatTab} from '../../../../constants/tabs'
import {compose, lifecycle} from 'recompose'
import {connect} from 'react-redux'
import {getPath} from '../../../../route-tree'

import type {OpenInFileUI} from '../../../../constants/kbfs'
import type {OwnProps} from './container'
import type {Props} from '.'
import type {TypedState} from '../../../../constants/reducer'

const getProps = createCachedSelector(
  [Constants.getMessageFromMessageKey],
  (message: Constants.TextMessage) => ({
    message: message,
  })
)((state, messageKey) => messageKey)

const mapStateToProps = (state: TypedState, {messageKey}: OwnProps) => {
  return {
    ...getProps(state, messageKey),
    // We derive the route path instead of having it passed in. We have to ensure its the path of this chat view and not any children so
    // lets just extract the root path. This makes sure the openInPopup doesn't try and push multiple attachment views if you click quickly
    routePath: getPath(state.routeTree.routeState, [chatTab]).slice(0, 2),
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onDownloadAttachment: (selectedConversation, messageID) => {
    if (selectedConversation && messageID) {
      dispatch(Creators.saveAttachment(selectedConversation, messageID))
    }
  },
  _onEnsurePreviewLoaded: (message: Constants.AttachmentMessage) => dispatch(Creators.loadAttachmentPreview(message)),
  _onOpenInFileUI: (path: string) => dispatch(({payload: {path}, type: 'fs:openInFileUI'}: OpenInFileUI)),
  _onOpenInPopup: (message: Constants.AttachmentMessage, routePath: List<string>) => dispatch(Creators.openAttachmentPopup(message, routePath)),
})

const mergeProps = (stateProps, dispatchProps, {measure, onAction}: OwnProps) => ({
  ...stateProps,
  ...dispatchProps,
  measure,
  onAction,
  onEnsurePreviewLoaded: () => {
    const {message} = stateProps
    if (message && message.filename && !message.previewPath) {
      setImmediate(() => dispatchProps._onEnsurePreviewLoaded(stateProps.message))
    }
  },
  onDownloadAttachment: () => { dispatchProps._onDownloadAttachment(stateProps.selectedConversation, stateProps.message.messageID) },
  onOpenInFileUI: () => { dispatchProps._onOpenInFileUI(stateProps.message.downloadedPath) },
  onOpenInPopup: () => { dispatchProps._onOpenInPopup(stateProps.message, stateProps.routePath) },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount: function () {
      this.props.onEnsurePreviewLoaded()
    },

    componentDidUpdate: function (prevProps: Props & {_editedCount: number}) {
      if (this.props.measure &&
        this.props.message.previewPath !== prevProps.message.previewPath &&
        !shallowEqual(this.props.message.previewSize !== prevProps.message.previewSize)) {
        this.props.measure()
      }

      if (this.props.message && prevProps.message && prevProps.message.filename !== this.props.message.filename) {
        this.props.onEnsurePreviewLoaded()
      }
    },
  })
)(Attachment)
