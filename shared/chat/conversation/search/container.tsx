import * as C from '../../../constants'
import * as Constants from '../../../constants/chat2'
import ThreadSearch from '.'
import type * as Styles from '../../../styles'
import type * as T from '../../../constants/types'

type OwnProps = {
  style?: Styles.StylesCrossPlatform
}

export default (ownProps: OwnProps) => {
  const {style} = ownProps
  const conversationIDKey = C.useChatContext(s => s.id)
  const info = C.useChatContext(s => s.threadSearchInfo)
  const _hits = info.hits
  const status = info.status
  const initialText = C.useChatContext(s => s.threadSearchQuery)
  const loadMessagesCentered = C.useChatContext(s => s.dispatch.loadMessagesCentered)
  const _loadSearchHit = (messageID: T.Chat.MessageID) => {
    loadMessagesCentered(messageID, 'always')
  }
  const setThreadSearchQuery = C.useChatContext(s => s.dispatch.setThreadSearchQuery)
  const clearInitialText = () => {
    setThreadSearchQuery('')
  }
  const toggleThreadSearch = C.useChatContext(s => s.dispatch.toggleThreadSearch)
  const threadSearch = C.useChatContext(s => s.dispatch.threadSearch)
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
