import * as React from 'react'
import type * as T from '../../constants/types'

type Props = {
  message: T.Chat.MessageAttachment
  url?: string
}
export default class ChatPDF extends React.Component<Props> {}
