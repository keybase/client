import * as React from 'react'
import type * as T from '../../../../constants/types'
import type {PlainInput} from '../../../../common-adapters'

type Props = {
  cannotWrite: boolean
  conversationIDKey: T.Chat.ConversationIDKey
  explodingModeSeconds: number
  hintText: string
  inputSetRef: React.MutableRefObject<PlainInput | null>
  isEditing: boolean
  isExploding: boolean
  minWriterRole: T.Teams.TeamRoleType
  onCancelEditing: () => void
  onChangeText: (newText: string) => void
  onRequestScrollDown: () => void
  onRequestScrollUp: () => void
  onSubmit: (text: string) => void
  showReplyPreview: boolean
  showTypingStatus: boolean
  suggestBotCommandsUpdateStatus: T.RPCChat.UIBotCommandsUpdateStatusTyp
  suggestionOverlayStyle: unknown
}

export default class PlatformInput extends React.Component<Props> {}
