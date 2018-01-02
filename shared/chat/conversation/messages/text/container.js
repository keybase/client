// @flow
import * as I from 'immutable'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import TextMessage, {type Props} from '.'
// import createCachedSelector from 're-reselect'
import {compose, lifecycle, connect, type TypedState} from '../../../../util/container'
import {type OwnProps} from './container'

// const getProps = createCachedSelector(
// [Constants.getMessageFromMessageKey, Constants.getEditingMessage],
// (message: ?Types.TextMessage, editingMessage) => {
// return {
// isEditing: message === editingMessage,
// text: message ? message.message.stringValue() : null,
// type: message ? message.messageState : null,
// mentions: message ? message.mentions : Set(),
// channelMention: message ? message.channelMention : 'None',
// }
// }
// )((state, messageKey) => messageKey)

// TODO don't need connect in this case
const mapStateToProps = (state: TypedState, {message}: OwnProps) => ({
  message,
})
// return getProps(state, messageKey)
// }

const mergeProps = (stateProps, dispatchProps) => ({
  text: stateProps.message.text.stringValue(),
  type: 'sent', // TODO
  mentions: I.Set(),
  channelMention: 'None',
  isEditing: false,
  // ...stateProps,
  // ...dispatchProps,
  // measure,
})

export default compose(
  connect(mapStateToProps, () => ({}), mergeProps) // ,
  // lifecycle({
  // componentWillReceiveProps: function(nextProps: Props) {
  // if (this.props.measure && this.props.type !== nextProps.type) {
  // this.props.measure()
  // }
  // },
  // })
)(TextMessage)
