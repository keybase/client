import * as Kb from '../../../common-adapters'
import * as Constants from '../../../constants/chat2'
import * as C from '../../../constants'
import type * as T from '../../../constants/types'
import {useBotConversationIDKey} from './install'

type LoaderProps = {
  botUsername: string
  conversationIDKey?: T.Chat.ConversationIDKey
  teamID?: T.Teams.TeamID
}

const ConfirmBotRemoveLoader = (props: LoaderProps) => {
  const botUsername = props.botUsername
  const inConvIDKey = props.conversationIDKey
  const teamID = props.teamID
  const conversationIDKey = useBotConversationIDKey(inConvIDKey, teamID)
  return <ConfirmBotRemove botUsername={botUsername} conversationIDKey={conversationIDKey} />
}

type Props = {
  botUsername: string
  conversationIDKey?: T.Chat.ConversationIDKey
}

const ConfirmBotRemove = (props: Props) => {
  const {botUsername, conversationIDKey} = props
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const removeBotMember = C.useChatContext(s => s.dispatch.removeBotMember)
  const onClose = () => {
    clearModals()
  }
  const onRemove = conversationIDKey
    ? () => {
        removeBotMember(botUsername)
      }
    : undefined
  return (
    <Kb.ConfirmModal
      prompt={`Are you sure you want to uninstall ${botUsername}?`}
      waitingKey={Constants.waitingKeyBotRemove}
      onConfirm={onRemove}
      onCancel={onClose}
      description=""
      header={<Kb.Avatar username={botUsername} size={96} />}
    />
  )
}

export default ConfirmBotRemoveLoader
