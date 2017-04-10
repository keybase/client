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
import {downloadFilePath} from '../../../../util/file'
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
    routePath: getPath(state.routeTree.routeState, [chatTab]),
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onLoadAttachment: (selectedConversation, messageID, filename) => {
    if (selectedConversation && messageID && filename) {
      dispatch(Creators.loadAttachment(selectedConversation, messageID, downloadFilePath(filename), false, false))
    }
  },
  _onOpenInFileUI: (path: string) => dispatch(({payload: {path}, type: 'fs:openInFileUI'}: OpenInFileUI)),
  _onOpenInPopup: (message: Constants.AttachmentMessage, routePath: List<string>) => dispatch(Creators.openAttachmentPopup(message, routePath)),
})

const mergeProps = (stateProps, dispatchProps, {measure, onAction}, OwnProps) => ({
  ...stateProps,
  ...dispatchProps,
  measure,
  onAction,
  onLoadAttachment: () => { dispatchProps._onLoadAttachment(stateProps.selectedConversation, stateProps.message.messageID, stateProps.message.filename) },
  onOpenInFileUI: () => { dispatchProps._onOpenInFileUI(stateProps.message.downloadedPath) },
  onOpenInPopup: () => { dispatchProps._onOpenInPopup(stateProps.message, stateProps.routePath) },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidUpdate: function (prevProps: Props & {_editedCount: number}) {
      if (this.props.measure &&
        this.props.message.previewPath !== prevProps.message.previewPath &&
        !shallowEqual(this.props.message.previewSize !== prevProps.message.previewSize)) {
        this.props.measure()
      }
    },
  })
)(Attachment)
