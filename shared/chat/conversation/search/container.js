// @flow
import * as Types from '../../../constants/types/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import {namedConnect} from '../../../util/container'
import HiddenString from '../../../util/hidden-string'
import ThreadSearch from '.'

type OwnProps = {|
  conversationIDKey: Types.ConversationIDKey,
|}

const mapStateToProps = (state, {conversationIDKey}) => {
  const info = state.chat2.threadSearchInfoMap.get(conversationIDKey, Constants.makeThreadSearchInfo())
  return {
    _hits: info.hits,
    inProgress: info.inProgress,
  }
}

const mapDispatchToProps = (dispatch, {conversationIDKey}) => ({
  _loadSearchHit: messageID =>
    dispatch(Chat2Gen.createLoadMessagesFromSearchHit({conversationIDKey, messageID})),
  onCancel: () => dispatch(Chat2Gen.createCancelThreadSearch({conversationIDKey})),
  onSearch: query =>
    dispatch(Chat2Gen.createThreadSearch({conversationIDKey, query: new HiddenString(query)})),
})

const mergeProps = (stateProps, dispatchProps, {conversationIDKey}) => ({
  inProgress: stateProps.inProgress,
  loadSearchHit: index => dispatchProps._loadSearchHit(stateProps._hits.get(index).id),
  onCancel: dispatchProps.onCancel,
  onSearch: dispatchProps.onSearch,
  totalResults: stateProps._hits.size,
})

export default namedConnect<_, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'ThreadSearch')(
  ThreadSearch
)
