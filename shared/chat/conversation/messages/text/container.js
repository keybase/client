// @flow
import * as Constants from '../../../../constants/chat'
import TextMessage from '.'
import createCachedSelector from 're-reselect'
import {compose} from 'recompose'
import {connect} from 'react-redux'

import type {TypedState} from '../../../../constants/reducer'
import type {OwnProps} from './container'

const getEditingMessage = (state: TypedState) => state.chat.get('editingMessage')

const getProps = createCachedSelector(
  [Constants.getMessageFromMessageKey, getEditingMessage],
  (message: Constants.TextMessage, editingMessage) => ({
    isEditing: message === editingMessage,
    text: message.message.stringValue(),
    type: message.messageState,
  })
)((state, messageKey) => messageKey)

const mapStateToProps = (state: TypedState, {messageKey}: OwnProps) => {
  return getProps(state, messageKey)
}

export default compose(
  connect(mapStateToProps, () => ({})),
)(TextMessage)
