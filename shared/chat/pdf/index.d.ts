import * as React from 'react'
import type * as Types from '../../constants/types/chat2'

type Props = {
  message: Types.MessageAttachment
  url?: string
}
export default class ChatPDF extends React.Component<Props> {}
export const options: any
