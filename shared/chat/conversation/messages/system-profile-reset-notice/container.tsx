import * as Constants from '../../../../constants/chat2'
import type * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import ProfileResetNotice from '.'
import * as Container from '../../../../util/container'

type OwnProps = {conversationIDKey: Types.ConversationIDKey}

export default (ownProps: OwnProps) => {
  const {conversationIDKey} = ownProps
  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
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
