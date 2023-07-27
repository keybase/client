import type * as Types from '../../../constants/types/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import type * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import ThreadSearch from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  style?: Styles.StylesCrossPlatform
}

export default (ownProps: OwnProps) => {
  const {conversationIDKey, style} = ownProps
  const info = Constants.useContext(s => s.threadSearchInfo)
  const _hits = info.hits
  const status = info.status
  const initialText = Constants.useContext(s => s.threadSearchQuery)

  const dispatch = Container.useDispatch()
  const _loadSearchHit = (messageID: Types.MessageID) => {
    dispatch(Chat2Gen.createLoadMessagesCentered({conversationIDKey, highlightMode: 'always', messageID}))
  }
  const setThreadSearchQuery = Constants.useContext(s => s.dispatch.setThreadSearchQuery)
  const clearInitialText = () => {
    setThreadSearchQuery('')
  }
  const toggleThreadSearch = Constants.useContext(s => s.dispatch.toggleThreadSearch)
  const threadSearch = Constants.useContext(s => s.dispatch.threadSearch)
  const onSearch = threadSearch
  const onCancel = () => {
    toggleThreadSearch()
  }
  const onToggleThreadSearch = onCancel
  const selfHide = onCancel
  const props = {
    clearInitialText,
    conversationIDKey,
    hits: _hits.map(h => ({
      author: h.author,
      summary: h.bodySummary.stringValue(),
      timestamp: h.timestamp,
    })),
    initialText,
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
