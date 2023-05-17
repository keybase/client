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

export default (ownProps: OwnProps) => {
  const {conversationIDKey, style} = ownProps
  const info = Container.useSelector(state => Constants.getThreadSearchInfo(state, conversationIDKey))
  const _hits = info?.hits
  const initialText = Container.useSelector(state => state.chat2.threadSearchQueryMap.get(conversationIDKey))
  const status = info?.status

  const dispatch = Container.useDispatch()
  const _loadSearchHit = (messageID: Types.MessageID) => {
    dispatch(Chat2Gen.createLoadMessagesCentered({conversationIDKey, highlightMode: 'always', messageID}))
  }
  const clearInitialText = () => {
    dispatch(Chat2Gen.createSetThreadSearchQuery({conversationIDKey, query: new HiddenString('')}))
  }
  const onCancel = () => {
    dispatch(Chat2Gen.createToggleThreadSearch({conversationIDKey}))
  }
  const onSearch = (query: string) => {
    dispatch(Chat2Gen.createThreadSearch({conversationIDKey, query: new HiddenString(query)}))
  }
  const onToggleThreadSearch = () => {
    dispatch(Chat2Gen.createToggleThreadSearch({conversationIDKey}))
  }
  const selfHide = () => {
    dispatch(Chat2Gen.createToggleThreadSearch({conversationIDKey}))
  }
  const props = {
    clearInitialText,
    conversationIDKey,
    hits:
      _hits?.map(h => ({
        author: h.author,
        summary: h.bodySummary.stringValue(),
        timestamp: h.timestamp,
      })) ?? [],
    initialText: initialText ? initialText.stringValue() : undefined,
    loadSearchHit: (index: number) => {
      const message = _hits?.[index] || Constants.makeMessageText()
      if (message.id > 0) {
        _loadSearchHit(message.id)
      }
    },
    onCancel,
    onSearch,
    onToggleThreadSearch,
    selfHide,
    status,
    style,
  }
  return <ThreadSearch {...props} />
}
