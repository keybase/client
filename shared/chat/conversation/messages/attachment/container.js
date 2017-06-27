// @flow
import * as Constants from '../../../../constants/chat'
import * as Creators from '../../../../actions/chat/creators'
import Attachment from '.'
import shallowEqual from 'shallowequal'
import {List} from 'immutable'
import {chatTab} from '../../../../constants/tabs'
import {compose, lifecycle} from 'recompose'
import {connect} from 'react-redux'
import {getPath} from '../../../../route-tree'
import {lookupMessageProps} from '../../../shared'

import type {OpenInFileUI} from '../../../../constants/kbfs'
import type {OwnProps} from './container'
import type {Props} from '.'
import type {TypedState} from '../../../../constants/reducer'

const mapStateToProps = (state: TypedState, {messageKey}: OwnProps) => {
  return {
    ...lookupMessageProps(state, messageKey),
    // We derive the route path instead of having it passed in. We have to ensure its the path of this chat view and not any children so
    // lets just extract the root path. This makes sure the openInPopup doesn't try and push multiple attachment views if you click quickly
    routePath: getPath(state.routeTree.routeState, [chatTab]).slice(0, 2),
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onDownloadAttachment: (messageKey: Constants.MessageKey) => {
    dispatch(Creators.saveAttachment(messageKey))
  },
  _onEnsurePreviewLoaded: (messageKey: Constants.MessageKey) =>
    dispatch(Creators.loadAttachmentPreview(messageKey)),
  _onOpenInFileUI: (path: string) => dispatch(({payload: {path}, type: 'fs:openInFileUI'}: OpenInFileUI)),
  _onOpenInPopup: (message: Constants.AttachmentMessage, routePath: List<string>) =>
    dispatch(Creators.openAttachmentPopup(message, routePath)),
})

const mergeProps = (stateProps, dispatchProps, {measure, onAction}: OwnProps) => ({
  ...stateProps,
  ...dispatchProps,
  measure,
  onAction,
  onEnsurePreviewLoaded: () => {
    const {message, localMessageState} = stateProps
    if (message && message.filename && !localMessageState.previewPath) {
      setImmediate(() => dispatchProps._onEnsurePreviewLoaded(message.key))
    }
  },
  onDownloadAttachment: () => {
    dispatchProps._onDownloadAttachment(stateProps.message.key)
  },
  onOpenInFileUI: () => {
    dispatchProps._onOpenInFileUI(stateProps.localMessageState.savedPath)
  },
  onOpenInPopup: () => {
    dispatchProps._onOpenInPopup(stateProps.message, stateProps.routePath)
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount: function() {
      this.props.onEnsurePreviewLoaded()
    },

    componentDidUpdate: function(prevProps: Props) {
      if (
        this.props.measure &&
        (this.props.message.failureDescription !== prevProps.message.failureDescription ||
          this.props.localMessageState.previewPath !== prevProps.localMessageState.previewPath ||
          !shallowEqual(this.props.message.previewSize !== prevProps.message.previewSize))
      ) {
        this.props.measure()
      }

      if (this.props.message.filename !== prevProps.message.filename) {
        this.props.onEnsurePreviewLoaded()
      }
    },
  })
)(Attachment)
