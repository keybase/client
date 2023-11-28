import type * as React from 'react'
import type * as T from '@/constants/types'

export type Props = {
  ordinal: T.Chat.Ordinal
  url?: string
}
declare const ChatPDF: (p: Props) => React.ReactNode
export default ChatPDF
