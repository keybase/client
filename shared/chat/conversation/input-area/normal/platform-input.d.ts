import type * as React from 'react'
import type * as T from '@/constants/types'
import type * as Styles from '@/styles'
import type {RefType as InputRef} from './input'

export type Props = {
  cannotWrite: boolean
  explodingModeSeconds: number
  setExplodingMode: (mode: number) => void
  hintText: string
  setInputRef: (r: InputRef | null) => void
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
