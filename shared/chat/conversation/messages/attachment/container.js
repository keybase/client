// @flow
import * as Constants from '../../../../constants/chat'
import * as Creators from '../../../../actions/chat/creators'
import Attachment from '.'
import createCachedSelector from 're-reselect'
import {List} from 'immutable'
import {chatTab} from '../../../../constants/tabs'
import {compose, lifecycle} from 'recompose'
import {connect} from 'react-redux'
import {getPath} from '../../../../route-tree'

import type {Props} from '.'
import type {TypedState} from '../../../../constants/reducer'
import type {OwnProps} from './container'

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
  _onOpenInPopup: (message: Constants.AttachmentMessage, routePath: List<string>) => dispatch(Creators.openAttachmentPopup(message, routePath)),
  onOpenInFileUI: (path: string) => dispatch(({payload: {path}, type: 'fs:openInFileUI'}: OpenInFileUI)),
})

const mergeProps = (stateProps, dispatchProps, {measure}, OwnProps) => ({
  ...stateProps,
  ...dispatchProps,
  measure,
  onOpenInPopup: () => { dispatchProps._onOpenInPopup(stateProps.message, stateProps.routePath) },
  onOpenInFileUI: () => dispatch(({payload: {path: stateProps.message.downloadedPath}, type: 'fs:openInFileUI'}: OpenInFileUI)),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentWillReceiveProps: function (nextProps: Props) {
      // TODO
      // if (this.props.measure && this.props.type !== nextProps.type) {
        // this.props.measure()
      // }
    },
  })
)(Attachment)
