// @flow
import * as Constants from '../../../../constants/chat'
import TextMessage, {type Props} from '.'
import createCachedSelector from 're-reselect'
import {Set} from 'immutable'
import {compose, lifecycle, connect, type TypedState} from '../../../../util/container'
import {type OwnProps} from './container'

const getProps = createCachedSelector(
  [Constants.getMessageFromMessageKey, Constants.getEditingMessage],
  (message: ?Constants.TextMessage, editingMessage) => {
    return {
      isEditing: message === editingMessage,
      text: message ? message.message.stringValue() : null,
      type: message ? message.messageState : null,
      mentions: message ? message.mentions : Set(),
      channelMention: message ? message.channelMention : 'None',
    }
  }
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
