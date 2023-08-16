import * as React from 'react'
import * as T from '../../../constants/types'

export type ItemType = T.Chat.Ordinal

export type Props = {
  onFocusInput: () => void
  requestScrollToBottomRef: React.MutableRefObject<undefined | (() => void)>
  requestScrollUpRef: React.MutableRefObject<undefined | (() => void)>
  requestScrollDownRef: React.MutableRefObject<undefined | (() => void)>
}
export default class ConversationList extends React.Component<Props> {}
