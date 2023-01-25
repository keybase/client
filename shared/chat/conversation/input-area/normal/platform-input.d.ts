import * as React from 'react'
import type * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import type * as Types from '../../../../constants/types/chat2'
import type * as TeamTypes from '../../../../constants/types/teams'
import type {PlainInput} from '../../../../common-adapters'

type Props = {
  cannotWrite: boolean
  conversationIDKey: Types.ConversationIDKey
  explodingModeSeconds: number
  hintText: string
  inputSetRef: React.MutableRefObject<PlainInput | null>
  isEditing: boolean
  isExploding: boolean
  minWriterRole: TeamTypes.TeamRoleType
  onCancelEditing: () => void
  onChangeText: (newText: string) => void
  onRequestScrollDown: () => void
  onRequestScrollUp: () => void
  onSubmit: (text: string) => void
  showReplyPreview: boolean
  showTypingStatus: boolean
  showWalletsIcon: boolean
  suggestBotCommandsUpdateStatus: RPCChatTypes.UIBotCommandsUpdateStatusTyp
  suggestionOverlayStyle: unknown
}

export default class PlatformInput extends React.Component<Props> {}
