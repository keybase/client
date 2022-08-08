import * as React from 'react'
import type * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import type * as Types from '../../../../constants/types/chat2'
import type * as TeamTypes from '../../../../constants/types/teams'
import type {PlainInput} from '../../../../common-adapters'

type Props = {
  hintText: string
  onBlur?: () => void
  onFocus?: () => void
  onSelectionChange?: (p: {start: number | null; end: number | null}) => void
  suggestionOverlayStyle: unknown
  cannotWrite: boolean
  showWalletsIcon: boolean
  inputSetRef: React.MutableRefObject<PlainInput | null>
  conversationIDKey: Types.ConversationIDKey
  explodingModeSeconds: number
  onChangeText: (newText: string) => void
  isEditing: boolean
  isExploding: boolean
  maxInputArea?: number
  minWriterRole: TeamTypes.TeamRoleType
  onRequestScrollDown: () => void
  onRequestScrollUp: () => void
  onSubmit: (text: string) => void
  showReplyPreview: boolean
  showTypingStatus: boolean
  suggestBotCommandsUpdateStatus: RPCChatTypes.UIBotCommandsUpdateStatusTyp
  userEmojisLoading: boolean
}

export default class PlatformInput extends React.Component<Props> {}
