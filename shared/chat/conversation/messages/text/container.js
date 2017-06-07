// @flow
import * as Constants from '../../../../constants/chat'
import TextMessage from '.'
import createCachedSelector from 're-reselect'
import {compose, lifecycle} from 'recompose'
import {connect} from 'react-redux'

import type {Props} from '.'
import type {TypedState} from '../../../../constants/reducer'
import type {OwnProps} from './container'

const getProps = createCachedSelector(
  [Constants.getMessageFromMessageKey, Constants.getEditingMessage],
  (message: ?Constants.TextMessage, editingMessage) => ({
    isEditing: message === editingMessage,
    text: message ? message.message.stringValue() : null,
    type: message ? message.messageState : null,
  })
)((state, messageKey) => messageKey)

const mapStateToProps = (state: TypedState, {messageKey}: OwnProps) => {
  return getProps(state, messageKey)
}

const mergeProps = (stateProps, dispatchProps, {measure}: OwnProps) => ({
  ...stateProps,
  ...dispatchProps,
  measure,
})

export default compose(
  connect(mapStateToProps, () => ({}), mergeProps),
  lifecycle({
    componentWillReceiveProps: function(nextProps: Props) {
      if (this.props.measure && this.props.type !== nextProps.type) {
        this.props.measure()
      }
    },
  })
)(TextMessage)
