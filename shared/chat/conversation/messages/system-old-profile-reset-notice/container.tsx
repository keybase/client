import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import type * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import OldProfileResetNotice from '.'

export default () => {
  const participantInfo = Constants.useContext(s => s.participants)
  const meta = Constants.useContext(s => s.meta)
  const _participants = participantInfo.all
  const nextConversationIDKey = meta.supersededBy
  const username = meta.wasFinalizedBy || ''

  const dispatch = Container.useDispatch()
  const onOpenConversation = (conversationIDKey: Types.ConversationIDKey) => {
    dispatch(Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'jumpFromReset'}))
  }
  const previewConversation = Constants.useState(s => s.dispatch.previewConversation)
  const startConversation = (participants: Array<string>) => {
    previewConversation({participants, reason: 'fromAReset'})
  }
  const props = {
    onOpenNewerConversation: nextConversationIDKey
      ? () => onOpenConversation(nextConversationIDKey)
      : () => startConversation(_participants),
    username,
  }
  return <OldProfileResetNotice {...props} />
}
