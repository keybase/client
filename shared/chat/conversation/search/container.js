// @flow
import * as Types from '../../../constants/types/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as Styles from '../../../styles'
import {namedConnect} from '../../../util/container'
import HiddenString from '../../../util/hidden-string'
import ThreadSearch from '.'

type OwnProps = {|
  conversationIDKey: Types.ConversationIDKey,
  style?: Styles.StylesCrossPlatform,
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
  onCancel: () => dispatch(Chat2Gen.createCancelThreadSearch()),
  onSearch: query =>
    dispatch(Chat2Gen.createThreadSearch({conversationIDKey, query: new HiddenString(query)})),
})

const mergeProps = (stateProps, dispatchProps, {conversationIDKey, style}) => ({
  inProgress: stateProps.inProgress,
  loadSearchHit: index => {
    const message = stateProps._hits.get(index, Constants.makeMessageText())
    if (message.id > 0) {
      dispatchProps._loadSearchHit(message.id)
    }
  },
  onCancel: dispatchProps.onCancel,
  onSearch: dispatchProps.onSearch,
  style,
  totalResults: stateProps._hits.size,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ThreadSearch'
)(ThreadSearch)
