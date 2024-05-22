import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import type * as T from '@/constants/types'
import {useBotConversationIDKey} from './install'

type Props = {
  botUsername: string
  teamID?: T.Teams.TeamID
  conversationIDKey?: T.Chat.ConversationIDKey
}

const ConfirmBotRemoveImpl = (props: {botUsername: string}) => {
  const {botUsername} = props
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const removeBotMember = C.useChatContext(s => s.dispatch.removeBotMember)
  const onClose = React.useCallback(() => {
    clearModals()
  }, [clearModals])
  const onRemove = React.useCallback(() => {
    removeBotMember(botUsername)
  }, [removeBotMember, botUsername])
  return (
    <Kb.ConfirmModal
      prompt={`Are you sure you want to uninstall ${botUsername}?`}
      waitingKey={C.Chat.waitingKeyBotRemove}
      onConfirm={onRemove}
      onCancel={onClose}
      description=""
      header={<Kb.Avatar username={botUsername} size={96} />}
    />
  )
}

const ConfirmBotRemove = (props: Props) => {
  const {teamID, botUsername} = props
  const conversationIDKey = useBotConversationIDKey(props.conversationIDKey, teamID)
  return conversationIDKey ? (
    <C.ChatProvider id={conversationIDKey}>
      <ConfirmBotRemoveImpl botUsername={botUsername} />
    </C.ChatProvider>
  ) : null
}

export default ConfirmBotRemove
