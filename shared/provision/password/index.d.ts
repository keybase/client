import * as React from 'react'

export type Props = {
  prompt: string
  onSubmit: () => void
  onChange: (password: string) => void
  password: string | null
  onBack: () => void
  onForgotPassword: () => void
  waitingForResponse: boolean
  error?: string | null
  username?: string
  showTyping: boolean
  toggleShowTyping: (on: boolean) => void
}

export default class Password extends React.Component<Props> {}
