import type * as React from 'react'
import type * as T from '../../../../constants/types'
import type {PlainInput} from '../../../../common-adapters'

export type Props = {
  cannotWrite: boolean
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

declare const PlatformInput: (p: Props) => React.ReactNode
export default PlatformInput
