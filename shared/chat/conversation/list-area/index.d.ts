import type * as React from 'react'
import type * as T from '../../../constants/types'

export type ItemType = T.Chat.Ordinal

export type Props = {
  onFocusInput: () => void
  requestScrollToBottomRef: React.MutableRefObject<undefined | (() => void)>
  requestScrollUpRef: React.MutableRefObject<undefined | (() => void)>
  requestScrollDownRef: React.MutableRefObject<undefined | (() => void)>
}
declare const ConversationList: (p: Props) => React.ReactNode
export default ConversationList
