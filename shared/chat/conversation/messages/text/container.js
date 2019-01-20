// @flow
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import TextMessage from '.'
import {namedConnect} from '../../../../util/container'

type OwnProps = {|
  message: Types.MessageText,
|}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const editInfo = Constants.getEditInfo(state, ownProps.message.conversationIDKey)
  const isEditing = !!(editInfo && editInfo.ordinal === ownProps.message.ordinal)
  return {isEditing}
}
const mapDispatchToProps = dispatch => ({})
const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  isEditing: stateProps.isEditing,
  message: ownProps.message,
  text: ownProps.message.decoratedText
    ? ownProps.message.decoratedText.stringValue()
    : ownProps.message.text.stringValue(),
  type: ownProps.message.errorReason ? 'error' : ownProps.message.submitState === null ? 'sent' : 'pending',
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'TextMessage'
)(TextMessage)
