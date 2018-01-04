// @flow
import * as Constants from '../../../../constants/chat'
import {
  getConvIdsFromTeamName,
  getTeamNameFromConvID,
  getChannelNameFromConvID,
} from '../../../../constants/teams'
import * as Types from '../../../../constants/types/chat'
import TextMessage, {type Props} from '.'
import createCachedSelector from 're-reselect'
import {Set} from 'immutable'
import {compose, lifecycle, connect, type TypedState} from '../../../../util/container'
import {type OwnProps} from './container'

const getTeamChannelNames = (state: TypedState, messageKey: Types.MessageKey): {[string]: string} => {
  const message: ?Types.Message = Constants.getMessageFromMessageKey(state, messageKey)
  if (!message || message.type !== 'Text') return {}

  const teamname = getTeamNameFromConvID(state, message.conversationIDKey)
  if (!teamname) return {}

  const convIDs = getConvIdsFromTeamName(state, teamname)
  return convIDs
    .map(convID => {
      getChannelNameFromConvID(state, convID)
    })
    .filter(Boolean)
    .toObject()
}

const getProps = createCachedSelector(
  [Constants.getMessageFromMessageKey, Constants.getEditingMessage, getTeamChannelNames],
  (message: ?Types.TextMessage, editingMessage, channelNames: {[string]: string}) => {
    return {
      isEditing: message === editingMessage,
      text: message ? message.message.stringValue() : null,
      type: message ? message.messageState : null,
      mentions: message ? message.mentions : Set(),
      channelMention: message ? message.channelMention : 'None',
      channelNames,
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
