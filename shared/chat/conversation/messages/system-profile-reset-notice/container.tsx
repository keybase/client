import * as Constants from '../../../../constants/chat2'
import type * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import ProfileResetNotice from '.'
import * as Container from '../../../../util/container'

export default () => {
  const meta = Constants.useContext(s => s.meta)
  const prevConversationIDKey = meta.supersedes
  const username = meta.wasFinalizedBy || ''

  const dispatch = Container.useDispatch()
  const _onOpenOlderConversation = (conversationIDKey: Types.ConversationIDKey) => {
    dispatch(Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'jumpToReset'}))
  }
  const props = {
    onOpenOlderConversation: () => {
      prevConversationIDKey && _onOpenOlderConversation(prevConversationIDKey)
    },
    username,
  }
  return <ProfileResetNotice {...props} />
}
