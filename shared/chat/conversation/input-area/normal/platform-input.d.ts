import type * as React from 'react'
import type * as T from '@/constants/types'
import type * as Styles from '@/styles'
import type {PlainInput} from '@/common-adapters'

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
  onSubmit: (text: string) => void
  showReplyPreview: boolean
  showTypingStatus: boolean
  suggestBotCommandsUpdateStatus: T.RPCChat.UIBotCommandsUpdateStatusTyp
  suggestionOverlayStyle: Styles.StylesCrossPlatform
}

declare const PlatformInput: (p: Props) => React.ReactNode
export default PlatformInput
