import type * as React from 'react'
import type * as T from '@/constants/types'
import type * as Styles from '@/styles'
import type {RefType as Input2Ref} from '@/common-adapters/input2'

export type Props = {
  cannotWrite: boolean
  explodingModeSeconds: number
  setExplodingMode: (mode: number) => void
  hintText: string
  setInput2Ref: (r: Input2Ref | null) => void
  isEditing: boolean
  isExploding: boolean
  minWriterRole: T.Teams.TeamRoleType
  onCancelEditing: () => void
  onChangeText: (newText: string) => void
  onSubmit: (text: string) => void
  showReplyPreview: boolean
  suggestBotCommandsUpdateStatus: T.RPCChat.UIBotCommandsUpdateStatusTyp
  suggestionOverlayStyle: Styles.StylesCrossPlatform
}

declare const PlatformInput: (p: Props) => React.ReactNode
export default PlatformInput
