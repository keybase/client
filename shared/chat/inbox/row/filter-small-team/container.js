// @flow
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import SelectableSmallTeam from '../../../selectable-small-team-container'
import {namedConnect} from '../../../../util/container'

type OwnProps = {conversationIDKey: Types.ConversationIDKey}

const mapStateToProps = (state, ownProps: OwnProps) => ({
  filter: state.chat2.inboxFilter.toLowerCase(),
  isSelected: Constants.getSelectedConversation(state) === ownProps.conversationIDKey,
})

const mapDispatchToProps = (dispatch, {conversationIDKey}) => ({
  onSelectConversation: () =>
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'inboxSmall'})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  return {
    conversationIDKey: ownProps.conversationIDKey,
    filter: stateProps.filter,
    isSelected: stateProps.isSelected,
    onSelectConversation: dispatchProps.onSelectConversation,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'FilterSmallTeam'
)(SelectableSmallTeam)
