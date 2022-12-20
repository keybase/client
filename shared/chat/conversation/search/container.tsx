import type * as Types from '../../../constants/types/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import type * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import HiddenString from '../../../util/hidden-string'
import ThreadSearch from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  style?: Styles.StylesCrossPlatform
}

export default Container.connect(
  (state, {conversationIDKey}: OwnProps) => {
    const info = Constants.getThreadSearchInfo(state, conversationIDKey)
    return {
      _hits: info.hits,
      initialText: state.chat2.threadSearchQueryMap.get(conversationIDKey),
      status: info.status,
    }
  },
  (dispatch, {conversationIDKey}: OwnProps) => ({
    _loadSearchHit: (messageID: Types.MessageID) =>
      dispatch(Chat2Gen.createLoadMessagesCentered({conversationIDKey, highlightMode: 'always', messageID})),
    clearInitialText: () =>
      dispatch(Chat2Gen.createSetThreadSearchQuery({conversationIDKey, query: new HiddenString('')})),
    onCancel: () => dispatch(Chat2Gen.createToggleThreadSearch({conversationIDKey})),
    onSearch: (query: string) =>
      dispatch(Chat2Gen.createThreadSearch({conversationIDKey, query: new HiddenString(query)})),
    onToggleThreadSearch: () => dispatch(Chat2Gen.createToggleThreadSearch({conversationIDKey})),
    selfHide: () => dispatch(Chat2Gen.createToggleThreadSearch({conversationIDKey})),
  }),
  (stateProps, dispatchProps, {conversationIDKey, style}: OwnProps) => ({
    clearInitialText: dispatchProps.clearInitialText,
    conversationIDKey,
    hits: stateProps._hits.map(h => ({
      author: h.author,
      summary: h.bodySummary.stringValue(),
      timestamp: h.timestamp,
    })),
    initialText: stateProps.initialText ? stateProps.initialText.stringValue() : undefined,
    loadSearchHit: (index: number) => {
      const message = stateProps._hits[index] || Constants.makeMessageText()
      if (message.id > 0) {
        dispatchProps._loadSearchHit(message.id)
      }
    },
    onCancel: dispatchProps.onCancel,
    onSearch: dispatchProps.onSearch,
    onToggleThreadSearch: dispatchProps.onToggleThreadSearch,
    selfHide: dispatchProps.selfHide,
    status: stateProps.status,
    style,
  })
)(ThreadSearch)
