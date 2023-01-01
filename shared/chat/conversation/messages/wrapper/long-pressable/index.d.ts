import * as React from 'react'
import * as Styles from '../../../../../styles'
import type * as Types from '../../../../../constants/types/chat2'

export type Props = {
  children: React.ReactNode
  conversationIDKey?: Types.ConversationIDKey
  ordinal?: Types.Ordinal
  // mobile
  onLongPress?: () => void
  style?: Styles.StylesCrossPlatform
  // desktop
  className?: string
  onContextMenu?: () => void
  onMouseOver?: () => void
}
export default class LongPressable extends React.Component<Props> {}
